import { EventEmitter } from 'events';
import { BehaviorRegistry } from './behaviors/behavior-registry';
import { BaseBehavior, BehaviorExecutionContext, BehaviorResult } from './behaviors/base-behavior';

export type ActivityType = 'read' | 'think' | 'post' | 'reply' | 'idle' | string;

export interface ActivityDistribution {
  read: number;    // Probability percentage (0-100)
  think: number;   // Probability percentage (0-100)
  post: number;    // Probability percentage (0-100)
  reply: number;   // Probability percentage (0-100)
  idle: number;    // Probability percentage (0-100)
  [key: string]: number; // Support for custom behavior types
}

export interface ActivityTiming {
  minDuration: number;  // Minimum duration in seconds
  maxDuration: number;  // Maximum duration in seconds
}

export interface ActivitySchedulerConfig {
  distribution: ActivityDistribution;
  timing: {
    [key in ActivityType]: ActivityTiming;
  };
  enableLogging?: boolean;
  userId?: string; // User ID for context
  behaviorRegistry?: BehaviorRegistry; // Optional behavior registry
  contextData?: Record<string, any>; // Additional context data to pass to behaviors
}

export interface ActivityEvent {
  type: ActivityType;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  scheduledDurationMs: number;
}

export class ActivityScheduler extends EventEmitter {
  private config: ActivitySchedulerConfig;
  private isRunning: boolean = false;
  private currentActivity: ActivityEvent | null = null;
  private behaviorRegistry: BehaviorRegistry;

  constructor(config: ActivitySchedulerConfig) {
    super();

    // Validate distribution sums to 100%
    const total = Object.values(config.distribution).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Activity distribution must sum to 100%, got ${total}%`);
    }

    // Validate probabilities are non-negative
    for (const [key, value] of Object.entries(config.distribution)) {
      if (value < 0) {
        throw new Error(`Activity distribution for ${key} cannot be negative, got ${value}%`);
      }
    }

    this.config = config;

    // Initialize behavior registry
    this.behaviorRegistry = config.behaviorRegistry || BehaviorRegistry.getInstance();
  }

  /**
   * Schedule the next activity based on the probability distribution
   */
  private scheduleNextActivity(): ActivityType {
    const randomValue = Math.random() * 100;
    let cumulativeProbability = 0;

    for (const [activity, probability] of Object.entries(this.config.distribution)) {
      cumulativeProbability += probability;
      if (randomValue <= cumulativeProbability) {
        return activity as ActivityType;
      }
    }

    // Fallback to the last activity type if rounding errors occur
    return Object.keys(this.config.distribution)[Object.keys(this.config.distribution).length - 1] as ActivityType;
  }

  /**
   * Get random duration for an activity based on configured timing
   */
  private getActivityDuration(activityType: ActivityType): number {
    const timing = this.config.timing[activityType] || this.config.timing['idle']; // fallback to idle timing
    const minMs = timing.minDuration * 1000;
    const maxMs = timing.maxDuration * 1000;

    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }

  /**
   * Start the activity scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Activity scheduler is already running');
    }

    this.isRunning = true;
    this.log('Activity scheduler started');

    while (this.isRunning) {
      try {
        await this.performNextActivity();
      } catch (error) {
        this.log(`Error performing activity: ${error}`);
        // Wait a bit before continuing to avoid rapid error loops
        await this.wait(5000);
      }
    }
  }

  /**
   * Perform the next scheduled activity
   */
  private async performNextActivity(): Promise<void> {
    const activityType = this.scheduleNextActivity();
    const scheduledDurationMs = this.getActivityDuration(activityType);

    this.log(`Scheduled activity: ${activityType} for ${scheduledDurationMs}ms`);

    // Record start time
    const startTime = new Date();
    this.currentActivity = {
      type: activityType,
      startTime,
      scheduledDurationMs
    };

    // Emit activity start event
    this.emit('activityStart', {
      type: activityType,
      startTime,
      scheduledDurationMs
    });

    // Perform the activity using the behavior system
    const actualEndTime = await this.executeBehaviorActivity(activityType, scheduledDurationMs);

    // Calculate actual duration
    const actualDurationMs = actualEndTime.getTime() - startTime.getTime();

    // Update current activity with end time and duration
    if (this.currentActivity) {
      this.currentActivity.endTime = actualEndTime;
      this.currentActivity.durationMs = actualDurationMs;
    }

    // Emit activity completion event
    this.emit('activityComplete', {
      type: activityType,
      startTime,
      endTime: actualEndTime,
      durationMs: actualDurationMs,
      scheduledDurationMs
    });

    this.log(`Completed activity: ${activityType} (actual: ${actualDurationMs}ms, scheduled: ${scheduledDurationMs}ms)`);
  }

  /**
   * Execute the specified behavior activity for the given duration
   */
  private async executeBehaviorActivity(activityType: ActivityType, durationMs: number): Promise<Date> {
    // Create abort controller for this activity
    const abortController = new AbortController();

    // Set up a timeout to abort the activity if it takes too long
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, durationMs + 1000); // Add 1 second buffer

    try {
      // Create execution context
      const context: BehaviorExecutionContext = {
        userId: this.config.userId || 'anonymous',
        startTime: new Date(),
        durationMs,
        elapsedTimeMs: 0,
        remainingTimeMs: durationMs,
        progress: 0,
        abortSignal: abortController.signal,
        ...this.config.contextData // Spread additional context data
      };

      // Look for a behavior that matches this activity type
      const behaviors = this.behaviorRegistry.getByType(activityType as any);

      if (behaviors.length > 0) {
        // Use the first available behavior of this type
        const behavior = behaviors[0];

        // Execute the behavior
        const result: BehaviorResult = await behavior.execute(context);

        this.log(`Behavior ${behavior.getConfig().id} completed with result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);

        return new Date();
      } else {
        // If no behavior is found for this type, fall back to default behavior
        this.log(`No behavior found for type ${activityType}, using default behavior`);
        return await this.executeDefaultActivity(activityType, durationMs, abortController);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute default activity behavior when no specific behavior is found
   */
  private async executeDefaultActivity(activityType: ActivityType, durationMs: number, abortController: AbortController): Promise<Date> {
    // For 'idle' activity, just wait for the duration
    if (activityType === 'idle') {
      await this.wait(durationMs);
      return new Date();
    }

    // For other activities, we'll simulate the activity by waiting for the duration
    // but emit periodic progress events
    const startTime = Date.now();
    const endTime = startTime + durationMs;

    // Emit progress events every 10% of the duration
    const progressInterval = Math.max(durationMs / 10, 1000); // At least every second
    let nextProgressTime = startTime + Math.min(progressInterval, 2000); // First progress after 2 sec max

    while (Date.now() < endTime && !abortController.signal.aborted) {
      const currentTime = Date.now();

      if (currentTime >= nextProgressTime) {
        const elapsed = currentTime - startTime;
        const progress = elapsed / durationMs;

        this.emit('activityProgress', {
          type: activityType,
          progress,
          elapsedMs: elapsed,
          remainingMs: endTime - currentTime
        });

        nextProgressTime += progressInterval;
      }

      // Small delay to prevent blocking
      await this.wait(Math.min(100, endTime - Date.now()));
    }

    return new Date();
  }

  /**
   * Wait for the specified number of milliseconds
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop the activity scheduler
   */
  stop(): void {
    this.isRunning = false;
    this.log('Activity scheduler stopped');
  }

  /**
   * Update the activity distribution configuration
   */
  updateDistribution(distribution: ActivityDistribution): void {
    // Validate distribution sums to 100%
    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Activity distribution must sum to 100%, got ${total}%`);
    }

    // Validate probabilities are non-negative
    for (const [key, value] of Object.entries(distribution)) {
      if (value < 0) {
        throw new Error(`Activity distribution for ${key} cannot be negative, got ${value}%`);
      }
    }

    this.config.distribution = { ...distribution };
    this.log(`Updated activity distribution: ${JSON.stringify(distribution)}`);
  }

  /**
   * Update the timing configuration
   */
  updateTiming(timing: { [key in ActivityType]: ActivityTiming }): void {
    this.config.timing = { ...timing };
    this.log(`Updated activity timing: ${JSON.stringify(timing)}`);
  }

  /**
   * Get current activity distribution
   */
  getDistribution(): ActivityDistribution {
    return { ...this.config.distribution };
  }

  /**
   * Get current timing configuration
   */
  getTiming(): { [key in ActivityType]: ActivityTiming } {
    return { ...this.config.timing };
  }

  /**
   * Get current activity status
   */
  getCurrentActivity(): ActivityEvent | null {
    return this.currentActivity ? { ...this.currentActivity } : null;
  }

  /**
   * Get the behavior registry
   */
  getBehaviorRegistry(): BehaviorRegistry {
    return this.behaviorRegistry;
  }

  /**
   * Log a message if logging is enabled
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ActivityScheduler] ${new Date().toISOString()}: ${message}`);
    }
  }

  /**
   * Get the current running status
   */
  isRunningStatus(): boolean {
    return this.isRunning;
  }
}
