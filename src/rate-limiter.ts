import { ActionType } from './approval-types';
import logger from './logger';

export interface RateLimitConfig {
  post: {
    maxPerHour: number;
    maxPerDay: number;
  };
  reply: {
    maxPerHour: number;
    maxPerDay: number;
  };
  search: {
    maxPerHour: number;
    maxPerDay: number;
  };
  message: {
    maxPerHour: number;
    maxPerDay: number;
  };
}

export interface RateLimitBucket {
  count: number;
  resetTime: Date;
}

export interface ActivityRecord {
  action: string;
  timestamp: Date;
  userId: string;
}

export class RateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private activityLog: ActivityRecord[] = [];
  private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    // Default configuration: maximum 1 post per hour, etc.
    this.config = {
      post: {
        maxPerHour: config?.post?.maxPerHour ?? 1,
        maxPerDay: config?.post?.maxPerDay ?? 24
      },
      reply: {
        maxPerHour: config?.reply?.maxPerHour ?? 5,
        maxPerDay: config?.reply?.maxPerDay ?? 50
      },
      search: {
        maxPerHour: config?.search?.maxPerHour ?? 20,
        maxPerDay: config?.search?.maxPerDay ?? 200
      },
      message: {
        maxPerHour: config?.message?.maxPerHour ?? 10,
        maxPerDay: config?.message?.maxPerDay ?? 100
      }
    };
  }

  async checkRateLimit(userId: string, action: ActionType | string): Promise<{ allowed: boolean; retryAfter?: number; message?: string }> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Map ActionType to rate limit category
    let category: 'post' | 'reply' | 'search' | 'message';
    if (action === ActionType.POST) category = 'post';
    else if (action === ActionType.REPLY) category = 'reply';
    else if (action === ActionType.SEND_MESSAGE) category = 'message';
    else if (action === 'search' || action === 'search_posts') category = 'search';
    else category = 'message'; // Default fallback

    logger.debug(`Checking rate limit for user ${userId}, action ${action} (category: ${category})`);

    // Count activities in the last hour
    const hourActivities = this.activityLog.filter(record => 
      record.userId === userId && 
      this.mapActionToCategory(record.action) === category &&
      record.timestamp > hourAgo
    ).length;

    // Count activities in the last day
    const dayActivities = this.activityLog.filter(record => 
      record.userId === userId && 
      this.mapActionToCategory(record.action) === category &&
      record.timestamp > dayAgo
    ).length;

    // Check hourly limit
    const hourlyLimit = this.config[category].maxPerHour;
    if (hourActivities >= hourlyLimit) {
      const nextReset = new Date(hourAgo.getTime() + 60 * 60 * 1000); // Next hour
      const retryAfter = Math.ceil((nextReset.getTime() - now.getTime()) / 1000); // in seconds
      
      const message = `Hourly limit exceeded for ${category}s. Limit: ${hourlyLimit} per hour.`;
      logger.warn(`Rate limit exceeded for user ${userId}: ${message}`);

      return {
        allowed: false,
        retryAfter,
        message
      };
    }

    // Check daily limit
    const dailyLimit = this.config[category].maxPerDay;
    if (dayActivities >= dailyLimit) {
      const nextReset = new Date(dayAgo.getTime() + 24 * 60 * 60 * 1000); // Next day
      const retryAfter = Math.ceil((nextReset.getTime() - now.getTime()) / 1000); // in seconds
      
      const message = `Daily limit exceeded for ${category}s. Limit: ${dailyLimit} per day.`;
      logger.warn(`Rate limit exceeded for user ${userId}: ${message}`);

      return {
        allowed: false,
        retryAfter,
        message
      };
    }

    // If allowed, record the activity
    this.activityLog.push({
      action: typeof action === 'string' ? action : String(action),
      timestamp: now,
      userId
    });

    // Clean up old records (older than 25 hours to be safe)
    const cutoff = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    this.activityLog = this.activityLog.filter(record => record.timestamp > cutoff);

    return { allowed: true };
  }

  private mapActionToCategory(action: string): 'post' | 'reply' | 'search' | 'message' {
    if (action === ActionType.POST || action === 'post') return 'post';
    if (action === ActionType.REPLY || action === 'reply') return 'reply';
    if (action === 'search' || action === 'search_posts') return 'search';
    return 'message';
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      post: { ...this.config.post, ...newConfig.post },
      reply: { ...this.config.reply, ...newConfig.reply },
      search: { ...this.config.search, ...newConfig.search },
      message: { ...this.config.message, ...newConfig.message }
    };
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  // Get usage statistics
  getUsage(userId: string, category: 'post' | 'reply' | 'search' | 'message'): { hourly: number; daily: number; hourlyLimit: number; dailyLimit: number } {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const hourly = this.activityLog.filter(record => 
      record.userId === userId && 
      this.mapActionToCategory(record.action) === category &&
      record.timestamp > hourAgo
    ).length;

    const daily = this.activityLog.filter(record => 
      record.userId === userId && 
      this.mapActionToCategory(record.action) === category &&
      record.timestamp > dayAgo
    ).length;

    return {
      hourly,
      daily,
      hourlyLimit: this.config[category].maxPerHour,
      dailyLimit: this.config[category].maxPerDay
    };
  }

  // Reset usage for a specific user (admin function)
  resetUsage(userId: string): void {
    this.activityLog = this.activityLog.filter(record => record.userId !== userId);
  }
}
