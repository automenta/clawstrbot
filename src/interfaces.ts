import { MemoryItem } from './memory-system';

// Interface for bot capabilities that agents can use
export interface BotInterface {
  processInput(input: string): Promise<string>;
  runWithSystemPrompt(userInput: string, systemPrompt: string): Promise<string>;
  addMemory(content: string, type: string, priority?: number, tags?: string[], metadata?: Record<string, any>): string;
  getMemory(id: string): MemoryItem | undefined;
  updateMemory(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'timestamp'>>): boolean;
  removeMemory(id: string): boolean;
  findMemoriesByType(type: string, limit?: number): MemoryItem[];
  findMemoriesByTag(tag: string, limit?: number): MemoryItem[];
  searchMemories(query: string, limit?: number): MemoryItem[];
  getAllMemories(limit?: number): MemoryItem[];
  getMemoriesByPriority(minPriority: number, maxPriority: number, limit?: number): MemoryItem[];
  getMemoryStats(): { size: number; maxSize: number; utilization: number };
  clearMemory(): void;
  getHistory(): any[];
  getConfig(): any;
}

// Interface for agent capabilities that behaviors can use
export interface AgentInterface {
  executeAction(actionName: string, params: Record<string, any>): Promise<any>;
  addMemory?(content: string, type: string, priority?: number, tags?: string[], metadata?: Record<string, any>): string;
  searchMemories?(query: string, limit?: number): any[];
}

// Interface for behavior execution context
export interface BehaviorContext {
  userId: string;
  agent: AgentInterface;
  bot: BotInterface;
  startTime: Date;
  durationMs: number;
  elapsedTimeMs: number;
  remainingTimeMs: number;
  progress: number; // 0 to 1
  abortSignal?: AbortSignal;
  [key: string]: any; // Additional context fields
}