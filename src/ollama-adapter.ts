import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { OllamaConfig } from './lm-provider-manager';

// Ollama doesn't have a specific LangChain integration, so we'll use the OpenAI-compatible interface
// with a custom configuration to work with Ollama's API
export class OllamaAdapter {
  private config: OllamaConfig;
  private llm: ChatOpenAI;

  constructor(config: OllamaConfig) {
    this.config = config;

    // Configure ChatOpenAI to work with Ollama's API
    this.llm = new ChatOpenAI({
      openAIApiKey: "ollama", // Ollama doesn't require a real API key
      modelName: config.model,
      temperature: config.temperature || 0.7,
      configuration: {
        baseURL: config.baseUrl, // Ollama endpoint
      }
    });
  }

  async call(messages: BaseMessage[]): Promise<string> {
    const chain = RunnableSequence.from([
      (input: BaseMessage[]) => input,
      this.llm,
      new StringOutputParser()
    ]);

    return await chain.invoke(messages);
  }

  updateConfig(newConfig: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Reconfigure the LLM with new settings
    this.llm = new ChatOpenAI({
      openAIApiKey: "ollama",
      modelName: this.config.model,
      temperature: this.config.temperature || 0.7,
      configuration: {
        baseURL: this.config.baseUrl,
      }
    });
  }

  getConfig(): OllamaConfig {
    return { ...this.config };
  }
}