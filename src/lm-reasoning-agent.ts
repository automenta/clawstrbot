import { ClawstrBot } from './bot';
import { AbstractAgent, AgentConfig, AgentAction, AgentActionResult } from './abstract-agent';
import { LMTool } from './types';

export interface LMReasoningAgentConfig extends AgentConfig {
  bot: ClawstrBot;
  tools?: LMTool[];
  maxIterations?: number;
  reasoningModel?: string;
}

export class LMReasoningAgent extends AbstractAgent {
  private bot: ClawstrBot;
  private tools: Map<string, LMTool> = new Map();
  private maxIterations: number;
  private reasoningModel: string;

  constructor(config: LMReasoningAgentConfig) {
    super(config);
    this.bot = config.bot;
    this.maxIterations = config.maxIterations ?? 10;
    this.reasoningModel = config.reasoningModel ?? 'gpt-4';
    
    // Add provided tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.addTool(tool);
      }
    }
  }

  protected initializeActions(): void {
    // Add default actions for the LM Reasoning Agent
    this.addAction({
      id: 'think',
      name: 'think',
      description: 'Make the agent think about a problem or situation',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The thought prompt or question to think about'
          }
        },
        required: ['prompt']
      },
      handler: async (params: Record<string, any>) => {
        return await this.think(params.prompt as string);
      }
    });

    this.addAction({
      id: 'use_tool',
      name: 'use_tool',
      description: 'Use a specific tool with provided parameters',
      parameters: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: 'The name of the tool to use'
          },
          toolParams: {
            type: 'object',
            description: 'Parameters to pass to the tool'
          }
        },
        required: ['toolName', 'toolParams']
      },
      handler: async (params: Record<string, any>) => {
        return await this.useTool(params.toolName as string, params.toolParams);
      }
    });

    this.addAction({
      id: 'chat',
      name: 'chat',
      description: 'Send a message to the bot and receive a response',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message to send to the bot'
          }
        },
        required: ['message']
      },
      handler: async (params: Record<string, any>) => {
        return await this.chat(params.message as string);
      }
    });

    this.addAction({
      id: 'execute_reasoning_loop',
      name: 'execute_reasoning_loop',
      description: 'Execute a complete reasoning loop with a goal',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The goal or task to achieve'
          },
          context: {
            type: 'string',
            description: 'Additional context for the reasoning'
          }
        },
        required: ['goal']
      },
      handler: async (params: Record<string, any>) => {
        return await this.executeReasoningLoop(params.goal as string, params.context as string | undefined);
      }
    });
  }

  /**
   * Add a new tool to the agent
   */
  addTool(tool: LMTool): void {
    this.tools.set(tool.name, tool);
    this.addAction({
      id: `tool_${tool.name}`,
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (params: any) => {
        return await tool.handler(params);
      }
    });
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    if (removed) {
      this.actions.delete(`tool_${toolName}`);
    }
    return removed;
  }

  /**
   * Get all registered tools
   */
  getTools(): LMTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Think about a prompt and return thoughts
   */
  private async think(prompt: string): Promise<string> {
    const systemPrompt = `You are an intelligent agent capable of deep thinking and analysis. Consider the following carefully and provide your thoughts.`;
    return await this.bot.runWithSystemPrompt(prompt, systemPrompt);
  }

  /**
   * Use a specific tool with parameters
   */
  private async useTool(toolName: string, toolParams: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // In a real implementation, you would validate against the JSON schema
    // For now, we'll just pass the parameters through
    // A proper implementation would use ajv or similar for JSON schema validation
    return await tool.handler(toolParams);
  }

  /**
   * Send a message to the bot
   */
  private async chat(message: string): Promise<string> {
    return await this.bot.processInput(message);
  }

  /**
   * Execute a complete reasoning loop
   */
  async executeReasoningLoop(goal: string, context?: string): Promise<{ success: boolean; result?: any; steps: any[] }> {
    const steps: any[] = [];
    let currentContext = context || '';
    
    for (let i = 0; i < this.maxIterations; i++) {
      // Formulate a prompt for the reasoning model
      const reasoningPrompt = `
Goal: ${goal}
Current Context: ${currentContext}
Iteration: ${i + 1}/${this.maxIterations}

Think about the next step to achieve the goal. Respond with a JSON object containing:
- "thoughts": Your analysis of the situation
- "action": The action to take (one of: think, use_tool, chat)
- "parameters": Parameters for the action
- "complete": Boolean indicating if the goal is achieved

Respond only with the JSON object, nothing else.
      `.trim();

      try {
        // Get the reasoning model's decision
        const decisionStr = await this.bot.runWithSystemPrompt(
          reasoningPrompt,
          `You are an intelligent reasoning agent. Analyze the goal and context, then decide on the next action. Respond only with a valid JSON object.`
        );

        // Parse the decision
        let decision;
        try {
          // Extract JSON from response if it contains extra text
          const jsonMatch = decisionStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            decision = JSON.parse(jsonMatch[0]);
          } else {
            decision = JSON.parse(decisionStr);
          }
        } catch (parseError) {
          console.error('Failed to parse reasoning decision:', decisionStr);
          throw new Error(`Failed to parse reasoning decision: ${parseError}`);
        }

        steps.push({
          iteration: i + 1,
          decision,
          timestamp: new Date()
        });

        // Check if goal is achieved
        if (decision.complete) {
          return {
            success: true,
            result: decision.result || decision.thoughts,
            steps
          };
        }

        // Execute the decided action
        let actionResult;
        switch (decision.action) {
          case 'think':
            actionResult = await this.think(decision.parameters?.prompt || goal);
            break;
          case 'use_tool':
            actionResult = await this.useTool(decision.parameters?.toolName, decision.parameters?.toolParams);
            break;
          case 'chat':
            actionResult = await this.chat(decision.parameters?.message || goal);
            break;
          default:
            throw new Error(`Unknown action: ${decision.action}`);
        }

        // Update context with action result
        currentContext += `\nIteration ${i + 1} Result: ${JSON.stringify(actionResult)}`;

        // Update steps with action result
        steps[steps.length - 1].result = actionResult;
      } catch (error) {
        console.error(`Error in reasoning loop iteration ${i + 1}:`, error);
        return {
          success: false,
          result: `Error in reasoning loop: ${error}`,
          steps
        };
      }
    }

    // Max iterations reached
    return {
      success: false,
      result: 'Max iterations reached without achieving the goal',
      steps
    };
  }

  /**
   * Get tools in a format compatible with LM tool calling
   */
  getToolDefinitions(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.schemaToJSONSchema(tool.schema)
      }
    }));
  }

  /**
   * Convert schema to JSON schema format
   */
  private schemaToJSONSchema(schema: any): any {
    // Since we're using raw JSON schemas, we can return as-is
    return schema;
  }
}
