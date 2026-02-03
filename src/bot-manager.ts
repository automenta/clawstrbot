import { EnhancedClawstrBot, BotConfig } from './enhanced-bot';

export class BotManager {
  private bots: Map<string, EnhancedClawstrBot> = new Map();
  private activeBotId: string | null = null;

  createBot(id: string, config: BotConfig): EnhancedClawstrBot {
    const bot = new EnhancedClawstrBot(config);
    this.bots.set(id, bot);

    if (!this.activeBotId) {
      this.activeBotId = id;
    }

    return bot;
  }

  getBot(id: string): EnhancedClawstrBot | undefined {
    return this.bots.get(id);
  }

  setActiveBot(id: string): boolean {
    if (this.bots.has(id)) {
      this.activeBotId = id;
      return true;
    }
    return false;
  }

  getActiveBot(): EnhancedClawstrBot | null {
    if (this.activeBotId) {
      return this.bots.get(this.activeBotId) || null;
    }
    return null;
  }

  listBots(): string[] {
    return Array.from(this.bots.keys());
  }

  removeBot(id: string): boolean {
    if (this.activeBotId === id) {
      this.activeBotId = null;
    }
    return this.bots.delete(id);
  }

  getAllBots(): Map<string, EnhancedClawstrBot> {
    return new Map(this.bots);
  }
}