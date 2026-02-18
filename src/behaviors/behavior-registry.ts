import { BaseBehavior, BehaviorFactory, BehaviorType } from './base-behavior';
import { registerDefaultFactories } from './behavior-factories';

export interface BehaviorRegistryOptions {
  autoRegisterDefaults?: boolean;
}

export class BehaviorRegistry {
  private static instance: BehaviorRegistry;
  private behaviors: Map<string, BaseBehavior> = new Map();
  private factories: Map<BehaviorType, BehaviorFactory> = new Map();
  private typeToIdMap: Map<BehaviorType, string[]> = new Map();

  private constructor(options?: BehaviorRegistryOptions) {
    if (options?.autoRegisterDefaults) {
      this.registerDefaultBehaviors();
    }
  }

  public static getInstance(options?: BehaviorRegistryOptions): BehaviorRegistry {
    if (!BehaviorRegistry.instance) {
      BehaviorRegistry.instance = new BehaviorRegistry(options);
    }
    return BehaviorRegistry.instance;
  }

  /**
   * Register a behavior factory
   */
  registerFactory<T extends BaseBehavior>(factory: BehaviorFactory<T>): void {
    this.factories.set(factory.type, factory);
  }

  /**
   * Create and register a behavior using a factory
   */
  createAndRegister(type: BehaviorType, config: any): BaseBehavior | null {
    const factory = this.factories.get(type);
    if (!factory) {
      console.error(`No factory registered for behavior type: ${type}`);
      return null;
    }

    const behavior = factory.create(config);
    this.register(behavior);
    return behavior;
  }

  /**
   * Register a behavior instance
   */
  register(behavior: BaseBehavior): void {
    this.behaviors.set(behavior.getConfig().id, behavior);
    
    // Track by type
    const type = behavior.getConfig().type;
    if (!this.typeToIdMap.has(type)) {
      this.typeToIdMap.set(type, []);
    }
    this.typeToIdMap.get(type)!.push(behavior.getConfig().id);
  }

  /**
   * Unregister a behavior
   */
  unregister(id: string): boolean {
    const behavior = this.behaviors.get(id);
    if (!behavior) {
      return false;
    }

    // Remove from type mapping
    const type = behavior.getConfig().type;
    const ids = this.typeToIdMap.get(type) || [];
    const index = ids.indexOf(id);
    if (index !== -1) {
      ids.splice(index, 1);
      if (ids.length === 0) {
        this.typeToIdMap.delete(type);
      } else {
        this.typeToIdMap.set(type, ids);
      }
    }

    return this.behaviors.delete(id);
  }

  /**
   * Get a behavior by ID
   */
  get(id: string): BaseBehavior | undefined {
    return this.behaviors.get(id);
  }

  /**
   * Get all behaviors of a specific type
   */
  getByType(type: BehaviorType): BaseBehavior[] {
    const ids = this.typeToIdMap.get(type) || [];
    return ids.map(id => this.behaviors.get(id)!).filter(Boolean);
  }

  /**
   * Get all behaviors
   */
  getAll(): BaseBehavior[] {
    return Array.from(this.behaviors.values());
  }

  /**
   * Get all behavior IDs
   */
  getIds(): string[] {
    return Array.from(this.behaviors.keys());
  }

  /**
   * Get all behavior types
   */
  getTypes(): BehaviorType[] {
    return Array.from(this.typeToIdMap.keys());
  }

  /**
   * Check if a behavior exists
   */
  has(id: string): boolean {
    return this.behaviors.has(id);
  }

  /**
   * Enable a behavior
   */
  enable(id: string): boolean {
    const behavior = this.get(id);
    if (behavior) {
      behavior.setEnabled(true);
      return true;
    }
    return false;
  }

  /**
   * Disable a behavior
   */
  disable(id: string): boolean {
    const behavior = this.get(id);
    if (behavior) {
      behavior.setEnabled(false);
      return true;
    }
    return false;
  }

  /**
   * Execute a behavior by ID
   */
  async execute(id: string, context: any): Promise<any> {
    const behavior = this.get(id);
    if (!behavior) {
      throw new Error(`Behavior with ID ${id} not found`);
    }
    if (!behavior.isEnabled()) {
      throw new Error(`Behavior with ID ${id} is disabled`);
    }
    return await behavior.execute(context);
  }

  /**
   * Register default behaviors
   */
  private registerDefaultBehaviors(): void {
    // Register default behavior factories
    registerDefaultFactories(this);

    // Create and register default behavior instances
    this.createAndRegister('read', {
      id: 'default-read-behavior',
      name: 'Default Read Behavior',
      description: 'Default behavior for reading content',
      type: 'read',
      enabled: true,
      priority: 1
    });

    this.createAndRegister('think', {
      id: 'default-think-behavior',
      name: 'Default Think Behavior',
      description: 'Default behavior for thinking/reflecting',
      type: 'think',
      enabled: true,
      priority: 1
    });

    this.createAndRegister('post', {
      id: 'default-post-behavior',
      name: 'Default Post Behavior',
      description: 'Default behavior for creating posts',
      type: 'post',
      enabled: true,
      priority: 1
    });

    this.createAndRegister('reply', {
      id: 'default-reply-behavior',
      name: 'Default Reply Behavior',
      description: 'Default behavior for replying to posts',
      type: 'reply',
      enabled: true,
      priority: 1
    });

    this.createAndRegister('idle', {
      id: 'default-idle-behavior',
      name: 'Default Idle Behavior',
      description: 'Default behavior for idle time',
      type: 'idle',
      enabled: true,
      priority: 1
    });

    console.log('Registered default behaviors');
  }

  /**
   * Clear all behaviors
   */
  clear(): void {
    this.behaviors.clear();
    this.typeToIdMap.clear();
  }
}