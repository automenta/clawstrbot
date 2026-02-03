import { ClawstrBot } from './bot';
import { MCPIntegrationAgent } from './mcp-integration-agent';
import { EventSystem } from './event-system';
import { BotConfig } from './types';

export interface BotManagerConfig {
  memorySize?: number;
  enableApprovals?: boolean;
}

export class BotManager {
  private bots: Map<string, ClawstrBot> = new Map();
  private agents: Map<string, MCPIntegrationAgent> = new Map();
  private activeBotId: string | null = null;
  private eventSystem: EventSystem;
  private config: BotManagerConfig;

  constructor(config: BotManagerConfig = {}) {
    this.config = {
      memorySize: 1000, // Default memory size
      enableApprovals: false, // Default to no approvals
      ...config
    };
    this.eventSystem = new EventSystem();
  }

  /**
   * Create a new bot instance
   */
  createBot(botId: string, botConfig: BotConfig): ClawstrBot {
    if (this.bots.has(botId)) {
      throw new Error(`Bot with ID ${botId} already exists`);
    }

    // Ensure memory size is set
    const configWithMemory: BotConfig = {
      ...botConfig,
      memorySize: botConfig.memorySize || this.config.memorySize
    };

    const bot = new ClawstrBot(configWithMemory);
    this.bots.set(botId, bot);

    return bot;
  }

  /**
   * Get a bot by ID
   */
  getBot(botId: string): ClawstrBot | undefined {
    return this.bots.get(botId);
  }

  /**
   * Get the active bot
   */
  getActiveBot(): ClawstrBot | null {
    if (!this.activeBotId) {
      return null;
    }
    return this.bots.get(this.activeBotId) || null;
  }

  /**
   * Set the active bot
   */
  setActiveBot(botId: string): boolean {
    if (!this.bots.has(botId)) {
      return false;
    }
    this.activeBotId = botId;
    return true;
  }

  /**
   * Create an agent for a bot
   */
  createAgent(agentId: string, botId: string, userId: string): MCPIntegrationAgent {
    const bot = this.getBot(botId);
    if (!bot) {
      throw new Error(`Bot with ID ${botId} does not exist`);
    }

    const agent = new MCPIntegrationAgent(bot, this.eventSystem, userId);
    this.agents.set(agentId, agent);

    return agent;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): MCPIntegrationAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Start an agent's activity cycle
   */
  async startAgent(agentId: string): Promise<void> {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} does not exist`);
    }

    await agent.startActivityScheduler();
  }

  /**
   * Stop an agent's activity cycle
   */
  stopAgent(agentId: string): void {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} does not exist`);
    }

    agent.stopActivityScheduler();
  }

  /**
   * Get the event system
   */
  getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  /**
   * Get all bot IDs
   */
  getBotIds(): string[] {
    return Array.from(this.bots.keys());
  }

  /**
   * Get all agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Destroy a bot and its associated agent
   */
  async destroyBot(botId: string): Promise<void> {
    const bot = this.bots.get(botId);
    if (bot) {
      // Perform any cleanup needed for the bot
      if (typeof bot.reset === 'function') {
        await bot.reset();
      }
    }

    this.bots.delete(botId);

    if (this.activeBotId === botId) {
      this.activeBotId = null;
    }
  }

  /**
   * Destroy an agent
   */
  destroyAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get bot manager status
   */
  getStatus(): { botCount: number; agentCount: number; activeBotId: string | null } {
    return {
      botCount: this.bots.size,
      agentCount: this.agents.size,
      activeBotId: this.activeBotId
    };
  }
}