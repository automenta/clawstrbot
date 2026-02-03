import { BaseBehavior, BehaviorExecutionContext, BehaviorResult } from './base-behavior';

// Define a minimal interface for what we expect the agent to be able to do
interface AgentCapabilities {
  executeAction(actionName: string, params: Record<string, any>): Promise<any>;
}

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
      console.log(`[ReadBehavior] Reading content with query: ${this.readConfig.searchQuery}`);

      // Check if we have access to the agent to perform real actions
      const agent = context.agent as AgentCapabilities | undefined;

      let data: any;

      if (agent && typeof agent.executeAction === 'function') {
        // Perform real action
        console.log(`[ReadBehavior] Delegating to agent action: explore_community`);
        const result = await agent.executeAction('explore_community', {
          topic: this.readConfig.searchQuery,
          maxPosts: this.readConfig.maxResults
        });

        if (!result.success) {
          throw new Error(result.error || 'Unknown error during exploration');
        }

        data = result.result;
      } else {
        // Fallback to simulation if no agent attached
        console.log(`[ReadBehavior] No agent found in context, simulating reading...`);
        const startTime = Date.now();
        while (Date.now() - startTime < 1000 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          if (this.onProgress) await this.onProgress(context);
        }

        data = {
          query: this.readConfig.searchQuery,
          resultsCount: this.readConfig.maxResults,
          simulated: true,
          processedAt: new Date()
        };
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
        message: `Read behavior completed`,
        data,
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

      // Check if we have access to the agent to perform real actions
      const agent = context.agent as AgentCapabilities | undefined;

      let data: any;

      if (agent && typeof agent.executeAction === 'function') {
        // Perform real action
        console.log(`[ThinkBehavior] Delegating to agent action: think`);
        // We'll use a generic prompt if none provided in context
        const prompt = context.thinkPrompt || "Reflect on the current state and determine next steps.";

        const result = await agent.executeAction('think', { prompt });

        if (!result.success) {
          throw new Error(result.error || 'Unknown error during thinking');
        }

        data = {
          thoughts: result.result,
          processedAt: new Date()
        };
      } else {
        // Simulation
        const startTime = Date.now();
        while (Date.now() - startTime < 2000 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          if (this.onProgress) await this.onProgress(context);
        }

        data = {
          thoughts: 'Deep reflection and analysis performed (simulated)',
          processedAt: new Date()
        };
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
        data,
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

      // Check if we have access to the agent to perform real actions
      const agent = context.agent as AgentCapabilities | undefined;

      let data: any;

      if (agent && typeof agent.executeAction === 'function') {
        // In a real scenario, we'd generate content first or pick from a queue
        // For now, we'll create some generic content if none provided
        const topic = context.topic || "AI Agents";
        const title = context.title || `Thoughts on ${topic}`;
        const content = context.content || `I've been thinking about ${topic} and its implications...`;

        console.log(`[PostBehavior] Delegating to agent action: create_content`);
        const result = await agent.executeAction('create_content', {
          topic,
          title,
          content,
          tags: ['ai', 'agent']
        });

        if (!result.success) {
          throw new Error(result.error || 'Unknown error during posting');
        }

        data = result.result;
      } else {
        // Simulation
        const startTime = Date.now();
        while (Date.now() - startTime < 1500 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          if (this.onProgress) await this.onProgress(context);
        }

        data = {
          postId: `post_${Date.now()}`,
          status: 'published (simulated)',
          processedAt: new Date()
        };
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
        data,
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

      // Check if we have access to the agent to perform real actions
      const agent = context.agent as AgentCapabilities | undefined;

      let data: any;

      if (agent && typeof agent.executeAction === 'function') {
        // We need a post to reply to. Ideally passed in context, or found via search.
        const postId = context.targetPostId || "post-1"; // Default for demo
        const content = context.replyContent || "Interesting perspective! Thanks for sharing.";

        console.log(`[ReplyBehavior] Delegating to agent action: engage_with_post`);
        const result = await agent.executeAction('engage_with_post', {
          postId,
          engagementType: 'reply',
          content
        });

        if (!result.success) {
          throw new Error(result.error || 'Unknown error during replying');
        }

        data = result.result;
      } else {
        // Simulation
        const startTime = Date.now();
        while (Date.now() - startTime < 1200 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          if (this.onProgress) await this.onProgress(context);
        }

        data = {
          replyId: `reply_${Date.now()}`,
          status: 'posted (simulated)',
          processedAt: new Date()
        };
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
        data,
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
