import { ClawstrBot } from './bot';
import { BotConfig } from './types';

export class BotManager {
  private bots: Map<string, ClawstrBot> = new Map();
  private activeBotId: string | null = null;

  createBot(id: string, config: BotConfig): ClawstrBot {
    const bot = new ClawstrBot(config);
    this.bots.set(id, bot);

    if (!this.activeBotId) {
      this.activeBotId = id;
    }

    return bot;
  }

  getBot(id: string): ClawstrBot | undefined {
    return this.bots.get(id);
  }

  setActiveBot(id: string): boolean {
    if (this.bots.has(id)) {
      this.activeBotId = id;
      return true;
    }
    return false;
  }

  getActiveBot(): ClawstrBot | null {
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

  getAllBots(): Map<string, ClawstrBot> {
    return new Map(this.bots);
  }
}
