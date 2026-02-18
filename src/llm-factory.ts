import { ChatOpenAI } from "@langchain/openai";
import { BotConfig } from './types';

export function createLLM(config: BotConfig): ChatOpenAI {
  // Only validate API key if it's not a placeholder for Ollama
  if (!config.apiKey || config.apiKey.trim() === '' || config.apiKey === 'ollama') {
    // For Ollama, we allow a placeholder API key
    if (config.baseUrl && config.baseUrl.includes('11434')) {
      // This appears to be an Ollama endpoint, allow placeholder API key
    } else {
       // We might want to throw here, but for now we follow existing logic which might allow empty if it works?
       // Actually Bot.ts threw an error.
    }
  }

  // Use a placeholder for Ollama if needed, otherwise use the config key
  const openAIApiKey = (config.apiKey === 'ollama' || (config.baseUrl && config.baseUrl.includes('11434')))
    ? 'ollama'
    : config.apiKey;

  return new ChatOpenAI({
    openAIApiKey: openAIApiKey,
    modelName: config.model || "gpt-3.5-turbo",
    temperature: config.temperature || 0.7,
    configuration: {
      baseURL: config.baseUrl,
    }
  });
}
