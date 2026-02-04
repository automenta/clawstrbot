import express, { Request, Response } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { ActivityDistribution } from './activity-scheduler';
import { MemoryItem } from './memory-system';

export interface DashboardOptions {
  title?: string;
  port?: number;
  host?: string;
}

export class WebDashboard {
  private app: express.Application;
  private server: HTTPServer;
  private io: Server;
  private port: number;
  private host: string;
  private title: string;

  private isBotRunning: boolean = true; // Start in running state by default
  private messages: string[] = [];
  private currentActivityDistribution: ActivityDistribution = {
    read: 30,
    think: 30,
    post: 0,
    reply: 0,
    idle: 40
  };
  private currentMemories: MemoryItem[] = [];
  private botInstance: any; // Reference to the bot instance to access memory operations
  private behaviorManagementCallback?: (action: string, params?: any) => void; // Kept for compatibility but not actively used in UI
  private activityDistributionCallback?: (distribution: ActivityDistribution) => void;
  private memoryInsertionCallback?: (content: string, type: string, priority: number) => void;

  constructor(options: DashboardOptions = {}) {
    this.port = options.port || 3000;
    this.host = options.host || '0.0.0.0';
    this.title = options.title || 'Clawstr Bot Dashboard';

    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Serve the main HTML page
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Handle socket connections
    this.io.on('connection', (socket: Socket) => {
      console.log('A user connected');

      // Send initial state
      socket.emit('initial_state', {
        botStatus: this.getBotStatus(),
        isBotRunning: this.isBotRunning,
        messages: this.messages,
        activityDistribution: this.currentActivityDistribution,
        memories: this.currentMemories
      });

      // Listen for run/pause commands
      socket.on('toggle_run_pause', () => {
        this.toggleRunPause();
        this.broadcastBotStatus();
      });

      // Listen for activity distribution changes
      socket.on('update_activity_distribution', (data: ActivityDistribution) => {
        this.updateActivityDistribution(data);
      });

      // Listen for memory insertion
      socket.on('insert_memory', (data: { content: string, type: string, priority: number }) => {
        this.insertMemory(data.content, data.type, data.priority);
      });

      // Listen for memory deletion
      socket.on('delete_memory', (data: { memoryId: string }) => {
        this.deleteMemory(data.memoryId);
      });

      // Listen for memory priority updates
      socket.on('update_memory_priority', (data: { memoryId: string, priority: number }) => {
        this.updateMemoryPriority(data.memoryId, data.priority);
      });

      // Listen for behavior management commands (kept for compatibility)
      socket.on('behavior_management', (data: { action: string, params?: any }) => {
        if (this.behaviorManagementCallback) {
          this.behaviorManagementCallback(data.action, data.params);
        }
      });

      socket.on('disconnect', () => {
        console.log('A user disconnected');
      });
    });
  }

  private getBotStatus(): string {
    return `Status: ${this.isBotRunning ? 'Running' : 'Paused'}\nTitle: ${this.title}`;
  }

  private broadcastBotStatus(): void {
    this.io.emit('bot_status_update', {
      status: this.getBotStatus(),
      isBotRunning: this.isBotRunning
    });
  }

  private updateActivityDistribution(distribution: ActivityDistribution): void {
    this.currentActivityDistribution = { ...distribution };

    // Normalize the distribution so it sums to 100%
    this.normalizeDistribution();

    // Update behavior states based on distribution values
    this.updateBehaviorStatesFromDistribution();

    // Emit the updated distribution
    this.io.emit('activity_distribution_update', this.currentActivityDistribution);

    // Call the callback if available
    if (this.activityDistributionCallback) {
      this.activityDistributionCallback(this.currentActivityDistribution);
    }
  }

  private normalizeDistribution(): void {
    // Calculate the current sum
    const currentSum = Object.values(this.currentActivityDistribution).reduce((sum, val) => sum + val, 0);

    // If the sum is not 100, scale all values proportionally
    if (currentSum !== 100) {
      const scaleFactor = 100 / currentSum;

      for (const key of Object.keys(this.currentActivityDistribution) as Array<keyof ActivityDistribution>) {
        this.currentActivityDistribution[key] = Math.round(this.currentActivityDistribution[key] * scaleFactor);
      }

      // Adjust for rounding errors by reducing the largest value
      const finalSum = Object.values(this.currentActivityDistribution).reduce((sum, val) => sum + val, 0);
      if (finalSum !== 100) {
        // Find the largest value and adjust it
        let maxKey: keyof ActivityDistribution = 'read';
        let maxValue = -Infinity;
        for (const [key, value] of Object.entries(this.currentActivityDistribution) as [keyof ActivityDistribution, number][]) {
          if (value > maxValue) {
            maxValue = value;
            maxKey = key;
          }
        }

        this.currentActivityDistribution[maxKey] -= (finalSum - 100);
      }
    }
  }

  /**
   * Update behavior enable/disable status based on activity distribution values
   * If a behavior's value is 0, it should be disabled; otherwise, enabled
   */
  private updateBehaviorStatesFromDistribution(): void {
    if (this.behaviorManagementCallback) {
      // Process each behavior type based on its distribution value
      Object.entries(this.currentActivityDistribution).forEach(([behaviorType, value]) => {
        if (behaviorType !== 'idle') { // Don't manage idle behavior as it's always active
          const isEnabled = value > 0;
          const action = isEnabled ? 'enable' : 'disable';

          // Call the behavior management callback to update the agent
          this.behaviorManagementCallback!(action, { behaviorType });
        }
      });
    }
  }

  /**
   * Insert a new memory directly from the UI
   */
  private insertMemory(content: string, type: string, priority: number): void {
    // Call the memory insertion callback if available
    if (this.memoryInsertionCallback) {
      this.memoryInsertionCallback(content, type, priority);
    }

    // Add to current memories
    const newMemory = {
      id: `ui-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: content,
      type: type,
      priority: priority,
      timestamp: new Date(),
      tags: ['ui-inserted'],
      metadata: {
        insertedVia: 'web-ui',
        timestamp: new Date().toISOString()
      }
    };

    this.currentMemories.unshift(newMemory); // Add to the beginning to show newest first

    // Keep only the most recent memories (limit to 50)
    if (this.currentMemories.length > 50) {
      this.currentMemories = this.currentMemories.slice(0, 50);
    }

    // Broadcast the updated memories to all clients
    this.io.emit('memories_updated', this.currentMemories);

    // Add a message to the log about the inserted memory
    this.addMessage(`Inserted memory via UI: [${priority}] ${type}: ${content.substring(0, 50)}...`);
  }

  /**
   * Delete a memory by ID
   */
  private deleteMemory(memoryId: string): void {
    // Remove from current memories
    this.currentMemories = this.currentMemories.filter(memory => memory.id !== memoryId);

    // If we have a bot instance, try to remove from the bot's memory system too
    if (this.botInstance && typeof this.botInstance.removeMemory === 'function') {
      try {
        this.botInstance.removeMemory(memoryId);
        this.addMessage(`Deleted memory via UI: ${memoryId}`);
      } catch (error) {
        console.error('Error removing memory from bot:', error);
        this.addMessage(`Failed to delete memory from bot: ${memoryId}`);
      }
    } else {
      this.addMessage(`Deleted memory from UI cache: ${memoryId}`);
    }

    // Broadcast the updated memories to all clients
    this.io.emit('memories_updated', this.currentMemories);
  }

  /**
   * Update the priority of a memory
   */
  private updateMemoryPriority(memoryId: string, newPriority: number): void {
    // Find and update the memory in current memories
    const memoryIndex = this.currentMemories.findIndex(memory => memory.id === memoryId);
    if (memoryIndex !== -1) {
      this.currentMemories[memoryIndex].priority = newPriority;

      // If we have a bot instance, try to update in the bot's memory system too
      if (this.botInstance && typeof this.botInstance.updateMemory === 'function') {
        try {
          this.botInstance.updateMemory(memoryId, { priority: newPriority });
          this.addMessage(`Updated memory priority via UI: [${newPriority}] ${this.currentMemories[memoryIndex].content.substring(0, 50)}...`);
        } catch (error) {
          console.error('Error updating memory in bot:', error);
          this.addMessage(`Failed to update memory in bot: ${memoryId}`);
        }
      } else {
        this.addMessage(`Updated memory priority in UI cache: [${newPriority}] ${this.currentMemories[memoryIndex].content.substring(0, 50)}...`);
      }

      // Broadcast the updated memories to all clients
      this.io.emit('memories_updated', this.currentMemories);
    }
  }

  public setActivityDistributionCallback(callback: (distribution: ActivityDistribution) => void): void {
    this.activityDistributionCallback = callback;
  }

  public setBehaviorManagementCallback(callback: (action: string, params?: any) => void): void {
    this.behaviorManagementCallback = callback;
  }

  public updateBotStatus(status: string): void {
    this.io.emit('bot_status_update', {
      status: status,
      isBotRunning: this.isBotRunning
    });
  }

  public addMessage(message: string): void {
    const timestampedMessage = `${new Date().toLocaleTimeString()} - ${message}`;
    this.messages.push(timestampedMessage);

    // Keep only the last 100 messages
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }

    this.io.emit('message_added', timestampedMessage);
  }

  private toggleRunPause(): void {
    this.isBotRunning = !this.isBotRunning;
    this.broadcastBotStatus();
  }

  public isPaused(): boolean {
    return !this.isBotRunning;
  }

  public isRunning(): boolean {
    return this.isBotRunning;
  }

  public updateMemories(memories: MemoryItem[]): void {
    this.currentMemories = [...memories]; // Create a copy to avoid reference issues
    this.io.emit('memories_updated', this.currentMemories);
  }

  public getMemoryList(): MemoryItem[] {
    return [...this.currentMemories];
  }

  public start(): void {
    this.server.listen(this.port, this.host, () => {
      console.log(`Web dashboard running at http://${this.host}:${this.port}`);
    });
  }

  public stop(): void {
    this.server.close(() => {
      console.log('Web dashboard stopped');
    });
  }

  public setBotInstance(bot: any): void {
    this.botInstance = bot;
  }

  public setMemoryInsertionCallback(callback: (content: string, type: string, priority: number) => void): void {
    this.memoryInsertionCallback = callback;
  }

  public setStatus(text: string): void {
    this.io.emit('bot_status_update', {
      status: text,
      isBotRunning: this.isBotRunning
    });
  }

  public isStarted(): boolean {
    // Simple check - in a real implementation you'd track the server state better
    return this.server.listening;
  }

  public render(): void {
    // In a web UI, rendering happens automatically via socket updates
  }
}