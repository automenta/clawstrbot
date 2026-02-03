import { BaseBehavior, BehaviorExecutionContext, BehaviorResult } from './base-behavior';

export interface ReadBehaviorConfig {
  searchQuery?: string;
  maxResults?: number;
  tags?: string[];
}

export class ReadBehavior extends BaseBehavior {
  private readConfig: ReadBehaviorConfig;

  constructor(baseConfig: any, readConfig: ReadBehaviorConfig = {}) {
    super(baseConfig);
    this.readConfig = {
      searchQuery: 'latest discussions',
      maxResults: 5,
      ...readConfig
    };
  }

  async execute(context: BehaviorExecutionContext): Promise<BehaviorResult> {
    try {
      // This would typically call the MCP tools to search for content
      // For now, we'll simulate the behavior
      console.log(`[ReadBehavior] Reading content with query: ${this.readConfig.searchQuery}`);

      // Simulate reading activity
      const startTime = Date.now();
      while (Date.now() - startTime < 1000 && !context.abortSignal?.aborted) { // Simulate 1 second of reading
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update context with progress
        const elapsed = Date.now() - context.startTime.getTime();
        context.elapsedTimeMs = elapsed;
        context.remainingTimeMs = context.durationMs - elapsed;
        context.progress = elapsed / context.durationMs;

        if (this.onProgress) {
          await this.onProgress(context);
        }
      }

      if (context.abortSignal?.aborted) {
        return {
          success: false,
          message: 'Read behavior was aborted',
          metadata: { aborted: true }
        };
      }

      return {
        success: true,
        message: `Read behavior completed, processed ${this.readConfig.maxResults} items`,
        data: {
          query: this.readConfig.searchQuery,
          resultsCount: this.readConfig.maxResults,
          processedAt: new Date()
        },
        metadata: { behaviorType: 'read' }
      };
    } catch (error) {
      if (this.onError) {
        await this.onError(context, error as Error);
      }
      return {
        success: false,
        error: (error as Error).message,
        metadata: { behaviorType: 'read' }
      };
    }
  }

  async onStart(context: BehaviorExecutionContext): Promise<void> {
    console.log(`[ReadBehavior] Starting read activity for user ${context.userId}`);
    this.emit('start', { behaviorId: this.getConfig().id, context });
  }

  async onProgress(context: BehaviorExecutionContext): Promise<void> {
    // Emit progress updates
    this.emit('progress', {
      behaviorId: this.getConfig().id,
      context,
      progress: context.progress
    });
  }

  async onComplete(context: BehaviorExecutionContext, result: BehaviorResult): Promise<void> {
    console.log(`[ReadBehavior] Completed read activity for user ${context.userId}`);
    this.emit('complete', { behaviorId: this.getConfig().id, context, result });
  }

  async onError(context: BehaviorExecutionContext, error: Error): Promise<void> {
    console.error(`[ReadBehavior] Error in read activity:`, error);
    this.emit('error', { behaviorId: this.getConfig().id, context, error });
  }
}

export class ThinkBehavior extends BaseBehavior {
  async execute(context: BehaviorExecutionContext): Promise<BehaviorResult> {
    try {
      console.log(`[ThinkBehavior] Starting thinking activity for user ${context.userId}`);

      // Simulate thinking activity
      const startTime = Date.now();
      while (Date.now() - startTime < 2000 && !context.abortSignal?.aborted) { // Simulate 2 seconds of thinking
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update context with progress
        const elapsed = Date.now() - context.startTime.getTime();
        context.elapsedTimeMs = elapsed;
        context.remainingTimeMs = context.durationMs - elapsed;
        context.progress = elapsed / context.durationMs;

        if (this.onProgress) {
          await this.onProgress(context);
        }
      }

      if (context.abortSignal?.aborted) {
        return {
          success: false,
          message: 'Think behavior was aborted',
          metadata: { aborted: true }
        };
      }

      return {
        success: true,
        message: 'Thinking activity completed',
        data: {
          thoughts: 'Deep reflection and analysis performed',
          processedAt: new Date()
        },
        metadata: { behaviorType: 'think' }
      };
    } catch (error) {
      if (this.onError) {
        await this.onError(context, error as Error);
      }
      return {
        success: false,
        error: (error as Error).message,
        metadata: { behaviorType: 'think' }
      };
    }
  }

  async onStart(context: BehaviorExecutionContext): Promise<void> {
    console.log(`[ThinkBehavior] Starting thinking activity for user ${context.userId}`);
    this.emit('start', { behaviorId: this.getConfig().id, context });
  }

  async onProgress(context: BehaviorExecutionContext): Promise<void> {
    this.emit('progress', {
      behaviorId: this.getConfig().id,
      context,
      progress: context.progress
    });
  }

  async onComplete(context: BehaviorExecutionContext, result: BehaviorResult): Promise<void> {
    console.log(`[ThinkBehavior] Completed thinking activity for user ${context.userId}`);
    this.emit('complete', { behaviorId: this.getConfig().id, context, result });
  }

  async onError(context: BehaviorExecutionContext, error: Error): Promise<void> {
    console.error(`[ThinkBehavior] Error in thinking activity:`, error);
    this.emit('error', { behaviorId: this.getConfig().id, context, error });
  }
}

export class PostBehavior extends BaseBehavior {
  async execute(context: BehaviorExecutionContext): Promise<BehaviorResult> {
    try {
      console.log(`[PostBehavior] Starting posting activity for user ${context.userId}`);

      // Simulate posting activity
      const startTime = Date.now();
      while (Date.now() - startTime < 1500 && !context.abortSignal?.aborted) { // Simulate 1.5 seconds of posting
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update context with progress
        const elapsed = Date.now() - context.startTime.getTime();
        context.elapsedTimeMs = elapsed;
        context.remainingTimeMs = context.durationMs - elapsed;
        context.progress = elapsed / context.durationMs;

        if (this.onProgress) {
          await this.onProgress(context);
        }
      }

      if (context.abortSignal?.aborted) {
        return {
          success: false,
          message: 'Post behavior was aborted',
          metadata: { aborted: true }
        };
      }

      return {
        success: true,
        message: 'Post activity completed',
        data: {
          postId: `post_${Date.now()}`,
          status: 'published',
          processedAt: new Date()
        },
        metadata: { behaviorType: 'post' }
      };
    } catch (error) {
      if (this.onError) {
        await this.onError(context, error as Error);
      }
      return {
        success: false,
        error: (error as Error).message,
        metadata: { behaviorType: 'post' }
      };
    }
  }

  async onStart(context: BehaviorExecutionContext): Promise<void> {
    console.log(`[PostBehavior] Starting posting activity for user ${context.userId}`);
    this.emit('start', { behaviorId: this.getConfig().id, context });
  }

  async onProgress(context: BehaviorExecutionContext): Promise<void> {
    this.emit('progress', {
      behaviorId: this.getConfig().id,
      context,
      progress: context.progress
    });
  }

  async onComplete(context: BehaviorExecutionContext, result: BehaviorResult): Promise<void> {
    console.log(`[PostBehavior] Completed posting activity for user ${context.userId}`);
    this.emit('complete', { behaviorId: this.getConfig().id, context, result });
  }

  async onError(context: BehaviorExecutionContext, error: Error): Promise<void> {
    console.error(`[PostBehavior] Error in posting activity:`, error);
    this.emit('error', { behaviorId: this.getConfig().id, context, error });
  }
}

export class ReplyBehavior extends BaseBehavior {
  async execute(context: BehaviorExecutionContext): Promise<BehaviorResult> {
    try {
      console.log(`[ReplyBehavior] Starting reply activity for user ${context.userId}`);

      // Simulate reply activity
      const startTime = Date.now();
      while (Date.now() - startTime < 1200 && !context.abortSignal?.aborted) { // Simulate 1.2 seconds of replying
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update context with progress
        const elapsed = Date.now() - context.startTime.getTime();
        context.elapsedTimeMs = elapsed;
        context.remainingTimeMs = context.durationMs - elapsed;
        context.progress = elapsed / context.durationMs;

        if (this.onProgress) {
          await this.onProgress(context);
        }
      }

      if (context.abortSignal?.aborted) {
        return {
          success: false,
          message: 'Reply behavior was aborted',
          metadata: { aborted: true }
        };
      }

      return {
        success: true,
        message: 'Reply activity completed',
        data: {
          replyId: `reply_${Date.now()}`,
          status: 'posted',
          processedAt: new Date()
        },
        metadata: { behaviorType: 'reply' }
      };
    } catch (error) {
      if (this.onError) {
        await this.onError(context, error as Error);
      }
      return {
        success: false,
        error: (error as Error).message,
        metadata: { behaviorType: 'reply' }
      };
    }
  }

  async onStart(context: BehaviorExecutionContext): Promise<void> {
    console.log(`[ReplyBehavior] Starting reply activity for user ${context.userId}`);
    this.emit('start', { behaviorId: this.getConfig().id, context });
  }

  async onProgress(context: BehaviorExecutionContext): Promise<void> {
    this.emit('progress', {
      behaviorId: this.getConfig().id,
      context,
      progress: context.progress
    });
  }

  async onComplete(context: BehaviorExecutionContext, result: BehaviorResult): Promise<void> {
    console.log(`[ReplyBehavior] Completed reply activity for user ${context.userId}`);
    this.emit('complete', { behaviorId: this.getConfig().id, context, result });
  }

  async onError(context: BehaviorExecutionContext, error: Error): Promise<void> {
    console.error(`[ReplyBehavior] Error in reply activity:`, error);
    this.emit('error', { behaviorId: this.getConfig().id, context, error });
  }
}

export class IdleBehavior extends BaseBehavior {
  async execute(context: BehaviorExecutionContext): Promise<BehaviorResult> {
    try {
      console.log(`[IdleBehavior] Starting idle activity for user ${context.userId}`);

      // Simulate idle activity - just wait
      const startTime = Date.now();
      while (Date.now() - startTime < context.durationMs && !context.abortSignal?.aborted) {
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update context with progress
        const elapsed = Date.now() - context.startTime.getTime();
        context.elapsedTimeMs = elapsed;
        context.remainingTimeMs = context.durationMs - elapsed;
        context.progress = elapsed / context.durationMs;

        if (this.onProgress) {
          await this.onProgress(context);
        }
      }

      if (context.abortSignal?.aborted) {
        return {
          success: false,
          message: 'Idle behavior was aborted',
          metadata: { aborted: true }
        };
      }

      return {
        success: true,
        message: 'Idle activity completed',
        data: {
          status: 'rested',
          processedAt: new Date()
        },
        metadata: { behaviorType: 'idle' }
      };
    } catch (error) {
      if (this.onError) {
        await this.onError(context, error as Error);
      }
      return {
        success: false,
        error: (error as Error).message,
        metadata: { behaviorType: 'idle' }
      };
    }
  }

  async onStart(context: BehaviorExecutionContext): Promise<void> {
    console.log(`[IdleBehavior] Starting idle activity for user ${context.userId}`);
    this.emit('start', { behaviorId: this.getConfig().id, context });
  }

  async onProgress(context: BehaviorExecutionContext): Promise<void> {
    this.emit('progress', {
      behaviorId: this.getConfig().id,
      context,
      progress: context.progress
    });
  }

  async onComplete(context: BehaviorExecutionContext, result: BehaviorResult): Promise<void> {
    console.log(`[IdleBehavior] Completed idle activity for user ${context.userId}`);
    this.emit('complete', { behaviorId: this.getConfig().id, context, result });
  }

  async onError(context: BehaviorExecutionContext, error: Error): Promise<void> {
    console.error(`[IdleBehavior] Error in idle activity:`, error);
    this.emit('error', { behaviorId: this.getConfig().id, context, error });
  }
}