export interface EventData {
  type: string;
  payload: any;
  timestamp: Date;
  source?: string;
}

export interface EventHandler {
  (event: EventData): void | Promise<void>;
}

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  id: string;
}

export class EventSystem {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventQueue: EventData[] = [];
  private isProcessing: boolean = false;

  constructor() {}

  subscribe(eventType: string, handler: EventHandler): string {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler);

    // Generate a unique subscription ID
    const subscriptionId = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.subscriptions.set(subscriptionId, {
      eventType,
      handler,
      id: subscriptionId
    });

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    const handlers = this.handlers.get(subscription.eventType);
    if (handlers) {
      handlers.delete(subscription.handler);
    }

    this.subscriptions.delete(subscriptionId);
    return true;
  }

  async emit(eventType: string, payload: any, source?: string): Promise<void> {
    const eventData: EventData = {
      type: eventType,
      payload,
      timestamp: new Date(),
      source
    };

    // Add to queue for async processing
    this.eventQueue.push(eventData);

    // Process events if not already processing
    if (!this.isProcessing) {
      await this.processEvents();
    }
  }

  private async processEvents(): Promise<void> {
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const eventData = this.eventQueue.shift()!;
      await this.dispatch(eventData);
    }

    this.isProcessing = false;
  }

  private async dispatch(eventData: EventData): Promise<void> {
    const handlers = this.handlers.get(eventData.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Execute all handlers for this event type
    const handlerPromises: Promise<void>[] = [];
    
    for (const handler of handlers) {
      try {
        const result = handler(eventData);
        if (result instanceof Promise) {
          handlerPromises.push(result);
        }
      } catch (error) {
        console.error(`Error in event handler for ${eventData.type}:`, error);
      }
    }

    // Wait for all async handlers to complete
    if (handlerPromises.length > 0) {
      await Promise.allSettled(handlerPromises);
    }
  }

  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  getSubscriptionCount(eventType: string): number {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  clearEventQueue(): void {
    this.eventQueue = [];
  }

  async waitForEvent(eventType: string, timeoutMs: number = 5000): Promise<EventData | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);

      const handler = (eventData: EventData) => {
        cleanup();
        resolve(eventData);
      };

      const subscriptionId = this.subscribe(eventType, handler);

      const cleanup = () => {
        clearTimeout(timeout);
        this.unsubscribe(subscriptionId);
      };
    });
  }
}