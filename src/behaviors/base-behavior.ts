import { EventEmitter } from 'events';

export type BehaviorType = 'read' | 'think' | 'post' | 'reply' | 'idle' | string;

export interface BehaviorConfig {
  id: string;
  name: string;
  description: string;
  type: BehaviorType;
  enabled: boolean;
  priority: number; // Lower numbers execute first
  metadata?: Record<string, any>;
}

export interface BehaviorExecutionContext {
  userId: string;
  startTime: Date;
  durationMs: number;
  elapsedTimeMs: number;
  remainingTimeMs: number;
  progress: number; // 0 to 1
  abortSignal?: AbortSignal;
  [key: string]: any; // Additional context fields
}

export interface BehaviorResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export abstract class BaseBehavior {
  protected config: BehaviorConfig;
  protected eventEmitter: EventEmitter;

  constructor(config: BehaviorConfig) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Get the behavior configuration
   */
  getConfig(): BehaviorConfig {
    return { ...this.config };
  }

  /**
   * Update the behavior configuration
   */
  updateConfig(config: Partial<BehaviorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if the behavior is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable the behavior
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Execute the behavior with the given context
   */
  abstract execute(context: BehaviorExecutionContext): Promise<BehaviorResult>;

  /**
   * Called when the behavior is started
   */
  onStart?(context: BehaviorExecutionContext): void | Promise<void>;

  /**
   * Called periodically during execution
   */
  onProgress?(context: BehaviorExecutionContext): void | Promise<void>;

  /**
   * Called when the behavior is completed
   */
  onComplete?(context: BehaviorExecutionContext, result: BehaviorResult): void | Promise<void>;

  /**
   * Called when the behavior is interrupted or fails
   */
  onError?(context: BehaviorExecutionContext, error: Error): void | Promise<void>;

  /**
   * Subscribe to behavior events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Unsubscribe from behavior events
   */
  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Emit a behavior event
   */
  protected emit(event: string, ...args: any[]): void {
    this.eventEmitter.emit(event, ...args);
  }
}

/**
 * Interface for behavior factories
 */
export interface BehaviorFactory<T extends BaseBehavior = BaseBehavior> {
  readonly type: BehaviorType;
  create(config: BehaviorConfig): T;
}

/**
 * Interface for behavior executors
 */
export interface BehaviorExecutor {
  execute(behavior: BaseBehavior, context: BehaviorExecutionContext): Promise<BehaviorResult>;
}