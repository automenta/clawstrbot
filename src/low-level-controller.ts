import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Message, BotConfig } from './bot';

export interface LowLevelBotControllerOptions {
  enableDirectAccess?: boolean;
  enableStateManagement?: boolean;
  enableEventLogging?: boolean;
}

export class LowLevelBotController {
  private llm: ChatOpenAI;
  private config: BotConfig;
  private history: Message[] = [];
  private callbacks: Map<string, Function> = new Map();
  private eventLog: any[] = [];
  private options: LowLevelBotControllerOptions;

  constructor(config: BotConfig, options: LowLevelBotControllerOptions = {}) {
    this.config = config;
    this.options = { 
      enableDirectAccess: true, 
      enableStateManagement: true, 
      enableEventLogging: true,
      ...options 
    };
    
    this.llm = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: config.model || "gpt-3.5-turbo",
      temperature: config.temperature || 0.7,
      configuration: {
        baseURL: config.baseUrl,
      }
    });
  }

  // Direct LLM access methods
  async callLLM(messages: BaseMessage[]): Promise<any> {
    if (!this.options.enableDirectAccess) {
      throw new Error('Direct LLM access is disabled');
    }

    const chain = RunnableSequence.from([
      (input: BaseMessage[]) => input,
      this.llm,
      new StringOutputParser()
    ]);

    const result = await chain.invoke(messages);
    
    if (this.options.enableEventLogging) {
      this.logEvent('llm_call', { messages, result });
    }

    return result;
  }

  // History management
  getHistory(): Message[] {
    return [...this.history];
  }

  setHistory(history: Message[]): void {
    this.history = history.map(msg => ({ ...msg }));
    
    if (this.options.enableEventLogging) {
      this.logEvent('history_set', { count: history.length });
    }
  }

  appendToHistory(message: Message): void {
    this.history.push({ ...message });
    
    if (this.options.enableEventLogging) {
      this.logEvent('history_append', { message });
    }
  }

  clearHistory(): void {
    this.history = [];
    
    if (this.options.enableEventLogging) {
      this.logEvent('history_clear', {});
    }
  }

  // State management
  getState(): any {
    if (!this.options.enableStateManagement) {
      throw new Error('State management is disabled');
    }

    return {
      config: { ...this.config },
      history: [...this.history],
      eventLog: [...this.eventLog],
      callbacks: Array.from(this.callbacks.entries())
    };
  }

  setState(state: any): void {
    if (!this.options.enableStateManagement) {
      throw new Error('State management is disabled');
    }

    if (state.config) {
      this.config = { ...state.config };
      this.llm = new ChatOpenAI({
        openAIApiKey: this.config.apiKey,
        modelName: this.config.model || "gpt-3.5-turbo",
        temperature: this.config.temperature || 0.7,
        configuration: {
          baseURL: this.config.baseUrl,
        }
      });
    }

    if (state.history) {
      this.history = state.history.map((msg: Message) => ({ ...msg }));
    }

    if (state.eventLog) {
      this.eventLog = [...state.eventLog];
    }

    if (state.callbacks) {
      this.callbacks = new Map(state.callbacks);
    }
  }

  // Configuration management
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

    if (this.options.enableEventLogging) {
      this.logEvent('config_update', { config });
    }
  }

  getConfig(): BotConfig {
    return { ...this.config };
  }

  // Callback management for extensibility
  registerCallback(event: string, callback: Function): void {
    this.callbacks.set(event, callback);
    
    if (this.options.enableEventLogging) {
      this.logEvent('callback_register', { event });
    }
  }

  unregisterCallback(event: string): boolean {
    const result = this.callbacks.delete(event);
    
    if (this.options.enableEventLogging) {
      this.logEvent('callback_unregister', { event });
    }
    
    return result;
  }

  triggerCallback(event: string, ...args: any[]): any {
    const callback = this.callbacks.get(event);
    if (callback) {
      return callback(...args);
    }
    return null;
  }

  // Event logging
  getEventLog(): any[] {
    return [...this.eventLog];
  }

  clearEventLog(): void {
    this.eventLog = [];
  }

  private logEvent(type: string, data: any): void {
    if (this.options.enableEventLogging) {
      this.eventLog.push({
        timestamp: new Date(),
        type,
        data
      });
    }
  }

  // Direct message processing
  async processMessages(messages: BaseMessage[]): Promise<string> {
    const chain = RunnableSequence.from([
      (input: BaseMessage[]) => input,
      this.llm,
      new StringOutputParser()
    ]);

    const result = await chain.invoke(messages);
    
    // Add to history if it's a human message followed by AI response
    if (messages.some(m => m._getType() === 'human')) {
      // Add the last human message and the AI response to history
      const lastHumanMessage = messages
        .filter(m => m._getType() === 'human')
        .pop();
      
      if (lastHumanMessage) {
        this.appendToHistory({
          role: 'user',
          content: (lastHumanMessage as any).content,
          timestamp: new Date()
        });
      }
      
      this.appendToHistory({
        role: 'assistant',
        content: result,
        timestamp: new Date()
      });
    }
    
    if (this.options.enableEventLogging) {
      this.logEvent('message_process', { messages: messages.length, resultLength: result.length });
    }

    return result;
  }

  // Utility methods for advanced control
  async interrupt(): Promise<void> {
    // In a real implementation, this would interrupt ongoing operations
    if (this.options.enableEventLogging) {
      this.logEvent('interrupt', {});
    }
  }

  async reset(): Promise<void> {
    this.history = [];
    this.eventLog = [];
    
    // Reinitialize with current config
    this.llm = new ChatOpenAI({
      openAIApiKey: this.config.apiKey,
      modelName: this.config.model || "gpt-3.5-turbo",
      temperature: this.config.temperature || 0.7,
      configuration: {
        baseURL: this.config.baseUrl,
      }
    });
    
    if (this.options.enableEventLogging) {
      this.logEvent('reset', {});
    }
  }

  // Advanced prompting
  async runWithSystemPrompt(userInput: string, systemPrompt: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userInput)
    ];

    const result = await this.callLLM(messages);
    
    // Add to history
    this.appendToHistory({
      role: 'system',
      content: systemPrompt,
      timestamp: new Date()
    });
    this.appendToHistory({
      role: 'user',
      content: userInput,
      timestamp: new Date()
    });
    this.appendToHistory({
      role: 'assistant',
      content: result,
      timestamp: new Date()
    });

    return result;
  }

  // Template-based prompting
  async runTemplate(template: string, variables: Record<string, string>): Promise<string> {
    // Replace variables in template
    let processedTemplate = template;
    for (const [key, value] of Object.entries(variables)) {
      processedTemplate = processedTemplate.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    const result = await this.callLLM([new HumanMessage(processedTemplate)]);
    
    // Add to history
    this.appendToHistory({
      role: 'user',
      content: processedTemplate,
      timestamp: new Date()
    });
    this.appendToHistory({
      role: 'assistant',
      content: result,
      timestamp: new Date()
    });

    return result;
  }
}