export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export enum ActionType {
  POST = 'post',
  REPLY = 'reply',
  EDIT = 'edit',
  DELETE = 'delete',
  EXECUTE_TOOL = 'execute_tool',
  SEND_MESSAGE = 'send_message',
  ACCESS_DATA = 'access_data',
  CUSTOM = 'custom'
}

export interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  actionType: ActionType;
  conditions: ApprovalCondition[];
  priority: number; // Lower numbers have higher priority
  autoApprove: boolean; // Whether to auto-approve if conditions are met
  approvers: string[]; // User IDs who can approve
  requiredApprovals: number; // Number of approvals required
  expirationMinutes: number; // Minutes before approval expires
  enabled: boolean;
}

export interface ApprovalCondition {
  field: string; // Field to check (e.g., 'contentLength', 'containsUrls', etc.)
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'matchesRegex' | 'startsWith' | 'endsWith';
  value: any; // Value to compare against
}

export interface ApprovalRequest {
  id: string;
  actionType: ActionType;
  actionData: any; // The actual action data
  requesterId: string; // Who initiated the action
  requesterName: string;
  status: ApprovalStatus;
  ruleId: string; // Which rule triggered this approval
  approvers: ApprovalStep[];
  createdAt: Date;
  expiresAt: Date;
  reason?: string; // Why the action needs approval
  metadata?: Record<string, any>;
}

export interface ApprovalStep {
  approverId: string;
  approverName: string;
  status: ApprovalStatus.PENDING | ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;
  approvedAt?: Date;
  comment?: string;
}

export interface ApprovalPolicy {
  id: string;
  name: string;
  description: string;
  rules: ApprovalRule[];
  defaultAction: 'approve' | 'reject' | 'request_approval'; // What to do if no rules match
  enabled: boolean;
}

export interface ApprovalConfig {
  enabled: boolean;
  policies: ApprovalPolicy[];
  autoApproveThreshold: number; // Confidence threshold for auto-approval
  notificationChannels: string[]; // Where to send approval notifications
  requireApprovalFor: ActionType[]; // Which actions require approval by default
}