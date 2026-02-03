import { EnhancedClawstrBot } from './enhanced-bot';
import { LMReasoningAgent, LMTool } from './lm-reasoning-agent';
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

export class ExampleAgentImplementation {
  private agent: LMReasoningAgent;
  private bot: EnhancedClawstrBot;
  private eventSystem: EventSystem;

  constructor(bot: EnhancedClawstrBot, eventSystem: EventSystem) {
    this.bot = bot;
    this.eventSystem = eventSystem;

    // Create the agent with example tools
    this.agent = new LMReasoningAgent({
      id: 'example-reasoning-agent',
      name: 'Example Reasoning Agent',
      description: 'An example agent demonstrating reasoning capabilities',
      enabled: true,
      bot: bot,
      tools: exampleTools,
      maxIterations: 5,
      reasoningModel: 'gpt-4'
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

    const reasoningResult = await this.agent.executeAction('execute_reasoning_loop', {
      goal,
      context
    });

    console.log('Reasoning Loop Result:');
    console.log(`   Success: ${reasoningResult.success}`);
    if (reasoningResult.result) {
      console.log(`   Result: ${JSON.stringify(reasoningResult.result).substring(0, 200)}...`);
    }
    if ('steps' in reasoningResult && Array.isArray((reasoningResult as any).steps)) {
      console.log(`   Steps taken: ${(reasoningResult as any).steps.length}`);
    }
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

    this.agent.addTool(customTool);

    console.log('Added custom weather tool');
    
    const weatherResult = await this.agent.executeAction('use_tool', {
      toolName: 'custom_weather_check',
      toolParams: { location: 'Paris' }
    });

    console.log(`Weather check result: ${JSON.stringify(weatherResult.result || weatherResult.error)}\n`);

    // Remove the custom tool
    this.agent.removeTool('custom_weather_check');
    console.log('Removed custom weather tool\n');
  }

  async runCompleteDemonstration(): Promise<void> {
    console.log('Starting Example Agent Implementation Demonstration\n');

    await this.demonstrateBasicCapabilities();
    await this.demonstrateCustomToolUsage();
    await this.demonstrateReasoningLoop();

    console.log('Example Agent Implementation Demonstration Complete\n');
  }

  getAgent(): LMReasoningAgent {
    return this.agent;
  }

  // Method to add additional tools during runtime
  addRuntimeTool(tool: LMTool): void {
    this.agent.addTool(tool);
  }

  // Method to get agent status
  getStatus(): any {
    return {
      agentId: this.agent.getConfig().id,
      agentName: this.agent.getConfig().name,
      enabled: this.agent.getConfig().enabled,
      state: this.agent.getState(),
      toolCount: this.agent.getTools().length
    };
  }
}