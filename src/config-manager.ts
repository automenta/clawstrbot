import * as dotenv from 'dotenv';
import { BotConfig } from './bot';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config();

export interface APIConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

export interface SavedConfig {
  lmProvider: {
    type: string;
    config: any;
  };
  bot: BotConfig;
  lastUpdated: string;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: APIConfig;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'saved-config.json');
    this.config = this.loadSavedConfig() || {
      apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || process.env.API_BASE_URL,
      model: process.env.MODEL_NAME || 'gpt-3.5-turbo',
      temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    };
  }

  private loadSavedConfig(): APIConfig | null {
    try {
      if (fs.existsSync(this.configPath)) {
        const savedConfig: SavedConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return savedConfig.bot;
      }
    } catch (error) {
      console.warn('Could not load saved configuration:', error);
    }
    return null;
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): APIConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  public getBotConfig(): BotConfig {
    return {
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      temperature: this.config.temperature,
    };
  }

  public loadFromEnv(): void {
    this.updateConfig({
      apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || process.env.API_BASE_URL,
      model: process.env.MODEL_NAME || 'gpt-3.5-turbo',
      temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    });
  }

  public saveToEnv(filePath: string = '.env'): void {
    const envContent = `
OPENAI_API_KEY=${this.config.apiKey}
API_KEY=${this.config.apiKey}
OPENAI_BASE_URL=${this.config.baseUrl || ''}
API_BASE_URL=${this.config.baseUrl || ''}
MODEL_NAME=${this.config.model}
TEMPERATURE=${this.config.temperature}
    `.trim();

    fs.writeFileSync(filePath, envContent);
  }

  public saveConfig(): void {
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const savedConfig: SavedConfig = {
      lmProvider: {
        type: 'unknown', // This would be set when provider is configured
        config: {} // This would be set when provider is configured
      },
      bot: this.getBotConfig(),
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(this.configPath, JSON.stringify(savedConfig, null, 2));
  }

  public saveLMProviderConfig(type: string, config: any): void {
    // Load existing saved config or create new one
    let savedConfig: SavedConfig;
    try {
      if (fs.existsSync(this.configPath)) {
        savedConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      } else {
        savedConfig = {
          lmProvider: { type: '', config: {} },
          bot: this.getBotConfig(),
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('Could not load existing config, creating new one:', error);
      savedConfig = {
        lmProvider: { type: '', config: {} },
        bot: this.getBotConfig(),
        lastUpdated: new Date().toISOString()
      };
    }

    // Update the LM provider config
    savedConfig.lmProvider = {
      type,
      config
    };
    savedConfig.bot = this.getBotConfig();
    savedConfig.lastUpdated = new Date().toISOString();

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(savedConfig, null, 2));
  }

  public getSavedLMProviderConfig(): { type: string; config: any } | null {
    try {
      if (fs.existsSync(this.configPath)) {
        const savedConfig: SavedConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        if (savedConfig.lmProvider && savedConfig.lmProvider.type) {
          return savedConfig.lmProvider;
        }
      }
    } catch (error) {
      console.warn('Could not load saved LM provider configuration:', error);
    }
    return null;
  }
}