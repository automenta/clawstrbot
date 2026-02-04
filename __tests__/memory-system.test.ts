import { PrioritizedMemorySystem } from '../src/memory-system';

describe('PrioritizedMemorySystem', () => {
  let memorySystem: PrioritizedMemorySystem;

  beforeEach(() => {
    memorySystem = new PrioritizedMemorySystem({
      maxSize: 10,
      evictionThreshold: 0.2,
      defaultPriority: 5
    });
  });

  test('should add a memory item', () => {
    const id = memorySystem.add({
      content: 'test content',
      type: 'test',
      priority: 5
    });
    const item = memorySystem.get(id);
    expect(item).toBeDefined();
    expect(item?.content).toBe('test content');
    expect(item?.type).toBe('test');
    expect(item?.priority).toBe(5);
  });

  test('should update a memory item', () => {
    const id = memorySystem.add({
      content: 'test content',
      type: 'test',
      priority: 5
    });

    memorySystem.update(id, { content: 'updated content' });
    const item = memorySystem.get(id);
    expect(item?.content).toBe('updated content');
  });

  test('should remove a memory item', () => {
    const id = memorySystem.add({
      content: 'test content',
      type: 'test',
      priority: 5
    });

    const removed = memorySystem.remove(id);
    expect(removed).toBe(true);
    const item = memorySystem.get(id);
    expect(item).toBeUndefined();
  });

  test('should search memory items', () => {
    memorySystem.add({
      content: 'apple',
      type: 'fruit',
      priority: 5
    });
    memorySystem.add({
      content: 'banana',
      type: 'fruit',
      priority: 5
    });

    const results = memorySystem.search('app');
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('apple');
  });

  test('should evict lowest priority items when full', () => {
    // Fill memory with 10 items
    for (let i = 0; i < 10; i++) {
      memorySystem.add({
        content: `item ${i}`,
        type: 'test',
        priority: i // priorities 0 to 9
      });
    }

    expect(memorySystem.getStats().size).toBe(10);

    // Add one more item with high priority
    memorySystem.add({
      content: 'new item',
      type: 'test',
      priority: 10
    });

    // Should have evicted 2 items (20% of 10)
    // So size should be 10 - 2 + 1 = 9
    expect(memorySystem.getStats().size).toBe(9);

    // Should have evicted items with priority 0 and 1
    // And item with priority 2 should be there
    const allItems = memorySystem.getAll();
    const priorities = allItems.map(item => item.priority);
    expect(priorities).not.toContain(0);
    expect(priorities).not.toContain(1);
    expect(priorities).toContain(10);
  });
});
