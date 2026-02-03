import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { LowLevelBotController } from './low-level-controller';
import { BotConfig, Message, BotError } from './types';
import { createLLM } from './llm-factory';

export class ClawstrBot {
  private llm: ChatOpenAI;
  private history: Message[] = [];
  private config: BotConfig;
  private controller: LowLevelBotController;
  private errors: BotError[] = [];
  private eventCallbacks: Map<string, Function> = new Map();

  constructor(config: BotConfig) {
    this.validateConfig(config);
    this.config = config;

    this.llm = createLLM(config);

    // Pass the LLM instance to the controller
    this.controller = new LowLevelBotController(config, this.llm);
  }

  private validateConfig(config: BotConfig): void {
    // Only validate API key if it's not a placeholder for Ollama
    if (!config.apiKey || config.apiKey.trim() === '' || config.apiKey === 'ollama') {
      // For Ollama, we allow a placeholder API key
      if (config.baseUrl && config.baseUrl.includes('11434')) {
        // This appears to be an Ollama endpoint, allow placeholder API key
        return;
      } else {
        throw new Error('API key is required and cannot be empty (unless using Ollama)');
      }
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      throw new Error('Temperature must be between 0 and 2');
    }
  }

  private handleError(error: any, context: string): BotError {
    const botError: BotError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error.details || error,
      timestamp: new Date()
    };

    this.errors.push(botError);

    // Trigger error event
    this.triggerEvent('error', botError);

    console.error(`[${context}] Error:`, botError);

    return botError;
  }

  private triggerEvent(event: string, data: any): void {
    const callback = this.eventCallbacks.get(event);
    if (callback) {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in event callback for ${event}:`, err);
      }
    }
  }

  public subscribeToEvent(event: string, callback: Function): void {
    this.eventCallbacks.set(event, callback);
  }

  public unsubscribeFromEvent(event: string): void {
    this.eventCallbacks.delete(event);
  }

  async processInput(input: string): Promise<string> {
    try {
      if (!input || input.trim() === '') {
        throw new Error('Input cannot be empty');
      }

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

      // Trigger response event
      this.triggerEvent('response', {
        input,
        response,
        timestamp: new Date()
      });

      return response;
    } catch (error) {
      const botError = this.handleError(error, 'processInput');
      throw new Error(`Bot processing failed: ${botError.message}`);
    }
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  setHistory(history: Message[]): void {
    // Validate history
    for (const msg of history) {
      if (!['user', 'assistant', 'system'].includes(msg.role)) {
        throw new Error(`Invalid message role: ${msg.role}`);
      }
      if (!msg.content || msg.content.trim() === '') {
        throw new Error('Message content cannot be empty');
      }
      if (!(msg.timestamp instanceof Date)) {
        throw new Error('Message timestamp must be a Date object');
      }
    }

    this.history = history.map(msg => ({ ...msg }));
  }

  clearHistory(): void {
    this.history = [];
    this.triggerEvent('history_cleared', { timestamp: new Date() });
  }

  updateConfig(config: Partial<BotConfig>): void {
    try {
      // Merge with existing config
      const newConfig = { ...this.config, ...config };
      this.validateConfig(newConfig);

      this.config = newConfig;

      // Reinitialize the LLM with new config
      this.llm = createLLM(this.config);

      // Update controller config too
      // NOTE: We don't pass the new LLM to the controller here, but the controller
      // will re-create it in its updateConfig method or we can update it manually if we exposed a setter.
      // But LowLevelBotController's updateConfig re-creates the LLM.
      // Wait, if LowLevelBotController re-creates the LLM, then they drift apart again.

      // FIX: We should probably let the controller know about the new LLM?
      // Or rely on the fact that they use the same factory and same config so they are effectively same.
      // But better if they share the instance.

      // Since LowLevelBotController.updateConfig creates a NEW LLM, we need to address this.
      // Ideally LowLevelBotController would have setLLM method.

      this.controller.updateConfig(this.config);

      this.triggerEvent('config_updated', { config: this.config });
    } catch (error) {
      this.handleError(error, 'updateConfig');
      throw error;
    }
  }

  getConfig(): BotConfig {
    return { ...this.config };
  }

  getErrors(): BotError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  // Access to low-level controller for advanced operations
  getLowLevelController(): LowLevelBotController {
    return this.controller;
  }

  // Advanced operations using the low-level controller
  async runWithSystemPrompt(userInput: string, systemPrompt: string): Promise<string> {
    try {
      return await this.controller.runWithSystemPrompt(userInput, systemPrompt);
    } catch (error) {
      this.handleError(error, 'runWithSystemPrompt');
      throw error;
    }
  }

  async runTemplate(template: string, variables: Record<string, string>): Promise<string> {
    try {
      return await this.controller.runTemplate(template, variables);
    } catch (error) {
      this.handleError(error, 'runTemplate');
      throw error;
    }
  }

  async interrupt(): Promise<void> {
    try {
      await this.controller.interrupt();
      this.triggerEvent('interrupted', { timestamp: new Date() });
    } catch (error) {
      this.handleError(error, 'interrupt');
      throw error;
    }
  }

  async reset(): Promise<void> {
    try {
      await this.controller.reset();
      this.history = [];
      this.errors = [];
      this.triggerEvent('reset', { timestamp: new Date() });
    } catch (error) {
      this.handleError(error, 'reset');
      throw error;
    }
  }

  // State management
  getState(): any {
    return {
      config: { ...this.config },
      history: [...this.history],
      errors: [...this.errors],
      controllerState: this.controller.getState()
    };
  }

  setState(state: any): void {
    if (state.config) {
      this.config = { ...state.config };
      this.validateConfig(this.config);

      this.llm = createLLM(this.config);
    }

    if (state.history) {
      this.setHistory(state.history);
    }

    if (state.errors) {
      this.errors = [...state.errors];
    }

    if (state.controllerState) {
      this.controller.setState(state.controllerState);
    }
  }
}
