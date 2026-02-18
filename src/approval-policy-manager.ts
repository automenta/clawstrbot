import {
  ApprovalPolicy,
  ApprovalRule,
  ActionType,
  ApprovalConfig
} from './approval-types';

export class ApprovalPolicyManager {
  private policies: Map<string, ApprovalPolicy> = new Map();

  constructor(initialPolicies?: ApprovalPolicy[]) {
    if (initialPolicies) {
      initialPolicies.forEach(policy => {
        this.policies.set(policy.id, policy);
      });
    }
  }

  createPolicy(policy: ApprovalPolicy): ApprovalPolicy {
    if (this.policies.has(policy.id)) {
      throw new Error(`Policy with ID ${policy.id} already exists`);
    }
    
    this.policies.set(policy.id, policy);
    return policy;
  }

  getPolicy(policyId: string): ApprovalPolicy | undefined {
    return this.policies.get(policyId);
  }

  updatePolicy(policyId: string, updates: Partial<ApprovalPolicy>): ApprovalPolicy | null {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return null;
    }

    const updatedPolicy = { ...policy, ...updates };
    this.policies.set(policyId, updatedPolicy);
    return updatedPolicy;
  }

  deletePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  getAllPolicies(): ApprovalPolicy[] {
    return Array.from(this.policies.values());
  }

  addRuleToPolicy(policyId: string, rule: ApprovalRule): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    // Check if rule already exists
    const existingRule = policy.rules.find(r => r.id === rule.id);
    if (existingRule) {
      return false;
    }

    policy.rules.push(rule);
    this.policies.set(policyId, { ...policy });
    return true;
  }

  updateRuleInPolicy(policyId: string, ruleId: string, updates: Partial<ApprovalRule>): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    const ruleIndex = policy.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    policy.rules[ruleIndex] = { ...policy.rules[ruleIndex], ...updates };
    this.policies.set(policyId, { ...policy });
    return true;
  }

  removeRuleFromPolicy(policyId: string, ruleId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    const initialLength = policy.rules.length;
    policy.rules = policy.rules.filter(r => r.id !== ruleId);
    
    if (policy.rules.length === initialLength) {
      return false; // Rule wasn't found
    }

    this.policies.set(policyId, { ...policy });
    return true;
  }

  // Common policy templates
  createContentModerationPolicy(): ApprovalPolicy {
    return {
      id: 'content-moderation-template',
      name: 'Content Moderation Policy',
      description: 'Standard policy for moderating user-generated content',
      rules: [
        {
          id: 'long-content-rule',
          name: 'Long Content Rule',
          description: 'Require approval for content longer than specified length',
          actionType: ActionType.POST,
          conditions: [
            {
              field: 'contentLength',
              operator: 'greaterThan',
              value: 1000
            }
          ],
          priority: 1,
          autoApprove: false,
          approvers: [],
          requiredApprovals: 1,
          expirationMinutes: 1440,
          enabled: true
        },
        {
          id: 'external-links-rule',
          name: 'External Links Rule',
          description: 'Require approval for posts containing external links',
          actionType: ActionType.POST,
          conditions: [
            {
              field: 'containsUrl',
              operator: 'equals',
              value: true
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
          id: 'first-time-poster-rule',
          name: 'First Time Poster Rule',
          description: 'Require approval for first-time posters',
          actionType: ActionType.POST,
          conditions: [
            {
              field: 'isNewPoster',
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
  }

  createSensitiveActionsPolicy(): ApprovalPolicy {
    return {
      id: 'sensitive-actions-template',
      name: 'Sensitive Actions Policy',
      description: 'Policy for sensitive actions requiring multiple approvals',
      rules: [
        {
          id: 'delete-content-rule',
          name: 'Delete Content Rule',
          description: 'Require multiple approvals for deleting content',
          actionType: ActionType.DELETE,
          conditions: [],
          priority: 1,
          autoApprove: false,
          approvers: [],
          requiredApprovals: 2,
          expirationMinutes: 1440,
          enabled: true
        },
        {
          id: 'access-sensitive-data-rule',
          name: 'Access Sensitive Data Rule',
          description: 'Require senior approval for accessing sensitive data',
          actionType: ActionType.ACCESS_DATA,
          conditions: [
            {
              field: 'dataType',
              operator: 'equals',
              value: 'sensitive'
            }
          ],
          priority: 2,
          autoApprove: false,
          approvers: [],
          requiredApprovals: 2,
          expirationMinutes: 60, // 1 hour for sensitive data
          enabled: true
        }
      ],
      defaultAction: 'request_approval',
      enabled: true
    };
  }

  createAutomatedApprovalPolicy(): ApprovalPolicy {
    return {
      id: 'automated-approval-template',
      name: 'Automated Approval Policy',
      description: 'Policy for automatically approving trusted content',
      rules: [
        {
          id: 'trusted-user-rule',
          name: 'Trusted User Rule',
          description: 'Auto-approve content from trusted users',
          actionType: ActionType.POST,
          conditions: [
            {
              field: 'trustScore',
              operator: 'greaterThan',
              value: 90
            }
          ],
          priority: 1,
          autoApprove: true,
          approvers: [],
          requiredApprovals: 0,
          expirationMinutes: 0,
          enabled: true
        },
        {
          id: 'short-benign-content-rule',
          name: 'Short Benign Content Rule',
          description: 'Auto-approve short, non-link content',
          actionType: ActionType.POST,
          conditions: [
            {
              field: 'contentLength',
              operator: 'lessThan',
              value: 100
            },
            {
              field: 'containsUrl',
              operator: 'equals',
              value: false
            },
            {
              field: 'hasBadWords',
              operator: 'equals',
              value: false
            }
          ],
          priority: 2,
          autoApprove: true,
          approvers: [],
          requiredApprovals: 0,
          expirationMinutes: 0,
          enabled: true
        }
      ],
      defaultAction: 'request_approval',
      enabled: true
    };
  }

  // Create a default configuration with common policies
  createDefaultConfig(): ApprovalConfig {
    const contentModerationPolicy = this.createContentModerationPolicy();
    const sensitiveActionsPolicy = this.createSensitiveActionsPolicy();
    const automatedApprovalPolicy = this.createAutomatedApprovalPolicy();

    return {
      enabled: true,
      policies: [
        contentModerationPolicy,
        sensitiveActionsPolicy,
        automatedApprovalPolicy
      ],
      autoApproveThreshold: 80,
      notificationChannels: ['dashboard', 'email'],
      requireApprovalFor: [
        ActionType.POST,
        ActionType.REPLY,
        ActionType.DELETE,
        ActionType.ACCESS_DATA,
        ActionType.EXECUTE_TOOL
      ]
    };
  }
}