import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

export interface BotConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  baseUrl?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export class ClawstrBot {
  private llm: ChatOpenAI;
  private history: Message[] = [];
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    this.llm = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: config.model || "gpt-3.5-turbo",
      temperature: config.temperature || 0.7,
      configuration: {
        baseURL: config.baseUrl,
      }
    });
  }

  async processInput(input: string): Promise<string> {
    // Add user message to history
    this.history.push({
      role: 'user',
      content: input,
      timestamp: new Date()
    });

    // Prepare messages for the LLM
    const messages: BaseMessage[] = this.history.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else {
        return new SystemMessage(msg.content);
      }
    });

    // Create a chain to process the input
    const chain = RunnableSequence.from([
      (input: BaseMessage[]) => input,
      this.llm,
      new StringOutputParser()
    ]);

    // Process the input
    const response = await chain.invoke(messages);

    // Add assistant response to history
    this.history.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });

    return response;
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  updateConfig(config: Partial<BotConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize the LLM with new config
    this.llm = new ChatOpenAI({
      openAIApiKey: this.config.apiKey,
      modelName: this.config.model || "gpt-3.5-turbo",
      temperature: this.config.temperature || 0.7,
      configuration: {
        baseURL: this.config.baseUrl,
      }
    });
  }

  setHistory(history: Message[]): void {
    this.history = history.map(msg => ({ ...msg }));
  }
}