import { EventEmitter } from 'events';

export interface MemoryItem {
  id: string;
  content: string;
  type: string; // e.g., 'observation', 'thought', 'interaction', 'knowledge'
  priority: number; // Higher number means higher priority (0-10 scale)
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface MemoryConfig {
  maxSize: number; // Maximum number of items in memory
  evictionThreshold?: number; // Percentage of memory to free when at capacity (default: 0.2 for 20%)
  defaultPriority?: number; // Default priority for new items (default: 5)
}

export class PrioritizedMemorySystem extends EventEmitter {
  private memory: Map<string, MemoryItem> = new Map();
  private sortedKeys: string[] = []; // Keys sorted by priority and timestamp
  private config: MemoryConfig;
  private size: number = 0;

  constructor(config: MemoryConfig) {
    super();
    this.config = {
      evictionThreshold: 0.2, // Evict 20% when full
      defaultPriority: 5,
      ...config
    };
  }

  /**
   * Add a new memory item
   */
  add(item: Omit<MemoryItem, 'id' | 'timestamp'> & Partial<Pick<MemoryItem, 'id'>>): string {
    const id = item.id || this.generateId();
    const memoryItem: MemoryItem = {
      id,
      content: item.content,
      type: item.type,
      priority: item.priority ?? this.config.defaultPriority!,
      timestamp: new Date(),
      tags: item.tags,
      metadata: item.metadata
    };

    // Check if memory is at capacity
    if (this.size >= this.config.maxSize) {
      this.evictLowestPriorityItems();
    }

    this.memory.set(id, memoryItem);
    this.size++;
    
    // Re-sort the keys
    this.resortKeys();
    
    this.emit('memoryAdded', memoryItem);
    
    return id;
  }

  /**
   * Retrieve a memory item by ID
   */
  get(id: string): MemoryItem | undefined {
    return this.memory.get(id);
  }

  /**
   * Update an existing memory item
   */
  update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'timestamp'>>): boolean {
    const existing = this.memory.get(id);
    if (!existing) {
      return false;
    }

    const updatedItem: MemoryItem = {
      id: existing.id,
      content: updates.content ?? existing.content,
      type: updates.type ?? existing.type,
      priority: updates.priority ?? existing.priority,
      timestamp: ('timestamp' in updates && updates.timestamp) ? updates.timestamp as Date : existing.timestamp, // Don't update timestamp unless explicitly provided
      tags: updates.tags ?? existing.tags,
      metadata: updates.metadata ?? existing.metadata
    };

    this.memory.set(id, updatedItem);
    this.resortKeys();
    
    this.emit('memoryUpdated', updatedItem);
    
    return true;
  }

  /**
   * Remove a memory item by ID
   */
  remove(id: string): boolean {
    const deleted = this.memory.delete(id);
    if (deleted) {
      this.size--;
      this.resortKeys();
      this.emit('memoryRemoved', id);
    }
    return deleted;
  }

  /**
   * Find memories by type
   */
  findByType(type: string, limit?: number): MemoryItem[] {
    const results: MemoryItem[] = [];
    for (const item of this.memory.values()) {
      if (item.type === type) {
        results.push(item);
      }
    }
    
    // Sort by priority (descending) then by timestamp (descending)
    results.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Find memories by tag
   */
  findByTag(tag: string, limit?: number): MemoryItem[] {
    const results: MemoryItem[] = [];
    for (const item of this.memory.values()) {
      if (item.tags && item.tags.includes(tag)) {
        results.push(item);
      }
    }
    
    // Sort by priority (descending) then by timestamp (descending)
    results.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Search memories by content (simple text search)
   */
  search(query: string, limit?: number): MemoryItem[] {
    const queryLower = query.toLowerCase();
    const results: MemoryItem[] = [];
    
    for (const item of this.memory.values()) {
      if (item.content.toLowerCase().includes(queryLower)) {
        results.push(item);
      }
    }
    
    // Sort by priority (descending) then by timestamp (descending)
    results.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Get all memories, sorted by priority and recency
   */
  getAll(limit?: number): MemoryItem[] {
    const results: MemoryItem[] = [];
    for (const key of this.sortedKeys) {
      results.push(this.memory.get(key)!);
    }
    
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Get memories by priority range
   */
  getByPriority(minPriority: number, maxPriority: number, limit?: number): MemoryItem[] {
    const results: MemoryItem[] = [];
    for (const item of this.memory.values()) {
      if (item.priority >= minPriority && item.priority <= maxPriority) {
        results.push(item);
      }
    }
    
    // Sort by priority (descending) then by timestamp (descending)
    results.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Get current memory usage statistics
   */
  getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.size,
      maxSize: this.config.maxSize,
      utilization: this.size / this.config.maxSize
    };
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memory.clear();
    this.sortedKeys = [];
    this.size = 0;
    this.emit('memoryCleared');
  }

  /**
   * Evict lowest priority items to make space
   */
  private evictLowestPriorityItems(): void {
    const evictionCount = Math.ceil(this.config.maxSize * this.config.evictionThreshold!);
    
    // Get items sorted by priority (ascending) and timestamp (ascending) to evict oldest lowest priority items
    const sortedItems = Array.from(this.memory.values())
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority; // Lower priority first
        }
        return a.timestamp.getTime() - b.timestamp.getTime(); // Older first
      });
    
    const itemsToRemove = sortedItems.slice(0, evictionCount);
    
    for (const item of itemsToRemove) {
      this.memory.delete(item.id);
      this.size--;
      this.emit('memoryEvicted', item);
    }
    
    this.resortKeys();
  }

  /**
   * Resort the keys based on priority and timestamp
   */
  private resortKeys(): void {
    this.sortedKeys = Array.from(this.memory.entries())
      .sort(([_, a], [__, b]) => {
        // Sort by priority descending, then by timestamp descending (most recent first)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
      })
      .map(([key, _]) => key);
  }

  /**
   * Generate a unique ID for memory items
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}