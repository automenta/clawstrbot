import { BaseBehavior, BehaviorExecutionContext, BehaviorResult } from './base-behavior';

// Define a minimal interface for what we expect the agent to be able to do
interface AgentCapabilities {
  executeAction(actionName: string, params: Record<string, any>): Promise<any>;
  addMemory?(content: string, type: string, priority?: number, tags?: string[], metadata?: Record<string, any>): string;
  searchMemories?(query: string, limit?: number): any[];
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

        // Store the reading results in memory
        console.log(`[ReadBehavior] Attempting to store read results in memory, agent.addMemory exists: ${!!agent.addMemory}`);
        console.log(`[ReadBehavior] Context has addMemory: ${!!(context as any).addMemory}`);

        // Try to use memory methods from context if available
        const memoryHandler = agent.addMemory || (context as any).addMemory;

        if (memoryHandler) {
          const query = this.readConfig.searchQuery || 'unknown';
          const memoryContent = `Read results for query "${query}": ${JSON.stringify(result.result)}`;
          console.log(`[ReadBehavior] Creating memory: ${memoryContent.substring(0, 100)}...`);
          memoryHandler(
            memoryContent,
            'observation',
            6, // Medium-high priority for observations
            ['read', 'search', query],
            {
              query,
              results: result.result,
              timestamp: new Date().toISOString()
            }
          );
          console.log(`[ReadBehavior] Memory created successfully`);
        } else {
          console.log(`[ReadBehavior] No memory handler available (agent.addMemory: ${!!agent.addMemory}, context.addMemory: ${(context as any).addMemory ? 'yes' : 'no'})`);
        }
      } else {
        // Fallback to simulation if no agent attached
        console.log(`[ReadBehavior] No agent found in context, simulating reading...`);
        const startTime = Date.now();
        let lastProgressUpdate = Date.now();
        const progressUpdateInterval = 1000; // Update progress every 1 second instead of every 100ms

        while (Date.now() - startTime < 1000 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          // Only update progress periodically to reduce redundancy
          const now = Date.now();
          if (now - lastProgressUpdate >= progressUpdateInterval) {
            if (this.onProgress) await this.onProgress(context);
            lastProgressUpdate = now;
          }
        }

        data = {
          query: this.readConfig.searchQuery,
          resultsCount: this.readConfig.maxResults,
          simulated: true,
          processedAt: new Date()
        };

        // Even in simulation mode, store the reading results in memory
        const agent = context.agent as AgentCapabilities | undefined;
        if (agent && agent.addMemory) {
          const query = this.readConfig.searchQuery || 'unknown';
          agent.addMemory(
            `Simulated read results for query "${query}": ${data.resultsCount} items processed (simulated)`,
            'observation',
            5, // Medium priority for observations
            ['read', 'simulation', 'search', query],
            {
              query,
              resultsCount: data.resultsCount,
              timestamp: new Date().toISOString(),
              simulated: true
            }
          );
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

        // Retrieve relevant memories to inform the thinking process
        let relevantMemories = [];
        if (agent.searchMemories) {
          relevantMemories = agent.searchMemories(prompt, 5); // Get up to 5 relevant memories
        }

        const result = await agent.executeAction('think', {
          prompt,
          context: relevantMemories.length > 0 ? `Context from memory: ${JSON.stringify(relevantMemories)}` : undefined
        });

        if (!result.success) {
          throw new Error(result.error || 'Unknown error during thinking');
        }

        data = {
          thoughts: result.result,
          processedAt: new Date()
        };

        // Store the thoughts in memory
        console.log(`[ThinkBehavior] Attempting to store thoughts in memory, agent.addMemory exists: ${!!agent.addMemory}`);
        console.log(`[ThinkBehavior] Context has addMemory: ${!!(context as any).addMemory}`);

        // Try to use memory methods from context if available
        const memoryHandler = agent.addMemory || (context as any).addMemory;

        if (memoryHandler) {
          const memoryContent = `Thoughts on: ${prompt}. Result: ${JSON.stringify(result.result)}`;
          console.log(`[ThinkBehavior] Creating memory: ${memoryContent.substring(0, 100)}...`);
          memoryHandler(
            memoryContent,
            'thought',
            7, // High priority for thoughts
            ['think', 'reflection'],
            {
              prompt,
              result: result.result,
              timestamp: new Date().toISOString(),
              contextUsed: relevantMemories.length > 0
            }
          );
          console.log(`[ThinkBehavior] Memory created successfully`);
        } else {
          console.log(`[ThinkBehavior] No memory handler available (agent.addMemory: ${!!agent.addMemory}, context.addMemory: ${(context as any).addMemory ? 'yes' : 'no'})`);
        }
      } else {
        // Simulation
        const startTime = Date.now();
        let lastProgressUpdate = Date.now();
        const progressUpdateInterval = 1000; // Update progress every 1 second instead of every 100ms

        while (Date.now() - startTime < 2000 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          // Only update progress periodically to reduce redundancy
          const now = Date.now();
          if (now - lastProgressUpdate >= progressUpdateInterval) {
            if (this.onProgress) await this.onProgress(context);
            lastProgressUpdate = now;
          }
        }

        data = {
          thoughts: 'Deep reflection and analysis performed (simulated)',
          processedAt: new Date()
        };

        // Even in simulation mode, store the thoughts in memory
        if (agent && agent.addMemory) {
          const prompt = context.thinkPrompt || "Reflection on current state";
          agent.addMemory(
            `Simulated thoughts on: ${prompt}. Result: Deep reflection and analysis performed (simulated)`,
            'thought',
            6, // Medium-high priority for thoughts
            ['think', 'simulation', 'reflection'],
            {
              prompt,
              result: 'Deep reflection and analysis performed (simulated)',
              timestamp: new Date().toISOString(),
              simulated: true
            }
          );
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

        // Retrieve relevant memories to inform the post creation
        let relevantMemories = [];
        if (agent.searchMemories) {
          relevantMemories = agent.searchMemories(topic, 3); // Get up to 3 relevant memories about the topic
        }

        console.log(`[PostBehavior] Delegating to agent action: create_content`);
        const result = await agent.executeAction('create_content', {
          topic,
          title,
          content: relevantMemories.length > 0
            ? `${content}\n\nBased on previous thoughts: ${JSON.stringify(relevantMemories.map(m => m.content))}`
            : content,
          tags: ['ai', 'agent', ...relevantMemories.flatMap(m => m.tags || [])]
        });

        if (!result.success) {
          throw new Error(result.error || 'Unknown error during posting');
        }

        data = result.result;

        // Store the post in memory
        if (agent.addMemory) {
          const memoryContent = `Posted: ${title}. Content: ${content}`;
          agent.addMemory(
            memoryContent,
            'interaction',
            5, // Medium priority for interactions
            ['post', topic, ...relevantMemories.flatMap(m => m.tags || [])],
            {
              topic,
              title,
              content,
              postId: result.result?.postId || 'unknown',
              timestamp: new Date().toISOString(),
              contextUsed: relevantMemories.length > 0
            }
          );
        }
      } else {
        // Simulation
        const startTime = Date.now();
        let lastProgressUpdate = Date.now();
        const progressUpdateInterval = 1000; // Update progress every 1 second instead of every 100ms

        while (Date.now() - startTime < 1500 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          // Only update progress periodically to reduce redundancy
          const now = Date.now();
          if (now - lastProgressUpdate >= progressUpdateInterval) {
            if (this.onProgress) await this.onProgress(context);
            lastProgressUpdate = now;
          }
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

        // Retrieve relevant memories to inform the reply
        let relevantMemories = [];
        if (agent.searchMemories) {
          relevantMemories = agent.searchMemories(content, 3); // Get up to 3 relevant memories
        }

        console.log(`[ReplyBehavior] Delegating to agent action: engage_with_post`);
        const result = await agent.executeAction('engage_with_post', {
          postId,
          engagementType: 'reply',
          content: relevantMemories.length > 0
            ? `${content}\n\nBased on previous thoughts: ${JSON.stringify(relevantMemories.map(m => m.content))}`
            : content
        });

        if (!result.success) {
          throw new Error(result.error || 'Unknown error during replying');
        }

        data = result.result;

        // Store the reply in memory
        if (agent.addMemory) {
          const memoryContent = `Replied to post ${postId}: ${content}`;
          agent.addMemory(
            memoryContent,
            'interaction',
            5, // Medium priority for interactions
            ['reply', 'engagement'],
            {
              postId,
              content,
              replyId: result.result?.replyId || 'unknown',
              timestamp: new Date().toISOString(),
              contextUsed: relevantMemories.length > 0
            }
          );
        }
      } else {
        // Simulation
        const startTime = Date.now();
        let lastProgressUpdate = Date.now();
        const progressUpdateInterval = 1000; // Update progress every 1 second instead of every 100ms

        while (Date.now() - startTime < 1200 && !context.abortSignal?.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));

          const elapsed = Date.now() - context.startTime.getTime();
          context.elapsedTimeMs = elapsed;
          context.remainingTimeMs = context.durationMs - elapsed;
          context.progress = elapsed / context.durationMs;

          // Only update progress periodically to reduce redundancy
          const now = Date.now();
          if (now - lastProgressUpdate >= progressUpdateInterval) {
            if (this.onProgress) await this.onProgress(context);
            lastProgressUpdate = now;
          }
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
      let lastProgressUpdate = Date.now();
      const progressUpdateInterval = 1000; // Update progress every 1 second instead of every 100ms

      while (Date.now() - startTime < context.durationMs && !context.abortSignal?.aborted) {
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update context with progress
        const elapsed = Date.now() - context.startTime.getTime();
        context.elapsedTimeMs = elapsed;
        context.remainingTimeMs = context.durationMs - elapsed;
        context.progress = elapsed / context.durationMs;

        // Only update progress periodically to reduce redundancy
        const now = Date.now();
        if (now - lastProgressUpdate >= progressUpdateInterval) {
          if (this.onProgress) {
            await this.onProgress(context);
          }
          lastProgressUpdate = now;
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
