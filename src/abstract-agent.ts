import { Message } from './enhanced-bot';

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface AgentAction {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>; // Schema for parameters
  handler: (params: Record<string, any>) => Promise<any>;
}

export interface AgentActionResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AgentState {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  lastAction?: AgentAction;
  lastResult?: AgentActionResult;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export abstract class AbstractAgent {
  protected config: AgentConfig;
  protected actions: Map<string, AgentAction> = new Map();
  protected state: AgentState;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      id: config.id,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { ...config.metadata }
    };
    this.initializeActions();
  }

  /**
   * Initialize agent-specific actions
   */
  protected abstract initializeActions(): void;

  /**
   * Add an action to the agent
   */
  protected addAction(action: AgentAction): void {
    this.actions.set(action.name, action);
  }

  /**
   * Execute an action by name with parameters
   */
  async executeAction(actionName: string, params: Record<string, any>): Promise<AgentActionResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: `Agent ${this.config.id} is disabled`,
      };
    }

    const action = this.actions.get(actionName);
    if (!action) {
      return {
        success: false,
        error: `Action ${actionName} not found`,
      };
    }

    try {
      this.state.status = 'running';
      this.state.lastAction = action;
      this.state.updatedAt = new Date();

      const result = await action.handler(params);

      this.state.lastResult = {
        success: true,
        result,
        metadata: { timestamp: new Date() }
      };
      this.state.status = 'idle';
      this.state.updatedAt = new Date();

      return {
        success: true,
        result,
        metadata: { actionId: action.id, timestamp: new Date() }
      };
    } catch (error) {
      this.state.status = 'error';
      this.state.lastResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { timestamp: new Date() }
      };
      this.state.updatedAt = new Date();

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all available actions
   */
  getActions(): AgentAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get action by name
   */
  getAction(name: string): AgentAction | undefined {
    return this.actions.get(name);
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Update agent configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    this.state.updatedAt = new Date();
  }

  /**
   * Enable/disable the agent
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.state.updatedAt = new Date();
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Perform any cleanup when agent is destroyed
   */
  async destroy(): Promise<void> {
    this.state.status = 'idle';
    this.state.updatedAt = new Date();
  }

  /**
   * Pause the agent
   */
  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
      this.state.updatedAt = new Date();
    }
  }

  /**
   * Resume the agent
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'idle';
      this.state.updatedAt = new Date();
    }
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.state.status = 'idle';
    this.state.lastAction = undefined;
    this.state.lastResult = undefined;
    this.state.updatedAt = new Date();
  }
}