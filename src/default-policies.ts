import { ApprovalPolicy, ActionType } from './approval-types';

export function createDefaultPolicies(): Map<string, ApprovalPolicy> {
  const policies = new Map<string, ApprovalPolicy>();

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

  policies.set(sensitiveActionsPolicy.id, sensitiveActionsPolicy);
  policies.set(contentModerationPolicy.id, contentModerationPolicy);

  return policies;
}
