import inquirer from 'inquirer';
import { BotConfig } from './types';

export enum LMProviderType {
  OLLAMA = 'ollama',
  OPENAI_COMPATIBLE = 'openai_compatible'
}

export interface OllamaConfig {
  type: LMProviderType.OLLAMA;
  baseUrl: string; // e.g., http://localhost:11434
  model: string; // e.g., llama2, mistral, etc.
  temperature?: number;
}

export interface OpenAICompatibleConfig {
  type: LMProviderType.OPENAI_COMPATIBLE;
  baseUrl: string; // e.g., https://your-custom-endpoint.com/v1
  apiKey: string;
  model: string;
  temperature?: number;
}

export type LMProviderConfig = OllamaConfig | OpenAICompatibleConfig;

export interface LMProvider {
  type: LMProviderType;
  name: string;
  description: string;
  config: LMProviderConfig;
}

export class LMProviderManager {
  private providers: Map<string, LMProvider> = new Map();
  private activeProviderId: string | null = null;

  constructor() {
    // Add default providers
    this.addOllamaProvider('ollama-default', {
      type: LMProviderType.OLLAMA,
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      temperature: 0.7
    });

    this.addOpenAICompatibleProvider('openai-default', {
      type: LMProviderType.OPENAI_COMPATIBLE,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7
    });
  }

  addOllamaProvider(id: string, config: OllamaConfig): void {
    const provider: LMProvider = {
      type: LMProviderType.OLLAMA,
      name: `Ollama (${config.model})`,
      description: `Ollama provider connecting to ${config.baseUrl}`,
      config
    };
    this.providers.set(id, provider);
    if (!this.activeProviderId) {
      this.activeProviderId = id;
    }
  }

  addOpenAICompatibleProvider(id: string, config: OpenAICompatibleConfig): void {
    const provider: LMProvider = {
      type: LMProviderType.OPENAI_COMPATIBLE,
      name: `OpenAI Compatible (${config.model})`,
      description: `OpenAI-compatible provider connecting to ${config.baseUrl}`,
      config
    };
    this.providers.set(id, provider);
    if (!this.activeProviderId) {
      this.activeProviderId = id;
    }
  }

  getProvider(id: string): LMProvider | undefined {
    return this.providers.get(id);
  }

  getActiveProvider(): LMProvider | null {
    if (this.activeProviderId) {
      return this.providers.get(this.activeProviderId) || null;
    }
    return null;
  }

  setActiveProvider(id: string): boolean {
    if (this.providers.has(id)) {
      this.activeProviderId = id;
      return true;
    }
    return false;
  }

  listProviders(): { id: string; name: string; type: LMProviderType }[] {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.name,
      type: provider.type
    }));
  }

  removeProvider(id: string): boolean {
    if (this.activeProviderId === id) {
      this.activeProviderId = null;
    }
    return this.providers.delete(id);
  }

  updateProviderConfig(id: string, newConfig: LMProviderConfig): boolean {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }

    provider.config = newConfig;

    // Update name based on new config
    if (newConfig.type === LMProviderType.OLLAMA) {
      provider.name = `Ollama (${newConfig.model})`;
      provider.description = `Ollama provider connecting to ${newConfig.baseUrl}`;
    } else if (newConfig.type === LMProviderType.OPENAI_COMPATIBLE) {
      provider.name = `OpenAI Compatible (${newConfig.model})`;
      provider.description = `OpenAI-compatible provider connecting to ${newConfig.baseUrl}`;
    }

    this.providers.set(id, provider);
    return true;
  }

  async configureInteractively(): Promise<LMProviderConfig> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'providerType',
        message: 'Which LM provider would you like to use?',
        choices: [
          { name: 'Ollama (Local)', value: LMProviderType.OLLAMA },
          { name: 'OpenAI-Compatible Service', value: LMProviderType.OPENAI_COMPATIBLE }
        ]
      }
    ]);

    if (answers.providerType === LMProviderType.OLLAMA) {
      return await this.configureOllama();
    } else {
      return await this.configureOpenAICompatible();
    }
  }

  private async configureOllama(): Promise<OllamaConfig> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Ollama base URL:',
        default: 'http://localhost:11434',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name:',
        default: 'llama2',
        validate: (input: string) => input.length > 0 || 'Model name is required'
      },
      {
        type: 'number',
        name: 'temperature',
        message: 'Temperature (0.0 - 2.0):',
        default: 0.7,
        validate: (input: number) => {
          if (input >= 0 && input <= 2) {
            return true;
          }
          return 'Temperature must be between 0.0 and 2.0';
        }
      }
    ]);

    return {
      type: LMProviderType.OLLAMA,
      baseUrl: answers.baseUrl,
      model: answers.model,
      temperature: answers.temperature
    };
  }

  private async configureOpenAICompatible(): Promise<OpenAICompatibleConfig> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL for the OpenAI-compatible service:',
        default: 'https://api.openai.com/v1',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'API Key:',
        mask: '*',
        validate: (input: string) => input.length > 0 || 'API Key is required'
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name:',
        default: 'gpt-3.5-turbo',
        validate: (input: string) => input.length > 0 || 'Model name is required'
      },
      {
        type: 'number',
        name: 'temperature',
        message: 'Temperature (0.0 - 2.0):',
        default: 0.7,
        validate: (input: number) => {
          if (input >= 0 && input <= 2) {
            return true;
          }
          return 'Temperature must be between 0.0 and 2.0';
        }
      }
    ]);

    return {
      type: LMProviderType.OPENAI_COMPATIBLE,
      baseUrl: answers.baseUrl,
      apiKey: answers.apiKey,
      model: answers.model,
      temperature: answers.temperature
    };
  }

  // Convert provider config to BotConfig format
  toBotConfig(providerConfig: LMProviderConfig): BotConfig {
    if (providerConfig.type === LMProviderType.OLLAMA) {
      return {
        apiKey: 'ollama', // Placeholder for Ollama
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model,
        temperature: providerConfig.temperature
      };
    } else {
      return {
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model,
        temperature: providerConfig.temperature
      };
    }
  }

  // Save provider config to config manager
  saveProviderConfig(providerConfig: LMProviderConfig, configManager: any): void {
    configManager.saveLMProviderConfig(providerConfig.type, providerConfig);
  }
}
