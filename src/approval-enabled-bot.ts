import { EnhancedClawstrBot, Message } from './enhanced-bot';
import { ApprovalSystem } from './approval-system';
import { ApprovalRequest, ApprovalStatus, ActionType } from './approval-types';
import { Account } from './account-manager';

export interface ApprovalEnabledBotConfig {
  bot: EnhancedClawstrBot;
  approvalSystem: ApprovalSystem;
}

export class ApprovalEnabledBot {
  private bot: EnhancedClawstrBot;
  private approvalSystem: ApprovalSystem;

  constructor(config: ApprovalEnabledBotConfig) {
    this.bot = config.bot;
    this.approvalSystem = config.approvalSystem;
  }

  async processInputWithApproval(input: string, requester: Account): Promise<{ approved: boolean; result?: string; approvalRequest?: ApprovalRequest }> {
    // Evaluate if this action needs approval
    const actionData = {
      content: input,
      contentType: 'text',
      length: input.length
    };

    const approvalRequest = await this.approvalSystem.evaluateAction(ActionType.SEND_MESSAGE, actionData, requester);

    if (approvalRequest) {
      // Action requires approval
      return {
        approved: false,
        approvalRequest
      };
    }

    // No approval needed, process directly
    try {
      const result = await this.bot.processInput(input);
      return {
        approved: true,
        result
      };
    } catch (error) {
      throw error;
    }
  }

  async postContentWithApproval(content: string, requester: Account): Promise<{ approved: boolean; result?: string; approvalRequest?: ApprovalRequest }> {
    // Evaluate if this action needs approval
    const actionData = {
      content,
      contentType: 'post',
      length: content.length,
      wordCount: content.split(/\s+/).filter(w => w.length > 0).length
    };

    const approvalRequest = await this.approvalSystem.evaluateAction(ActionType.POST, actionData, requester);

    if (approvalRequest) {
      // Action requires approval
      return {
        approved: false,
        approvalRequest
      };
    }

    // No approval needed, process directly
    try {
      const result = await this.bot.processInput(`Post this content: ${content}`);
      return {
        approved: true,
        result
      };
    } catch (error) {
      throw error;
    }
  }

  async replyToContentWithApproval(originalContent: string, reply: string, requester: Account): Promise<{ approved: boolean; result?: string; approvalRequest?: ApprovalRequest }> {
    // Evaluate if this action needs approval
    const actionData = {
      originalContent,
      replyContent: reply,
      contentType: 'reply',
      length: reply.length,
      wordCount: reply.split(/\s+/).filter(w => w.length > 0).length
    };

    const approvalRequest = await this.approvalSystem.evaluateAction(ActionType.REPLY, actionData, requester);

    if (approvalRequest) {
      // Action requires approval
      return {
        approved: false,
        approvalRequest
      };
    }

    // No approval needed, process directly
    try {
      const result = await this.bot.processInput(`Reply to this: "${originalContent}" with: "${reply}"`);
      return {
        approved: true,
        result
      };
    } catch (error) {
      throw error;
    }
  }

  async executeToolWithApproval(toolName: string, params: any, requester: Account): Promise<{ approved: boolean; result?: any; approvalRequest?: ApprovalRequest }> {
    // Evaluate if this action needs approval
    const actionData = {
      toolName,
      parameters: params,
      actionType: 'tool_execution'
    };

    const approvalRequest = await this.approvalSystem.evaluateAction(ActionType.EXECUTE_TOOL, actionData, requester);

    if (approvalRequest) {
      // Action requires approval
      return {
        approved: false,
        approvalRequest
      };
    }

    // No approval needed, execute directly
    try {
      // In a real implementation, this would connect to the agent's tool system
      // For now, we'll simulate the tool execution
      const result = `Simulated execution of tool: ${toolName} with params: ${JSON.stringify(params)}`;
      return {
        approved: true,
        result
      };
    } catch (error) {
      throw error;
    }
  }

  // Methods to handle approval requests
  async approveRequest(requestId: string, approver: Account, comment?: string): Promise<boolean> {
    return await this.approvalSystem.approveRequest(requestId, approver, comment);
  }

  async rejectRequest(requestId: string, approver: Account, comment?: string): Promise<boolean> {
    return await this.approvalSystem.rejectRequest(requestId, approver, comment);
  }

  async cancelRequest(requestId: string, requester: Account): Promise<boolean> {
    return await this.approvalSystem.cancelRequest(requestId, requester);
  }

  // Getters for approval requests
  getPendingRequests(): ApprovalRequest[] {
    return this.approvalSystem.getPendingRequests();
  }

  getRequestsByRequester(requesterId: string): ApprovalRequest[] {
    return this.approvalSystem.getRequestsByRequester(requesterId);
  }

  getRequestsByApprover(approverId: string): ApprovalRequest[] {
    return this.approvalSystem.getRequestsByApprover(approverId);
  }

  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.approvalSystem.getRequest(requestId);
  }

  // Access to underlying systems
  getBot(): EnhancedClawstrBot {
    return this.bot;
  }

  getApprovalSystem(): ApprovalSystem {
    return this.approvalSystem;
  }

  // Check if an action is approved
  async isActionApproved(actionType: ActionType, actionData: any, requester: Account): Promise<boolean> {
    const approvalRequest = await this.approvalSystem.evaluateAction(actionType, actionData, requester);
    return approvalRequest === null; // If no approval request was created, it's approved
  }
}