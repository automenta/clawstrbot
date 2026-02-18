import { ClawstrBot } from './bot';
import { LMTool } from './types';
import { EventSystem } from './event-system';
import { AbstractAgent } from './abstract-agent';
import { RateLimiter } from './rate-limiter';
import { BehavioralController } from './behavioral-controller';
import { ActionType } from './approval-types';
import logger from './logger';
import { ActivityScheduler, ActivityDistribution } from './activity-scheduler';
import { BehaviorRegistry } from './behaviors/behavior-registry';
import { registerDefaultFactories } from './behaviors/behavior-factories';
import { BotInterface, AgentInterface } from './interfaces';
import { MCPClient, MCPConfig } from './mcp-client';

export class MCPIntegrationAgent extends AbstractAgent implements AgentInterface {
  private bot: ClawstrBot;
  private eventSystem: EventSystem;
  private intrinsicMotivationPrompt: string;
  private tools: Map<string, LMTool> = new Map();
  private rateLimiter: RateLimiter;
  protected behavioralController: BehavioralController;
  private userId: string;
  private activityScheduler: ActivityScheduler;
  private mcpClient: MCPClient;

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

    // Initialize MCP Client with configuration from bot
    const botConfig = bot.getConfig();
    this.mcpClient = new MCPClient({
      baseUrl: botConfig.baseUrl || process.env.MCP_BASE_URL || 'http://localhost:8000',
      apiKey: botConfig.apiKey || process.env.MCP_API_KEY || 'default-key',
      timeout: 30000
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
    const behaviorRegistry = BehaviorRegistry.getInstance({ autoRegisterDefaults: true });

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
      behaviorRegistry,
      contextData: {
        agent: this, // Pass the agent instance to behaviors
        bot: this.bot, // Pass the bot instance to behaviors
        // Also pass memory methods directly for easier access
        addMemory: (function(this: MCPIntegrationAgent, content: string, type: string, priority?: number, tags?: string[], metadata?: Record<string, any>) {
          if (this.bot) {
            return this.bot.addMemory(content, type, priority, tags, metadata);
          }
          return '';
        }).bind(this),
        searchMemories: (function(this: MCPIntegrationAgent, query: string, limit?: number) {
          if (this.bot) {
            return this.bot.searchMemories(query, limit);
          }
          return [];
        }).bind(this)
      }
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

    // Note: MCP tools are now handled by the MCP client directly
    // The tools map is kept for backward compatibility but not used for actual MCP operations

    // Initialize agent actions
    this.initializeActions();
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

    this.addAction({
      id: 'think',
      name: 'think',
      description: 'Perform deep thinking and reflection on a given prompt',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The prompt or topic to think about'
          }
        },
        required: ['prompt']
      },
      handler: async (params: Record<string, any>) => {
        return await this.think(params.prompt as string);
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

    // Execute the search using real MCP client
    logger.info(`Executing search via MCP client for topic: ${topic}`, {
      userId: this.userId,
      topic,
      limit: maxPosts
    });

    const searchResponse = await this.mcpClient.searchPosts({ query: topic, limit: maxPosts });

    if (!searchResponse.success) {
      logger.error(`Search failed via MCP client: ${searchResponse.error}`, {
        userId: this.userId,
        topic,
        error: searchResponse.error,
        rateLimited: searchResponse.rateLimited
      });

      // Handle rate limiting
      if (searchResponse.rateLimited) {
        this.handleRateLimit(this.userId, 'Search rate limit exceeded');
        return {
          topic,
          postsExamined: 0,
          posts: [],
          error: 'Rate limit exceeded for searches',
          retryAfter: 3600 // 1 hour
        };
      }

      throw new Error(searchResponse.error || 'Search failed');
    }

    const searchResults: any[] = searchResponse.result.posts || [];

    logger.info(`MCP client search completed with ${searchResults.length} results`, {
      userId: this.userId,
      resultsCount: searchResults.length,
      topic
    });

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
        content: post.content,
        relevance: this.calculateRelevance(topic, post.content || '')
      }))
    };

    // Emit event for dashboard
    this.eventSystem.emit('agent_exploration', {
      agentId: this.config.id,
      summary: explorationSummary
    }, 'mcp-agent');

    // Store the exploration results in memory
    if (this.bot) {
      this.bot.addMemory(
        `Explored community on topic: ${topic}. Found ${searchResults.length} posts.`,
        'observation',
        6,
        ['explore', 'community', topic],
        { topic, resultsCount: searchResults.length, timestamp: new Date().toISOString() }
      );
    }

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
      logger.info(`Initiating LLM call for reply enhancement`, {
        userId: this.userId,
        originalContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        activityType: 'reply_enhancement'
      });

      const enhancedContent = await this.bot.runWithSystemPrompt(
        `Original reply: ${content}\n\nMake this reply more thoughtful, valuable, and aligned with the agent's intrinsic motivations.`,
        this.intrinsicMotivationPrompt
      );

      logger.info(`LLM response received for reply enhancement`, {
        userId: this.userId,
        originalLength: content.length,
        enhancedLength: enhancedContent.length,
        activityType: 'reply_enhancement'
      });

      // Use the real MCP client to create the reply
      const replyResponse = await this.mcpClient.engageWithPost({
        postId,
        engagementType: 'reply',
        content: enhancedContent
      });

      if (!replyResponse.success) {
        logger.error(`Reply failed via MCP client: ${replyResponse.error}`, {
          userId: this.userId,
          postId,
          error: replyResponse.error,
          rateLimited: replyResponse.rateLimited
        });

        // Handle rate limiting
        if (replyResponse.rateLimited) {
          this.handleRateLimit(this.userId, 'Reply rate limit exceeded');
          return {
            success: false,
            error: 'Rate limit exceeded for replies',
            retryAfter: 3600 // 1 hour
          };
        }

        throw new Error(replyResponse.error || 'Reply failed');
      }

      result = replyResponse.result;

      logger.info('Reply created successfully via MCP client', { userId: this.userId, postId, result });

      // Store the reply in memory
      if (this.bot) {
        this.bot.addMemory(
          `Replied to post ${postId}: ${content.substring(0, 100)}...`,
          'interaction',
          5,
          ['reply', 'engagement'],
          { postId, content, timestamp: new Date().toISOString() }
        );
      }
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

      // Use the real MCP client to upvote
      const upvoteResponse = await this.mcpClient.engageWithPost({
        postId,
        engagementType: 'like'
      });

      if (!upvoteResponse.success) {
        logger.error(`Upvote failed via MCP client: ${upvoteResponse.error}`, {
          userId: this.userId,
          postId,
          error: upvoteResponse.error,
          rateLimited: upvoteResponse.rateLimited
        });

        // Handle rate limiting
        if (upvoteResponse.rateLimited) {
          this.handleRateLimit(this.userId, 'Upvote rate limit exceeded');
          return {
            success: false,
            error: 'Rate limit exceeded for upvotes',
            retryAfter: 3600 // 1 hour
          };
        }

        throw new Error(upvoteResponse.error || 'Upvote failed');
      }

      result = upvoteResponse.result;
      logger.info('Upvoted post via MCP client', { userId: this.userId, postId });
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

      // Use the real MCP client to bookmark
      const bookmarkResponse = await this.mcpClient.engageWithPost({
        postId,
        engagementType: 'share' // Using share as a proxy for bookmarking
      });

      if (!bookmarkResponse.success) {
        logger.error(`Bookmark failed via MCP client: ${bookmarkResponse.error}`, {
          userId: this.userId,
          postId,
          error: bookmarkResponse.error,
          rateLimited: bookmarkResponse.rateLimited
        });

        // Handle rate limiting
        if (bookmarkResponse.rateLimited) {
          this.handleRateLimit(this.userId, 'Bookmark rate limit exceeded');
          return {
            success: false,
            error: 'Rate limit exceeded for bookmarks',
            retryAfter: 3600 // 1 hour
          };
        }

        throw new Error(bookmarkResponse.error || 'Bookmark failed');
      }

      result = bookmarkResponse.result;
      logger.info('Bookmarked post via MCP client', { userId: this.userId, postId });
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
    logger.info(`Initiating LLM call for content enhancement`, {
      userId: this.userId,
      topic,
      originalContent: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      activityType: 'content_enhancement'
    });

    const enhancedContent = await this.bot.runWithSystemPrompt(
      `Original content: ${content}\n\nHow can this content be improved to better serve the community and reflect the agent's intrinsic motivations?`,
      this.intrinsicMotivationPrompt
    );

    logger.info(`LLM response received for content enhancement`, {
      userId: this.userId,
      originalLength: content.length,
      enhancedLength: enhancedContent.length,
      activityType: 'content_enhancement'
    });

    // Use the real MCP client to create content
    const createResponse = await this.mcpClient.createContent({
      title,
      content: enhancedContent,
      topic,
      tags
    });

    if (!createResponse.success) {
      logger.error(`Content creation failed via MCP client: ${createResponse.error}`, {
        userId: this.userId,
        topic,
        title,
        error: createResponse.error,
        rateLimited: createResponse.rateLimited
      });

      // Handle rate limiting
      if (createResponse.rateLimited) {
        this.handleRateLimit(this.userId, 'Post rate limit exceeded');
        return {
          success: false,
          error: 'Rate limit exceeded for posts',
          retryAfter: 3600 // 1 hour
        };
      }

      throw new Error(createResponse.error || 'Content creation failed');
    }

    const result = createResponse.result;

    logger.info('Content created successfully via MCP client', { userId: this.userId, topic, title, result });

    // Emit event for dashboard
    this.eventSystem.emit('agent_content_creation', {
      agentId: this.config.id,
      topic,
      title,
      result
    }, 'mcp-agent');

    // Store the created content in memory
    if (this.bot) {
      this.bot.addMemory(
        `Created content on topic ${topic}: ${title}. Content: ${content.substring(0, 100)}...`,
        'creation',
        7,
        ['create', 'content', topic, ...(tags || [])],
        { topic, title, content, tags, timestamp: new Date().toISOString() }
      );
    }

    return result;
  }

  private async think(prompt: string): Promise<any> {
    logger.info(`Agent thinking about: ${prompt}`, {
      userId: this.userId,
      prompt
    });

    try {
      // Check behavioral controls for thinking (usually lenient)
      const behaviorCheck = await this.behavioralController.checkBehavior(this.userId, ActionType.SEND_MESSAGE);
      if (!behaviorCheck.allowed) {
        logger.warn(`Behavior check failed for thinking: ${behaviorCheck.reason}`, {
          userId: this.userId,
          reason: behaviorCheck.reason,
          requiresApproval: behaviorCheck.requiresApproval
        });

        return {
          thoughts: `Cannot process thought: ${behaviorCheck.reason}`,
          processedAt: new Date(),
          error: behaviorCheck.reason,
          retryAfter: behaviorCheck.requiresApproval ? undefined : behaviorCheck.approvalRequest ? undefined : 3600
        };
      }

      // Use the bot to generate thoughts based on the prompt
      logger.info(`Initiating LLM call for thinking activity`, {
        userId: this.userId,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        activityType: 'thinking'
      });

      const thoughts = await this.bot.runWithSystemPrompt(
        `Given the following prompt, provide a thoughtful reflection or analysis:\n\n${prompt}`,
        this.intrinsicMotivationPrompt
      );

      logger.info(`LLM response received for thinking activity`, {
        userId: this.userId,
        responseLength: thoughts.length,
        activityType: 'thinking'
      });

      const result = {
        prompt,
        thoughts,
        processedAt: new Date()
      };

      logger.info('Thinking completed successfully', { 
        userId: this.userId, 
        prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '') 
      });

      // Emit event for dashboard
      this.eventSystem.emit('agent_thinking', {
        agentId: this.config.id,
        prompt,
        result
      }, 'mcp-agent');

      // Store the thoughts in memory
      if (this.bot) {
        this.bot.addMemory(
          `Thoughts on: ${prompt}. Result: ${thoughts.substring(0, 100)}...`,
          'thought',
          7,
          ['think', 'reflection'],
          { prompt, thoughts, timestamp: new Date().toISOString() }
        );
      }

      return result;
    } catch (error) {
      logger.error('Error during thinking process:', {
        userId: this.userId,
        prompt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        prompt,
        thoughts: `Error processing thought: ${error instanceof Error ? error.message : String(error)}`,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
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
   * Get the activity scheduler for direct access
   */
  getActivityScheduler(): ActivityScheduler {
    return this.activityScheduler;
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
   * Adaptive activity distribution based on rate limiting feedback
   */
  async adjustActivityDistributionForRateLimits(): Promise<void> {
    // Check rate limit status and adjust distribution accordingly
    const messageUsage = this.rateLimiter.getUsage(this.userId, 'message');
    const postUsage = this.rateLimiter.getUsage(this.userId, 'post');
    const replyUsage = this.rateLimiter.getUsage(this.userId, 'reply');

    // If we're hitting rate limits frequently, adjust the distribution
    const currentDistribution = this.getActivityDistribution();
    let newDistribution = {...currentDistribution};

    // Reduce activities that are hitting rate limits
    if (messageUsage.hourly >= messageUsage.hourlyLimit * 0.8) {
      // If we're near the message limit, reduce think and search activities
      newDistribution.think = Math.max(5, Math.floor(currentDistribution.think * 0.7)); // Reduce by 30%
      newDistribution.read = Math.max(5, Math.floor(currentDistribution.read * 0.7));  // Reduce by 30%
    }

    // If post/reply limits are hit, reduce those
    if (postUsage.hourly >= postUsage.hourlyLimit * 0.8) {
      newDistribution.post = Math.max(0, Math.floor(currentDistribution.post * 0.5));  // Reduce by 50%
    }

    if (replyUsage.hourly >= replyUsage.hourlyLimit * 0.8) {
      newDistribution.reply = Math.max(0, Math.floor(currentDistribution.reply * 0.5)); // Reduce by 50%
    }

    // Increase idle time to compensate for reduced activities
    const totalActive = newDistribution.read + newDistribution.think + newDistribution.post + newDistribution.reply;
    newDistribution.idle = Math.max(10, 100 - totalActive); // Ensure at least 10% idle

    // Only update if there's a significant change
    const hasChanged = Object.entries(newDistribution).some(
      ([key, value]) => value !== currentDistribution[key as keyof ActivityDistribution]
    );

    if (hasChanged) {
      logger.info('Adjusting activity distribution due to rate limits', {
        userId: this.userId,
        oldDistribution: currentDistribution,
        newDistribution: newDistribution
      });

      this.updateActivityDistribution(newDistribution);
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

  /**
   * Handle rate limiting for a user
   */
  private handleRateLimit(userId: string, reason: string): void {
    logger.warn(`Rate limit exceeded for user ${userId}: ${reason}`, {
      userId,
      reason
    });

    // Emit rate limit event
    this.eventSystem.emit('agent_rate_limit', {
      userId,
      reason,
      timestamp: new Date().toISOString()
    }, 'mcp-agent');
  }
}