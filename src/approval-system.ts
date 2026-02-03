import { 
  ApprovalConfig, 
  ApprovalPolicy, 
  ApprovalRule, 
  ApprovalRequest, 
  ApprovalStep, 
  ApprovalStatus, 
  ActionType,
  ApprovalCondition
} from './approval-types';
import { EventSystem } from './event-system';
import { Account } from './account-manager';

export interface ApprovalNotification {
  requestId: string;
  actionType: ActionType;
  requester: string;
  message: string;
  timestamp: Date;
}

export class ApprovalSystem {
  private config: ApprovalConfig;
  private policies: Map<string, ApprovalPolicy> = new Map();
  private requests: Map<string, ApprovalRequest> = new Map();
  private eventSystem?: EventSystem;
  private notificationCallbacks: Array<(notification: ApprovalNotification) => void> = [];

  constructor(config: ApprovalConfig) {
    this.config = config;
    
    // Initialize default policies if none provided
    if (config.policies.length === 0) {
      this.initializeDefaultPolicies();
    } else {
      config.policies.forEach(policy => {
        this.policies.set(policy.id, policy);
      });
    }
  }

  private initializeDefaultPolicies(): void {
    // Default policy for sensitive actions
    const sensitiveActionsPolicy: ApprovalPolicy = {
      id: 'sensitive-actions-policy',
      name: 'Sensitive Actions Policy',
      description: 'Requires approval for sensitive actions',
      rules: [
        {
          id: 'rule-sensitive-actions',
          name: 'Sensitive Actions Rule',
          description: 'Require approval for sensitive actions',
          actionType: ActionType.DELETE,
          conditions: [],
          priority: 1,
          autoApprove: false,
          approvers: [], // Will use system admins
          requiredApprovals: 1,
          expirationMinutes: 1440, // 24 hours
          enabled: true
        }
      ],
      defaultAction: 'request_approval',
      enabled: true
    };

    // Default policy for content moderation
    const contentModerationPolicy: ApprovalPolicy = {
      id: 'content-moderation-policy',
      name: 'Content Moderation Policy',
      description: 'Moderates content before posting/replying',
      rules: [
        {
          id: 'rule-long-content',
          name: 'Long Content Rule',
          description: 'Require approval for content longer than 500 characters',
          actionType: ActionType.POST,
          conditions: [
            {
              field: 'contentLength',
              operator: 'greaterThan',
              value: 500
            }
          ],
          priority: 2,
          autoApprove: false,
          approvers: [],
          requiredApprovals: 1,
          expirationMinutes: 1440,
          enabled: true
        },
        {
          id: 'rule-contains-links',
          name: 'Contains Links Rule',
          description: 'Require approval for posts containing links',
          actionType: ActionType.POST,
          conditions: [
            {
              field: 'containsUrl',
              operator: 'equals',
              value: true
            }
          ],
          priority: 3,
          autoApprove: false,
          approvers: [],
          requiredApprovals: 1,
          expirationMinutes: 1440,
          enabled: true
        }
      ],
      defaultAction: 'approve',
      enabled: true
    };

    this.policies.set(sensitiveActionsPolicy.id, sensitiveActionsPolicy);
    this.policies.set(contentModerationPolicy.id, contentModerationPolicy);
  }

  setEventSystem(eventSystem: EventSystem): void {
    this.eventSystem = eventSystem;
  }

  subscribeToNotifications(callback: (notification: ApprovalNotification) => void): void {
    this.notificationCallbacks.push(callback);
  }

  private notify(notification: ApprovalNotification): void {
    // Send notification through registered callbacks
    this.notificationCallbacks.forEach(cb => cb(notification));

    // Emit event if event system is available
    if (this.eventSystem) {
      this.eventSystem.emit('approval_notification', notification, 'approval-system');
    }
  }

  async evaluateAction(actionType: ActionType, actionData: any, requester: Account): Promise<ApprovalRequest | null> {
    if (!this.config.enabled) {
      return null; // Approvals disabled, allow action to proceed
    }

    // Check if this action type requires approval by default
    if (!this.config.requireApprovalFor.includes(actionType)) {
      return null; // No approval required for this action type
    }

    // Find applicable policies
    const applicablePolicies = Array.from(this.policies.values())
      .filter(policy => policy.enabled);

    // Sort policies by priority (for future expansion)
    applicablePolicies.sort((a, b) => a.id.localeCompare(b.id));

    // Evaluate each policy
    for (const policy of applicablePolicies) {
      const matchingRule = this.findMatchingRule(policy, actionType, actionData);

      if (matchingRule) {
        // Create approval request based on the matching rule
        return await this.createApprovalRequest(matchingRule, actionType, actionData, requester);
      }
    }

    // If no rules matched, use the policy's default action
    const defaultPolicy = applicablePolicies.find(p => p.defaultAction === 'request_approval');
    if (defaultPolicy && defaultPolicy.rules.length > 0) {
      // Use the first rule as default if no specific rule matched
      const defaultRule = defaultPolicy.rules[0];
      return await this.createApprovalRequest(defaultRule, actionType, actionData, requester);
    }

    return null; // No approval required
  }

  private findMatchingRule(policy: ApprovalPolicy, actionType: ActionType, actionData: any): ApprovalRule | null {
    // Get all enabled rules for this policy that match the action type
    const candidateRules = policy.rules
      .filter(rule => 
        rule.enabled && 
        (rule.actionType === actionType || rule.actionType === ActionType.CUSTOM)
      )
      .sort((a, b) => a.priority - b.priority); // Sort by priority (lower number = higher priority)

    for (const rule of candidateRules) {
      if (this.evaluateConditions(rule.conditions, actionData)) {
        return rule;
      }
    }

    return null;
  }

  private evaluateConditions(conditions: ApprovalCondition[], actionData: any): boolean {
    if (conditions.length === 0) {
      return true; // No conditions means always match
    }

    // All conditions must be satisfied (AND logic)
    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(condition.field, actionData);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'notEquals':
          return fieldValue !== condition.value;
        case 'greaterThan':
          return fieldValue > condition.value;
        case 'lessThan':
          return fieldValue < condition.value;
        case 'contains':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
          }
          return false;
        case 'matchesRegex':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            const regex = new RegExp(condition.value, 'i');
            return regex.test(fieldValue);
          }
          return false;
        case 'startsWith':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            return fieldValue.toLowerCase().startsWith(condition.value.toLowerCase());
          }
          return false;
        case 'endsWith':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            return fieldValue.toLowerCase().endsWith(condition.value.toLowerCase());
          }
          return false;
        default:
          return false;
      }
    });
  }

  private getFieldValue(field: string, actionData: any): any {
    // Handle special computed fields
    switch (field) {
      case 'contentLength':
        return actionData.content ? actionData.content.length : 0;
      case 'containsUrl':
        if (actionData.content) {
          const urlRegex = /(https?:\/\/[^\s]+)/gi;
          return urlRegex.test(actionData.content);
        }
        return false;
      case 'wordCount':
        if (actionData.content) {
          return actionData.content.split(/\s+/).filter((word: string) => word.length > 0).length;
        }
        return 0;
      case 'hasAttachments':
        return actionData.attachments && actionData.attachments.length > 0;
      default:
        // Return the field value directly from actionData
        return actionData[field];
    }
  }

  private async createApprovalRequest(
    rule: ApprovalRule, 
    actionType: ActionType, 
    actionData: any, 
    requester: Account
  ): Promise<ApprovalRequest> {
    const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine approvers - if rule doesn't specify, use system admins
    let approverIds = rule.approvers;
    if (approverIds.length === 0) {
      // In a real system, this would fetch admin users
      approverIds = ['admin']; // Placeholder
    }

    // Create approval steps for each approver
    const approvalSteps: ApprovalStep[] = approverIds.map(approverId => ({
      approverId,
      approverName: approverId, // In a real system, this would be looked up
      status: ApprovalStatus.PENDING
    }));

    const request: ApprovalRequest = {
      id: requestId,
      actionType,
      actionData,
      requesterId: requester.id,
      requesterName: requester.username,
      status: ApprovalStatus.PENDING,
      ruleId: rule.id,
      approvers: approvalSteps,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + rule.expirationMinutes * 60 * 1000),
      reason: rule.description,
      metadata: {
        ruleName: rule.name,
        policyId: Array.from(this.policies.values()).find(p => 
          p.rules.some(r => r.id === rule.id)
        )?.id
      }
    };

    this.requests.set(requestId, request);

    // Notify about the new approval request
    this.notify({
      requestId,
      actionType,
      requester: requester.username,
      message: `New ${actionType} action from ${requester.username} requires approval`,
      timestamp: new Date()
    });

    return request;
  }

  async approveRequest(requestId: string, approver: Account, comment?: string): Promise<boolean> {
    const request = this.requests.get(requestId);
    if (!request) {
      return false;
    }

    if (request.status !== ApprovalStatus.PENDING) {
      return false; // Can't approve a non-pending request
    }

    // Find the approver's step
    const approverStep = request.approvers.find(step => step.approverId === approver.id);
    if (!approverStep) {
      return false; // This approver is not authorized to approve this request
    }

    if (approverStep.status !== ApprovalStatus.PENDING) {
      return false; // Already approved or rejected
    }

    // Update the approver's status
    approverStep.status = ApprovalStatus.APPROVED;
    approverStep.approvedAt = new Date();
    approverStep.comment = comment;

    // Check if enough approvals have been received
    const approvedCount = request.approvers.filter(a => a.status === ApprovalStatus.APPROVED).length;
    const requiredApprovals = Array.from(this.policies.values())
      .flatMap(p => p.rules)
      .find(r => r.id === request.ruleId)?.requiredApprovals || 1;

    if (approvedCount >= requiredApprovals) {
      request.status = ApprovalStatus.APPROVED;
      
      // Emit approval granted event
      if (this.eventSystem) {
        this.eventSystem.emit('approval_granted', {
          requestId,
          actionType: request.actionType,
          approvedBy: approver.username
        }, 'approval-system');
      }
    }

    // Update the request in our store
    this.requests.set(requestId, request);

    return true;
  }

  async rejectRequest(requestId: string, approver: Account, comment?: string): Promise<boolean> {
    const request = this.requests.get(requestId);
    if (!request) {
      return false;
    }

    if (request.status !== ApprovalStatus.PENDING) {
      return false; // Can't reject a non-pending request
    }

    // Find the approver's step
    const approverStep = request.approvers.find(step => step.approverId === approver.id);
    if (!approverStep) {
      return false; // This approver is not authorized to approve this request
    }

    // Update the approver's status
    approverStep.status = ApprovalStatus.REJECTED;
    approverStep.approvedAt = new Date();
    approverStep.comment = comment;

    // Reject the entire request if any approver rejects
    request.status = ApprovalStatus.REJECTED;

    // Update the request in our store
    this.requests.set(requestId, request);

    // Emit approval rejected event
    if (this.eventSystem) {
      this.eventSystem.emit('approval_rejected', {
        requestId,
        actionType: request.actionType,
        rejectedBy: approver.username,
        comment
      }, 'approval-system');
    }

    return true;
  }

  async cancelRequest(requestId: string, requester: Account): Promise<boolean> {
    const request = this.requests.get(requestId);
    if (!request) {
      return false;
    }

    // Only the original requester can cancel
    if (request.requesterId !== requester.id) {
      return false;
    }

    if (request.status !== ApprovalStatus.PENDING) {
      return false; // Can't cancel a non-pending request
    }

    request.status = ApprovalStatus.CANCELLED;

    // Update the request in our store
    this.requests.set(requestId, request);

    return true;
  }

  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  getRequestsByRequester(requesterId: string): ApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter(req => req.requesterId === requesterId);
  }

  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter(req => req.status === ApprovalStatus.PENDING);
  }

  getRequestsByApprover(approverId: string): ApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter(req => 
        req.status === ApprovalStatus.PENDING &&
        req.approvers.some(step => step.approverId === approverId)
      );
  }

  addPolicy(policy: ApprovalPolicy): void {
    this.policies.set(policy.id, policy);
  }

  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  updateConfig(newConfig: Partial<ApprovalConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ApprovalConfig {
    return { ...this.config };
  }

  // Cleanup expired requests
  cleanupExpiredRequests(): void {
    const now = new Date();
    const expiredIds: string[] = [];

    for (const [id, request] of this.requests) {
      if (request.expiresAt < now) {
        expiredIds.push(id);
      }
    }

    expiredIds.forEach(id => {
      this.requests.delete(id);
    });
  }
}