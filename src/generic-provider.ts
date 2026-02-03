import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { LMProviderConfig, OllamaConfig, OpenAICompatibleConfig, LMProviderType } from './lm-provider-manager';

export interface ProviderInterface {
  call(messages: BaseMessage[]): Promise<string>;
  updateConfig(newConfig: any): void;
  getConfig(): any;
}

export class GenericProvider implements ProviderInterface {
  private config: LMProviderConfig;
  private llm: ChatOpenAI;

  constructor(config: LMProviderConfig) {
    this.config = config;
    this.llm = this.createLLMInstance(config);
  }

  private createLLMInstance(config: LMProviderConfig): ChatOpenAI {
    if (config.type === LMProviderType.OLLAMA) {
      // For Ollama, we use a dummy API key since Ollama doesn't require one
      return new ChatOpenAI({
        openAIApiKey: "ollama-placeholder", 
        modelName: config.model,
        temperature: config.temperature || 0.7,
        configuration: {
          baseURL: config.baseUrl,
        }
      });
    } else {
      // For OpenAI-compatible services
      return new ChatOpenAI({
        openAIApiKey: config.apiKey,
        modelName: config.model,
        temperature: config.temperature || 0.7,
        configuration: {
          baseURL: config.baseUrl,
        }
      });
    }
  }

  async call(messages: BaseMessage[]): Promise<string> {
    const chain = RunnableSequence.from([
      (input: BaseMessage[]) => input,
      this.llm,
      new StringOutputParser()
    ]);

    return await chain.invoke(messages);
  }

  updateConfig(newConfig: LMProviderConfig): void {
    this.config = newConfig;
    this.llm = this.createLLMInstance(newConfig);
  }

  getConfig(): LMProviderConfig {
    return { ...this.config };
  }
}