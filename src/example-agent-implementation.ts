import { ClawstrBot } from './bot';
import { AbstractAgent } from './abstract-agent';
import { LMTool } from './types';
import { EventSystem } from './event-system';

// Example tools for the agent
const exampleTools: LMTool[] = [
  {
    name: 'search_web',
    description: 'Search the web for information',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        }
      },
      required: ['query']
    },
    handler: async (params: { query: string }) => {
      // In a real implementation, this would call a web search API
      console.log(`Web search for: ${params.query}`);
      return `Results for search query "${params.query}" would appear here in a real implementation.`;
    }
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate'
        }
      },
      required: ['expression']
    },
    handler: async (params: { expression: string }) => {
      // In a real implementation, this would safely evaluate expressions
      console.log(`Calculating: ${params.expression}`);
      // NOTE: eval is dangerous in real applications - use math.js or similar
      try {
        // For demo purposes only - never use eval in production
        // const result = eval(params.expression);
        return `Calculated result for "${params.expression}" would appear here in a real implementation.`;
      } catch (error) {
        return `Error calculating "${params.expression}": ${(error as Error).message}`;
      }
    }
  },
  {
    name: 'get_current_time',
    description: 'Get the current time',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      return `Current time is: ${new Date().toISOString()}`;
    }
  },
  {
    name: 'store_value',
    description: 'Store a value in memory',
    schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to store the value under'
        },
        value: {
          type: 'string',
          description: 'The value to store'
        }
      },
      required: ['key', 'value']
    },
    handler: async (params: { key: string; value: string }) => {
      // In a real implementation, this would store values in a persistent store
      console.log(`Storing: ${params.key} = ${params.value}`);
      return `Stored ${params.key} with value: ${params.value}`;
    }
  }
];

// Example agent that extends AbstractAgent
class ExampleReasoningAgent extends AbstractAgent {
  private bot: ClawstrBot;
  private tools: Map<string, LMTool> = new Map();

  constructor(config: any) {
    super(config);
    this.bot = config.bot || null;
    
    // Add provided tools
    for (const tool of exampleTools) {
      this.tools.set(tool.name, tool);
    }
  }

  protected initializeActions(): void {
    // Add default actions for the Example Reasoning Agent
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
  }

  /**
   * Think about a prompt and return thoughts
   */
  private async think(prompt: string): Promise<string> {
    if (!this.bot) {
      return `Thoughts on: ${prompt}`;
    }
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
    if (!this.bot) {
      return `Response to: ${message}`;
    }
    return await this.bot.processInput(message);
  }
}

export class ExampleAgentImplementation {
  private agent: AbstractAgent;
  private bot: ClawstrBot;
  private eventSystem: EventSystem;

  constructor(bot: ClawstrBot, eventSystem: EventSystem) {
    this.bot = bot;
    this.eventSystem = eventSystem;

    // Create the agent with example tools
    this.agent = new ExampleReasoningAgent({
      id: 'example-reasoning-agent',
      name: 'Example Reasoning Agent',
      description: 'An example agent demonstrating reasoning capabilities',
      enabled: true,
      bot: bot,
    });

    // Subscribe to agent events
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // In a real implementation, we would listen to agent events
    // For now, we'll just log when actions are executed
    console.log('Example agent event handlers set up');
  }

  async demonstrateBasicCapabilities(): Promise<void> {
    console.log('\n=== Demonstrating Basic Agent Capabilities ===\n');

    // Demonstrate thinking
    console.log('1. Agent thinking capability:');
    const thoughtResult = await this.agent.executeAction('think', {
      prompt: 'What are the key considerations when building an AI agent?'
    });
    console.log(`   Result: ${JSON.stringify(thoughtResult.result || thoughtResult.error).substring(0, 100)}...\n`);

    // Demonstrate tool usage
    console.log('2. Agent tool usage:');
    const toolResult = await this.agent.executeAction('use_tool', {
      toolName: 'get_current_time',
      toolParams: {}
    });
    console.log(`   Result: ${JSON.stringify(toolResult.result || toolResult.error)}\n`);

    // Demonstrate chat capability
    console.log('3. Agent chat capability:');
    const chatResult = await this.agent.executeAction('chat', {
      message: 'What is the purpose of this demonstration?'
    });
    console.log(`   Result: ${JSON.stringify(chatResult.result || chatResult.error).substring(0, 100)}...\n`);
  }

  async demonstrateReasoningLoop(): Promise<void> {
    console.log('\n=== Demonstrating Reasoning Loop ===\n');

    // Execute a reasoning loop to solve a problem
    const goal = 'Plan a trip to Paris for 5 days, including flights, accommodation, and activities';
    const context = 'Budget is $2000, traveling in summer, interested in museums and food';

    console.log(`Goal: ${goal}`);
    console.log(`Context: ${context}\n`);

    // Note: This is a simplified version since we removed the complex reasoning loop
    console.log('Simple reasoning demonstration:');
    console.log(`Goal: ${goal}`);
    console.log('Executing simple reasoning steps...\n');
    
    const result = {
      success: true,
      result: 'Trip plan created successfully',
      steps: ['Step 1: Research flights', 'Step 2: Book accommodation', 'Step 3: Plan activities']
    };
    
    console.log('Reasoning Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Result: ${result.result}`);
    console.log(`   Steps: ${result.steps.join(', ')}`);
    console.log('');
  }

  async demonstrateCustomToolUsage(): Promise<void> {
    console.log('\n=== Demonstrating Custom Tool Usage ===\n');

    // Add a custom tool dynamically
    const customTool: LMTool = {
      name: 'custom_weather_check',
      description: 'Check weather for a location',
      schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to check weather for'
          }
        },
        required: ['location']
      },
      handler: async (params: { location: string }) => {
        // Simulate weather check
        return `Weather in ${params.location} is sunny with a high of 22°C`;
      }
    };

    // Add the custom tool to the agent
    (this.agent as any).tools.set(customTool.name, customTool);
    (this.agent as any).addAction({
      id: `tool_${customTool.name}`,
      name: customTool.name,
      description: customTool.description,
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: async (params: any) => {
        return await customTool.handler(params);
      }
    });

    console.log('Added custom weather tool');

    const weatherResult = await this.agent.executeAction('use_tool', {
      toolName: 'custom_weather_check',
      toolParams: { location: 'Paris' }
    });

    console.log(`Weather check result: ${JSON.stringify(weatherResult.result || weatherResult.error)}\n`);

    // Remove the custom tool
    (this.agent as any).tools.delete(customTool.name);
    (this.agent as any).actions.delete(`tool_${customTool.name}`);
    console.log('Removed custom weather tool\n');
  }

  async runCompleteDemonstration(): Promise<void> {
    console.log('Starting Example Agent Implementation Demonstration\n');

    await this.demonstrateBasicCapabilities();
    await this.demonstrateCustomToolUsage();
    await this.demonstrateReasoningLoop();

    console.log('Example Agent Implementation Demonstration Complete\n');
  }

  getAgent(): AbstractAgent {
    return this.agent;
  }

  // Method to add additional tools during runtime
  addRuntimeTool(tool: LMTool): void {
    (this.agent as any).tools.set(tool.name, tool);
    (this.agent as any).addAction({
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

  // Method to get agent status
  getStatus(): any {
    return {
      agentId: this.agent.getConfig().id,
      agentName: this.agent.getConfig().name,
      enabled: this.agent.getConfig().enabled,
      state: this.agent.getState(),
      // Note: Simplified since we removed the complex tool system
    };
  }
}