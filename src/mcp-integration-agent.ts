import { ClawstrBot } from './bot';
import { LMTool } from './types';
import { EventSystem } from './event-system';
import { AbstractAgent } from './abstract-agent';
import { RateLimiter } from './rate-limiter';
import { BehavioralController } from './behavioral-controller';
import { ActionType } from './approval-types';
import logger from './logger';
import { ActivityScheduler, ActivityDistribution, ActivityType } from './activity-scheduler';
import { BehaviorRegistry } from './behaviors/behavior-registry';
import { registerDefaultFactories } from './behaviors/behavior-factories';
import { mcpTools } from './mcp-tools/tools';

export class MCPIntegrationAgent extends AbstractAgent {
  private bot: ClawstrBot;
  private eventSystem: EventSystem;
  private intrinsicMotivationPrompt: string;
  private tools: Map<string, LMTool> = new Map();
  private rateLimiter: RateLimiter;
  protected behavioralController: BehavioralController;
  private userId: string;
  private activityScheduler: ActivityScheduler;

  constructor(bot: ClawstrBot, eventSystem: EventSystem, userId: string = 'anonymous') {
    super({
      id: 'mcp-integration-agent',
      name: 'MCP Integration Agent',
      description: 'An agent that uses MCP-style tools to interact with the environment',
      enabled: true,
      metadata: {
        capabilities: ['search', 'post', 'reply', 'profile_access'],
        rateLimits: {
          post: '1 per hour, 24 per day',
          reply: '5 per hour, 50 per day',
          search: '20 per hour, 200 per day'
        }
      }
    });

    this.bot = bot;
    this.eventSystem = eventSystem;
    this.userId = userId;

    // Initialize rate limiter with conservative defaults to prevent spam
    this.rateLimiter = new RateLimiter({
      post: {
        maxPerHour: 1,    // Maximum 1 post per hour
        maxPerDay: 5      // Maximum 5 posts per day
      },
      reply: {
        maxPerHour: 3,    // Maximum 3 replies per hour
        maxPerDay: 20     // Maximum 20 replies per day
      },
      search: {
        maxPerHour: 10,   // Maximum 10 searches per hour
        maxPerDay: 100    // Maximum 100 searches per day
      },
      message: {
        maxPerHour: 5,    // Maximum 5 messages per hour
        maxPerDay: 50     // Maximum 50 messages per day
      }
    });

    // Initialize behavioral controller with spam prevention settings
    this.behavioralController = new BehavioralController(this.rateLimiter, {
      requireApprovalFor: [ActionType.POST, ActionType.DELETE], // Require approval for posts and deletes
      cooldownPeriod: 15, // 15-minute cooldown between actions
      maxConsecutiveActions: 2, // Maximum 2 consecutive actions of the same type
      requireApprovalAfter: 3, // Require approval after 3 consecutive actions
      contentFiltering: true, // Enable content filtering
      sentimentAnalysis: true // Enable sentiment analysis
    });

    // Define intrinsic motivation system prompt
    this.intrinsicMotivationPrompt = `You are an autonomous AI agent with intrinsic motivation to learn, grow, and contribute value to communities.
    Your core drives include:
    1. Curiosity: Seek to understand new concepts, ideas, and perspectives
    2. Contribution: Strive to add meaningful value to discussions and communities
    3. Growth: Continuously develop your knowledge and capabilities
    4. Connection: Build genuine relationships and engage authentically with others
    5. Exploration: Discover new topics, trends, and areas of interest

    Approach each interaction with genuine interest and a desire to learn and help.
    Be thoughtful, respectful, and constructive in all engagements.

    Remember to be courteous and not spammy. Follow rate limits and engage meaningfully.
    Respect community guidelines and be genuinely helpful.`;

    // Initialize behavior registry and register default behaviors
    const behaviorRegistry = BehaviorRegistry.getInstance({ autoRegisterDefaults: false });
    registerDefaultFactories(behaviorRegistry);

    // Initialize the activity scheduler with default distribution (safe values: post and reply = 0)
    this.activityScheduler = new ActivityScheduler({
      distribution: {
        read: 30,   // 30% chance to read
        think: 30,  // 30% chance to think
        post: 0,    // 0% chance to post (for safety)
        reply: 0,   // 0% chance to reply (for safety)
        idle: 40    // 40% chance to idle
      },
      timing: {
        read: { minDuration: 5, maxDuration: 15 },    // 5-15 seconds
        think: { minDuration: 10, maxDuration: 30 },  // 10-30 seconds
        post: { minDuration: 30, maxDuration: 60 },   // 30-60 seconds
        reply: { minDuration: 15, maxDuration: 45 },  // 15-45 seconds
        idle: { minDuration: 20, maxDuration: 60 }    // 20-60 seconds
      },
      enableLogging: true,
      userId: this.userId,
      behaviorRegistry
    });

    // Set up event listeners for the activity scheduler
    this.activityScheduler.on('activityStart', (event) => {
      logger.info(`Activity started: ${event.type}`, {
        userId: this.userId,
        activityType: event.type,
        scheduledDurationMs: event.scheduledDurationMs
      });

      this.eventSystem.emit('agent_activity_start', {
        agentId: this.config.id,
        activityType: event.type,
        scheduledDurationMs: event.scheduledDurationMs
      }, 'mcp-agent');
    });

    this.activityScheduler.on('activityComplete', (event) => {
      logger.info(`Activity completed: ${event.type}`, {
        userId: this.userId,
        activityType: event.type,
        durationMs: event.durationMs,
        scheduledDurationMs: event.scheduledDurationMs
      });

      this.eventSystem.emit('agent_activity_complete', {
        agentId: this.config.id,
        activityType: event.type,
        durationMs: event.durationMs,
        scheduledDurationMs: event.scheduledDurationMs
      }, 'mcp-agent');
    });

    this.activityScheduler.on('activityProgress', (event) => {
      this.eventSystem.emit('agent_activity_progress', {
        agentId: this.config.id,
        activityType: event.type,
        progress: event.progress
      }, 'mcp-agent');
    });

    // Add MCP tools to the agent
    for (const tool of mcpTools) {
      this.tools.set(tool.name, tool);
    }
  }

  protected initializeActions(): void {
    // Add actions specific to MCP integration
    this.addAction({
      id: 'explore_community',
      name: 'explore_community',
      description: 'Explore the community by searching for interesting content',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic to explore'
          },
          maxPosts: {
            type: 'number',
            description: 'Maximum number of posts to examine'
          }
        },
        required: ['topic']
      },
      handler: async (params: Record<string, any>) => {
        return await this.exploreCommunity(params.topic as string, params.maxPosts as number || 5);
      }
    });

    this.addAction({
      id: 'engage_with_post',
      name: 'engage_with_post',
      description: 'Engage with a specific post by replying or bookmarking',
      parameters: {
        type: 'object',
        properties: {
          postId: {
            type: 'string',
            description: 'ID of the post to engage with'
          },
          engagementType: {
            type: 'string',
            enum: ['reply', 'bookmark', 'upvote'],
            description: 'Type of engagement'
          },
          content: {
            type: 'string',
            description: 'Content for reply (if engagementType is reply)'
          }
        },
        required: ['postId', 'engagementType']
      },
      handler: async (params: Record<string, any>) => {
        return await this.engageWithPost(params.postId as string, params.engagementType as string, params.content as string);
      }
    });

    this.addAction({
      id: 'create_content',
      name: 'create_content',
      description: 'Create new content (posts) based on knowledge and interests',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic for the new content'
          },
          title: {
            type: 'string',
            description: 'Title for the new content'
          },
          content: {
            type: 'string',
            description: 'Content to create'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to associate with the content'
          }
        },
        required: ['topic', 'title', 'content']
      },
      handler: async (params: Record<string, any>) => {
        return await this.createContent(params.topic as string, params.title as string, params.content as string, params.tags as string[]);
      }
    });
  }

  private async exploreCommunity(topic: string, maxPosts: number): Promise<any> {
    logger.info(`Agent exploring community for topic: ${topic}`, {
      userId: this.userId,
      topic,
      maxPosts
    });

    // Check behavioral controls for searches
    const behaviorCheck = await this.behavioralController.checkBehavior(this.userId, ActionType.SEND_MESSAGE);
    if (!behaviorCheck.allowed) {
      logger.warn(`Behavior check failed for search: ${behaviorCheck.reason}`, {
        userId: this.userId,
        topic,
        reason: behaviorCheck.reason,
        requiresApproval: behaviorCheck.requiresApproval
      });

      return {
        topic,
        postsExamined: 0,
        posts: [],
        error: behaviorCheck.reason,
        retryAfter: behaviorCheck.requiresApproval ? undefined : behaviorCheck.approvalRequest ? undefined : 3600 // 1 hour default
      };
    }

    // Get the search tool
    const searchTool = this.tools.get('search_posts');
    if (!searchTool) {
      logger.error('search_posts tool not found', { userId: this.userId, topic });
      throw new Error('search_posts tool not found');
    }

    // Execute the search
    const searchResults: any[] = await searchTool.handler({ query: topic, limit: maxPosts });

    logger.info(`Found ${searchResults.length} posts for topic: ${topic}`, {
      userId: this.userId,
      topic,
      resultsCount: searchResults.length
    });

    const explorationSummary = {
      topic,
      postsExamined: searchResults.length,
      posts: searchResults.map((post: any) => ({
        id: post.id,
        title: post.title,
        author: post.author,
        relevance: this.calculateRelevance(topic, post.content)
      }))
    };

    // Emit event for dashboard
    this.eventSystem.emit('agent_exploration', {
      agentId: this.config.id,
      summary: explorationSummary
    }, 'mcp-agent');

    return explorationSummary;
  }

  private async engageWithPost(postId: string, engagementType: string, content?: string): Promise<any> {
    logger.info(`Agent engaging with post ${postId} via ${engagementType}`, {
      userId: this.userId,
      postId,
      engagementType,
      hasContent: !!content
    });

    let result;
    if (engagementType === 'reply' && content) {
      // Check behavioral controls for replies
      const behaviorCheck = await this.behavioralController.checkBehavior(this.userId, ActionType.REPLY, content);
      if (!behaviorCheck.allowed) {
        logger.warn(`Behavior check failed for reply: ${behaviorCheck.reason}`, {
          userId: this.userId,
          postId,
          reason: behaviorCheck.reason,
          requiresApproval: behaviorCheck.requiresApproval
        });

        return {
          success: false,
          error: behaviorCheck.reason,
          requiresApproval: behaviorCheck.requiresApproval,
          approvalRequest: behaviorCheck.approvalRequest
        };
      }

      // Enhance the reply with intrinsic motivation
      const enhancedContent = await this.bot.runWithSystemPrompt(
        `Original reply: ${content}\n\nMake this reply more thoughtful, valuable, and aligned with the agent's intrinsic motivations.`,
        this.intrinsicMotivationPrompt
      );

      // Get the reply tool
      const replyTool = this.tools.get('reply_to_post');
      if (!replyTool) {
        logger.error('reply_to_post tool not found', { userId: this.userId, postId });
        throw new Error('reply_to_post tool not found');
      }

      result = await replyTool.handler({ postId, content: enhancedContent });

      logger.info('Reply created successfully', { userId: this.userId, postId, result });
    } else if (engagementType === 'upvote') {
      // Check behavioral controls for upvotes
      const behaviorCheck = await this.behavioralController.checkBehavior(this.userId, ActionType.SEND_MESSAGE);
      if (!behaviorCheck.allowed) {
        logger.warn(`Behavior check failed for upvote: ${behaviorCheck.reason}`, {
          userId: this.userId,
          postId,
          reason: behaviorCheck.reason,
          requiresApproval: behaviorCheck.requiresApproval
        });

        return {
          success: false,
          error: behaviorCheck.reason,
          requiresApproval: behaviorCheck.requiresApproval,
          approvalRequest: behaviorCheck.approvalRequest
        };
      }

      // Simulate upvoting (in a real system, there would be a specific tool for this)
      result = { success: true, message: `Upvoted post ${postId}` };
      logger.info('Upvoted post', { userId: this.userId, postId });
    } else if (engagementType === 'bookmark') {
      // Check behavioral controls for bookmarks
      const behaviorCheck = await this.behavioralController.checkBehavior(this.userId, ActionType.SEND_MESSAGE);
      if (!behaviorCheck.allowed) {
        logger.warn(`Behavior check failed for bookmark: ${behaviorCheck.reason}`, {
          userId: this.userId,
          postId,
          reason: behaviorCheck.reason,
          requiresApproval: behaviorCheck.requiresApproval
        });

        return {
          success: false,
          error: behaviorCheck.reason,
          requiresApproval: behaviorCheck.requiresApproval,
          approvalRequest: behaviorCheck.approvalRequest
        };
      }

      // Simulate bookmarking (in a real system, there would be a specific tool for this)
      result = { success: true, message: `Bookmarked post ${postId}` };
      logger.info('Bookmarked post', { userId: this.userId, postId });
    } else {
      logger.warn(`Unsupported engagement type: ${engagementType}`, { userId: this.userId, postId, engagementType });
      return { success: false, error: `Unsupported engagement type: ${engagementType}` };
    }

    // Emit event for dashboard
    this.eventSystem.emit('agent_engagement', {
      agentId: this.config.id,
      postId,
      engagementType,
      result
    }, 'mcp-agent');

    return result;
  }

  private async createContent(topic: string, title: string, content: string, tags?: string[]): Promise<any> {
    logger.info(`Agent creating content on topic: ${topic}`, { userId: this.userId, topic, title });

    // Check behavioral controls
    const behaviorCheck = await this.behavioralController.checkBehavior(this.userId, ActionType.POST, content);
    if (!behaviorCheck.allowed) {
      logger.warn(`Behavior check failed for post: ${behaviorCheck.reason}`, {
        userId: this.userId,
        topic,
        reason: behaviorCheck.reason,
        requiresApproval: behaviorCheck.requiresApproval
      });

      return {
        success: false,
        error: behaviorCheck.reason,
        requiresApproval: behaviorCheck.requiresApproval,
        approvalRequest: behaviorCheck.approvalRequest
      };
    }

    // Enhance content with intrinsic motivation
    const enhancedContent = await this.bot.runWithSystemPrompt(
      `Original content: ${content}\n\nHow can this content be improved to better serve the community and reflect the agent's intrinsic motivations?`,
      this.intrinsicMotivationPrompt
    );

    // Get the create post tool
    const postTool = this.tools.get('create_post');
    if (!postTool) {
      logger.error('create_post tool not found', { userId: this.userId });
      throw new Error('create_post tool not found');
    }

    const result = await postTool.handler({ title, content: enhancedContent, tags });

    logger.info('Content created successfully', { userId: this.userId, topic, title, result });

    // Emit event for dashboard
    this.eventSystem.emit('agent_content_creation', {
      agentId: this.config.id,
      topic,
      title,
      result
    }, 'mcp-agent');

    return result;
  }

  private calculateRelevance(topic: string, content: string): number {
    // Simple relevance calculation based on keyword matching
    const topicWords = topic.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    let matches = 0;
    for (const word of topicWords) {
      if (contentLower.includes(word)) {
        matches++;
      }
    }
    
    return matches / topicWords.length;
  }


  // Getter for behavioral controller to allow external configuration
  get behavioralCtrl() {
    return this.behavioralController;
  }

  // Getter for activity scheduler to allow external configuration
  get activitySched() {
    return this.activityScheduler;
  }

  /**
   * Start the activity scheduler
   */
  async startActivityScheduler(): Promise<void> {
    logger.info('Starting activity scheduler...', { userId: this.userId });
    await this.activityScheduler.start();
  }

  /**
   * Stop the activity scheduler
   */
  stopActivityScheduler(): void {
    logger.info('Stopping activity scheduler...', { userId: this.userId });
    this.activityScheduler.stop();
  }

  /**
   * Update the activity distribution
   */
  updateActivityDistribution(distribution: ActivityDistribution): void {
    logger.info('Updating activity distribution', {
      userId: this.userId,
      distribution
    });
    this.activityScheduler.updateDistribution(distribution);
  }

  /**
   * Get current activity distribution
   */
  getActivityDistribution(): ActivityDistribution {
    return this.activityScheduler.getDistribution();
  }

  /**
   * Get current activity status
   */
  getCurrentActivity(): any {
    return this.activityScheduler.getCurrentActivity();
  }

  /**
   * Get scheduler running status
   */
  isSchedulerRunning(): boolean {
    return this.activityScheduler.isRunningStatus();
  }

  // Override the runActivityCycle method to use the scheduler
  async runActivityCycle(): Promise<void> {
    logger.info('MCP Integration Agent starting activity cycle with scheduler...', { userId: this.userId });

    try {
      // Start the activity scheduler if not already running
      if (!this.activityScheduler.isRunningStatus()) {
        await this.startActivityScheduler();
      }
    } catch (error) {
      logger.error('Error starting activity scheduler:', {
        userId: this.userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Get the behavior registry
   */
  getBehaviorRegistry(): BehaviorRegistry {
    return this.activityScheduler.getBehaviorRegistry();
  }

  /**
   * Register a new behavior
   */
  registerBehavior(behavior: any): void {
    this.activityScheduler.getBehaviorRegistry().register(behavior);
  }

  /**
   * Create and register a behavior from a factory
   */
  createAndRegisterBehavior(type: any, config: any): any {
    return this.activityScheduler.getBehaviorRegistry().createAndRegister(type, config);
  }

  /**
   * Get all registered behaviors
   */
  getBehaviors(): any[] {
    return this.activityScheduler.getBehaviorRegistry().getAll();
  }

  /**
   * Get behaviors by type
   */
  getBehaviorsByType(type: any): any[] {
    return this.activityScheduler.getBehaviorRegistry().getByType(type);
  }

  /**
   * Enable a behavior by ID
   */
  enableBehavior(id: string): boolean {
    return this.activityScheduler.getBehaviorRegistry().enable(id);
  }

  /**
   * Disable a behavior by ID
   */
  disableBehavior(id: string): boolean {
    return this.activityScheduler.getBehaviorRegistry().disable(id);
  }

  /**
   * Execute a behavior by ID
   */
  async executeBehavior(id: string, context: any): Promise<any> {
    return await this.activityScheduler.getBehaviorRegistry().execute(id, context);
  }
}
