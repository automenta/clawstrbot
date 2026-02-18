import { ApprovalRequest, ActionType } from './approval-types';
import { ApprovalSystem } from './approval-system';
import { Account } from './account-manager';
import { RateLimiter } from './rate-limiter';
import logger from './logger';

export interface BehavioralControlConfig {
  requireApprovalFor: ActionType[];
  cooldownPeriod: number; // in minutes
  maxConsecutiveActions: number;
  requireApprovalAfter: number; // after this many consecutive actions
  contentFiltering: boolean;
  sentimentAnalysis: boolean;
}

export class BehavioralController {
  private approvalSystem?: ApprovalSystem;
  private rateLimiter: RateLimiter;
  private config: BehavioralControlConfig;
  private actionCounts: Map<string, { count: number; lastAction: Date }> = new Map(); // userId -> count
  private lastActionTypes: Map<string, { type: ActionType; timestamp: Date }[]> = new Map(); // userId -> array of last actions

  constructor(rateLimiter: RateLimiter, config?: Partial<BehavioralControlConfig>) {
    this.rateLimiter = rateLimiter;
    this.config = {
      requireApprovalFor: config?.requireApprovalFor ?? [ActionType.POST, ActionType.DELETE],
      cooldownPeriod: config?.cooldownPeriod ?? 10, // 10 minutes default
      maxConsecutiveActions: config?.maxConsecutiveActions ?? 3,
      requireApprovalAfter: config?.requireApprovalAfter ?? 5,
      contentFiltering: config?.contentFiltering ?? true,
      sentimentAnalysis: config?.sentimentAnalysis ?? true
    };
  }

  setApprovalSystem(approvalSystem: ApprovalSystem): void {
    this.approvalSystem = approvalSystem;
  }

  async checkBehavior(userId: string, actionType: ActionType, content?: string): Promise<{ allowed: boolean; requiresApproval?: boolean; reason?: string; approvalRequest?: ApprovalRequest }> {
    logger.debug(`Checking behavior for user ${userId}, action ${actionType}`);

    // Check rate limits first
    const rateLimitResult = await this.checkRateLimits(userId, actionType);
    if (!rateLimitResult.allowed) {
      logger.warn(`Rate limit blocked action for user ${userId}: ${rateLimitResult.reason}`);
      return rateLimitResult;
    }

    // Check content filtering
    if (this.config.contentFiltering && content) {
      const contentCheck = this.checkContent(content);
      if (!contentCheck.allowed) {
        logger.warn(`Content filtering blocked action for user ${userId}: ${contentCheck.reason}`);
        return {
          allowed: false,
          reason: contentCheck.reason
        };
      }
    }

    // Check sentiment if enabled
    if (this.config.sentimentAnalysis && content) {
      const sentimentCheck = this.analyzeSentiment(content);
      if (!sentimentCheck.allowed) {
        logger.warn(`Sentiment analysis blocked action for user ${userId}: ${sentimentCheck.reason}`);
        return {
          allowed: false,
          reason: sentimentCheck.reason
        };
      }
    }

    // Check consecutive action limits
    const consecutiveCheck = this.checkConsecutiveActions(userId, actionType);
    if (!consecutiveCheck.allowed) {
      // Check if this action requires approval due to consecutive limits
      if (this.config.requireApprovalFor.includes(actionType)) {
        if (this.approvalSystem) {
          logger.info(`Consecutive actions limit reached for user ${userId}, requesting approval`);
          const requester: Account = {
            id: userId,
            username: 'system',
            email: 'system@example.com',
            apiKey: 'system-api-key',
            isActive: true,
            permissions: ['basic'],
            createdAt: new Date(),
            updatedAt: new Date(),
            profile: { firstName: 'System', lastName: 'Agent' }
          };
          
          const approvalRequest = await this.approvalSystem.evaluateAction(actionType, { content }, requester);
          if (approvalRequest) {
            return {
              allowed: false,
              requiresApproval: true,
              reason: 'Action requires approval due to consecutive action limits',
              approvalRequest
            };
          }
        }
      }
      
      logger.warn(`Consecutive actions blocked for user ${userId}: ${consecutiveCheck.reason}`);
      return consecutiveCheck;
    }

    // Check if this action type requires approval
    if (this.config.requireApprovalFor.includes(actionType)) {
      if (this.approvalSystem) {
        const requester: Account = {
          id: userId,
          username: 'system',
          email: 'system@example.com',
          apiKey: 'system-api-key',
          isActive: true,
          permissions: ['basic'],
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: { firstName: 'System', lastName: 'Agent' }
        };

        const approvalRequest = await this.approvalSystem.evaluateAction(actionType, { content }, requester);
        if (approvalRequest) {
          logger.info(`Action ${actionType} requires approval for user ${userId}`);
          return {
            allowed: false,
            requiresApproval: true,
            reason: 'Action requires approval',
            approvalRequest
          };
        }
      }
    }

    // Update action tracking
    this.recordAction(userId, actionType);

    return { allowed: true };
  }

  private async checkRateLimits(userId: string, actionType: ActionType): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    const rateLimitCheck = await this.rateLimiter.checkRateLimit(userId, actionType);
    
    if (!rateLimitCheck.allowed) {
      return {
        allowed: false,
        reason: rateLimitCheck.message,
        retryAfter: rateLimitCheck.retryAfter
      };
    }

    return { allowed: true };
  }

  private checkContent(content: string): { allowed: boolean; reason?: string } {
    // Simple content filtering - in a real system, this would be more sophisticated
    const lowerContent = content.toLowerCase();
    
    // Check for spam indicators
    const spamIndicators = [
      'buy now', 'click here', 'free money', 'urgent', 'limited time',
      'act now', 'exclusive offer', '$$$', '!!!', 'spam', 'viagra', 'casino'
    ];
    
    for (const indicator of spamIndicators) {
      if (lowerContent.includes(indicator)) {
        return {
          allowed: false,
          reason: `Content contains potential spam phrase: "${indicator}"`
        };
      }
    }
    
    // Check for excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7 && content.length > 10) {
      return {
        allowed: false,
        reason: 'Content contains excessive capitalization'
      };
    }
    
    // Check for excessive repetition
    const words = content.toLowerCase().match(/\b(\w+)\b/g) || [];
    const wordCounts: Record<string, number> = {};
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    
    for (const [word, count] of Object.entries(wordCounts)) {
      if (words.length > 10 && count > words.length * 0.4) { // If a word appears in more than 40% of the content
        return {
          allowed: false,
          reason: `Content contains excessive repetition of word: "${word}"`
        };
      }
    }
    
    return { allowed: true };
  }

  private analyzeSentiment(content: string): { allowed: boolean; reason?: string } {
    // Simple sentiment analysis - in a real system, this would use ML
    const negativeIndicators = [
      'hate', 'stupid', 'idiot', 'terrible', 'worst', 'awful', 'horrible', 
      'disgusting', 'annoying', 'useless', 'worthless', 'garbage', 'trash'
    ];
    
    const positiveIndicators = [
      'love', 'great', 'amazing', 'excellent', 'wonderful', 'fantastic', 
      'awesome', 'brilliant', 'perfect', 'best', 'incredible', 'outstanding'
    ];
    
    const lowerContent = content.toLowerCase();
    let negativeCount = 0;
    let positiveCount = 0;
    
    for (const indicator of negativeIndicators) {
      if (lowerContent.includes(indicator)) {
        negativeCount++;
      }
    }
    
    for (const indicator of positiveIndicators) {
      if (lowerContent.includes(indicator)) {
        positiveCount++;
      }
    }
    
    // If content is overly negative, restrict it
    if (negativeCount > positiveCount && negativeCount > 2) {
      return {
        allowed: false,
        reason: 'Content appears to be overly negative or hostile'
      };
    }
    
    return { allowed: true };
  }

  private checkConsecutiveActions(userId: string, actionType: ActionType): { allowed: boolean; reason?: string } {
    const userActions = this.lastActionTypes.get(userId) || [];
    
    // Filter to only the same action type in the last 30 minutes
    const recentSameActions = userActions.filter(item => 
      item.type === actionType && 
      new Date().getTime() - item.timestamp.getTime() < 30 * 60 * 1000 // 30 minutes
    );
    
    if (recentSameActions.length >= this.config.maxConsecutiveActions) {
      return {
        allowed: false,
        reason: `Too many consecutive ${actionType} actions. Please slow down.`
      };
    }
    
    return { allowed: true };
  }

  private recordAction(userId: string, actionType: ActionType): void {
    // Update consecutive action counter
    if (!this.actionCounts.has(userId)) {
      this.actionCounts.set(userId, { count: 0, lastAction: new Date(0) });
    }
    
    const now = new Date();
    const userData = this.actionCounts.get(userId)!;
    
    // Reset counter if last action was more than cooldown period ago
    const timeDiff = (now.getTime() - userData.lastAction.getTime()) / (1000 * 60); // in minutes
    if (timeDiff > this.config.cooldownPeriod) {
      userData.count = 1;
    } else {
      userData.count++;
    }
    
    userData.lastAction = now;
    this.actionCounts.set(userId, userData);
    
    // Record action type
    if (!this.lastActionTypes.has(userId)) {
      this.lastActionTypes.set(userId, []);
    }
    
    const actionTypes = this.lastActionTypes.get(userId)!;
    actionTypes.push({ type: actionType, timestamp: now });
    
    // Keep only recent actions (last 60 minutes)
    const cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
    const filteredActions = actionTypes.filter(item => item.timestamp > cutoffTime);
    this.lastActionTypes.set(userId, filteredActions);
  }

  updateConfig(newConfig: Partial<BehavioralControlConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  resetUserBehavior(userId: string): void {
    this.actionCounts.delete(userId);
    this.lastActionTypes.delete(userId);
  }

  getUserStats(userId: string): { actionCount: number; lastAction: Date | null; recentActions: number } {
    const countData = this.actionCounts.get(userId);
    const actionTypes = this.lastActionTypes.get(userId) || [];
    
    return {
      actionCount: countData?.count || 0,
      lastAction: countData?.lastAction || null,
      recentActions: actionTypes.length
    };
  }
}
