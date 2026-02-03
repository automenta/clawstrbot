import * as blessed from 'blessed';
const contrib: any = require('blessed-contrib');
import { ControlMode } from './control-manager';
import { Message } from './types';
import { ActivityDistribution } from './activity-scheduler';

export interface DashboardOptions {
  title?: string;
  width?: number;
  height?: number;
}

export class TUIDashboard {
  private screen!: blessed.Widgets.Screen;
  private grid!: any;
  private botStatus!: blessed.Widgets.BoxElement;
  private controlPanel!: blessed.Widgets.BoxElement;
  private messageLog!: blessed.Widgets.ListElement;
  private statusLine!: blessed.Widgets.TextElement;
  private modeIndicator!: blessed.Widgets.TextElement;

  private isRunning: boolean = false;
  private messages: string[] = [];
  private activityControls!: blessed.Widgets.BoxElement;
  private behaviorControls!: blessed.Widgets.BoxElement;
  private currentActivityDistribution: ActivityDistribution = {
    read: 30,
    think: 30,
    post: 0,
    reply: 0,
    idle: 40
  };
  private behaviorManagementCallback?: (action: string, params?: any) => void;

  constructor(options: DashboardOptions = {}) {
    // Set up the screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: options.title || 'Clawstr Bot Dashboard',
    });

    // Handle exit gracefully
    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });

    // Create grid layout
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Create widgets
    this.createWidgets();

    // Render the screen
    this.screen.render();
  }

  private createWidgets(): void {
    // Bot Status Panel (top left)
    this.botStatus = this.grid.set(0, 0, 4, 3, blessed.box, {
      label: 'Bot Status',
      border: { type: 'line' },
      style: { border: { fg: 'cyan' } },
      padding: 1,
      content: 'Initializing...'
    });

    // Activity Controls Panel (top middle-left)
    this.activityControls = this.grid.set(0, 3, 4, 3, blessed.box, {
      label: 'Activity Distribution',
      border: { type: 'line' },
      style: { border: { fg: 'magenta' } },
      padding: 1,
      content: this.getActivityControlsContent()
    });

    // Behavior Controls Panel (top middle-right)
    this.behaviorControls = this.grid.set(0, 6, 4, 3, blessed.box, {
      label: 'Behavior Management',
      border: { type: 'line' },
      style: { border: { fg: 'blue' } },
      padding: 1,
      content: this.getBehaviorControlsContent()
    });

    // Control Panel (top right)
    this.controlPanel = this.grid.set(0, 9, 4, 3, blessed.box, {
      label: 'Controls',
      border: { type: 'line' },
      style: { border: { fg: 'green' } },
      padding: 1,
      content: 'Press [M] Manual Mode\nPress [A] Auto Mode\nPress [S] Stop\nPress [Q] Quit\n\nActivity Controls:\n[1] Increase Read\n[2] Decrease Read\n[3] Increase Think\n[4] Decrease Think\n[5] Increase Post\n[6] Decrease Post\n[7] Increase Reply\n[8] Decrease Reply\n[9] Increase Idle\n[0] Decrease Idle\n\nBehavior Controls:\n[B] List Behaviors\n[E] Enable Behavior\n[D] Disable Behavior'
    });

    // Message Log (middle)
    this.messageLog = this.grid.set(4, 0, 6, 12, blessed.list, {
      label: 'Message Log',
      border: { type: 'line' },
      style: { border: { fg: 'yellow' }, selected: { bg: 'blue' } },
      padding: 1,
      mouse: true,
      keys: true,
      vi: true,
      scrollback: 1000,
      interactive: false
    });

    // Status Line (bottom)
    this.statusLine = this.grid.set(10, 0, 1, 10, blessed.text, {
      content: 'Ready',
      style: { fg: 'white', bg: 'blue' },
      padding: 1
    });

    // Mode Indicator (bottom right)
    this.modeIndicator = this.grid.set(10, 10, 1, 2, blessed.text, {
      content: 'MANUAL',
      style: { fg: 'black', bg: 'red' },
      align: 'center'
    });

    // Bind key events
    this.bindEvents();
  }

  private bindEvents(): void {
    // Mode switching
    this.screen.key(['m'], () => {
      this.setMode(ControlMode.MANUAL);
    });

    this.screen.key(['a'], () => {
      this.setMode(ControlMode.AUTOMATIC);
    });

    this.screen.key(['s'], () => {
      this.stop();
    });

    // Activity distribution controls
    this.screen.key(['1'], () => {
      this.adjustActivity('read', 5);
    });
    this.screen.key(['2'], () => {
      this.adjustActivity('read', -5);
    });
    this.screen.key(['3'], () => {
      this.adjustActivity('think', 5);
    });
    this.screen.key(['4'], () => {
      this.adjustActivity('think', -5);
    });
    this.screen.key(['5'], () => {
      this.adjustActivity('post', 5);
    });
    this.screen.key(['6'], () => {
      this.adjustActivity('post', -5);
    });
    this.screen.key(['7'], () => {
      this.adjustActivity('reply', 5);
    });
    this.screen.key(['8'], () => {
      this.adjustActivity('reply', -5);
    });
    this.screen.key(['9'], () => {
      this.adjustActivity('idle', 5);
    });
    this.screen.key(['0'], () => {
      this.adjustActivity('idle', -5);
    });

    // Behavior management controls
    this.screen.key(['b'], () => {
      this.requestBehaviorList();
    });
    this.screen.key(['e'], () => {
      this.requestEnableBehavior();
    });
    this.screen.key(['d'], () => {
      this.requestDisableBehavior();
    });

    // Allow scrolling in message log
    this.messageLog.on('keypress', (ch: string, key: any) => {
      if (key.name === 'up') {
        this.messageLog.up(1);
      } else if (key.name === 'down') {
        this.messageLog.down(1);
      }
      this.screen.render();
    });
  }

  private requestBehaviorList(): void {
    if (this.behaviorManagementCallback) {
      this.behaviorManagementCallback('list');
    }
  }

  private requestEnableBehavior(): void {
    if (this.behaviorManagementCallback) {
      this.behaviorManagementCallback('enable');
    }
  }

  private requestDisableBehavior(): void {
    if (this.behaviorManagementCallback) {
      this.behaviorManagementCallback('disable');
    }
  }

  private getActivityControlsContent(): string {
    return `Read: ${this.currentActivityDistribution.read}%\n` +
           `Think: ${this.currentActivityDistribution.think}%\n` +
           `Post: ${this.currentActivityDistribution.post}%\n` +
           `Reply: ${this.currentActivityDistribution.reply}%\n` +
           `Idle: ${this.currentActivityDistribution.idle}%\n\n` +
           `Total: ${Object.values(this.currentActivityDistribution).reduce((sum, val) => sum + val, 0)}%`;
  }

  private getBehaviorControlsContent(): string {
    return `Behavior Management\n\n` +
           `Press 'B' to list behaviors\n` +
           `Press 'E' to enable behavior\n` +
           `Press 'D' to disable behavior\n\n` +
           `Active behaviors: Unknown\n` +
           `Total behaviors: Unknown`;
  }

  private updateBehaviorControlsContent(): void {
    // This would be called when behavior information is updated
    // For now, we'll just update the display
    this.behaviorControls.setContent(this.getBehaviorControlsContent());
    this.screen.render();
  }

  private adjustActivity(activity: keyof ActivityDistribution, delta: number): void {
    // Adjust the activity value
    this.currentActivityDistribution[activity] += delta;

    // Ensure the value stays within bounds [0, 100]
    if (this.currentActivityDistribution[activity] < 0) {
      this.currentActivityDistribution[activity] = 0;
    } else if (this.currentActivityDistribution[activity] > 100) {
      this.currentActivityDistribution[activity] = 100;
    }

    // Normalize the distribution so it sums to 100%
    this.normalizeDistribution();

    // Update the display
    this.activityControls.setContent(this.getActivityControlsContent());

    // Emit an event to notify the agent of the change
    this.emitActivityDistributionChange();

    this.screen.render();
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

  private activityDistributionCallback?: (distribution: ActivityDistribution) => void;

  public setActivityDistributionCallback(callback: (distribution: ActivityDistribution) => void): void {
    this.activityDistributionCallback = callback;
  }

  public setBehaviorManagementCallback(callback: (action: string, params?: any) => void): void {
    this.behaviorManagementCallback = callback;
  }

  private emitActivityDistributionChange(): void {
    if (this.activityDistributionCallback) {
      this.activityDistributionCallback(this.currentActivityDistribution);
    }
  }

  public updateBotStatus(status: string): void {
    this.botStatus.setContent(status);
    this.screen.render();
  }

  public updateControlInfo(info: string): void {
    this.controlPanel.setContent(info);
    this.screen.render();
  }

  public addMessage(message: string): void {
    this.messages.push(`${new Date().toLocaleTimeString()} - ${message}`);
    
    // Keep only the last 100 messages
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }
    
    this.messageLog.setItems(this.messages);
    this.messageLog.select(this.messages.length - 1); // Auto-scroll to bottom
    this.screen.render();
  }

  public setMode(mode: ControlMode): void {
    const modeText = mode.toUpperCase();
    this.modeIndicator.setContent(modeText);
    
    // Change color based on mode
    if (mode === ControlMode.AUTOMATIC) {
      this.modeIndicator.style.bg = 'green';
    } else {
      this.modeIndicator.style.bg = 'red';
    }
    
    this.statusLine.setContent(`Switched to ${modeText} mode`);
    this.screen.render();
  }

  public setStatus(text: string): void {
    this.statusLine.setContent(text);
    this.screen.render();
  }

  public start(): void {
    this.isRunning = true;
    this.setStatus('Dashboard started');
  }

  public stop(): void {
    this.isRunning = false;
    this.setStatus('Dashboard stopped');
  }

  public isStarted(): boolean {
    return this.isRunning;
  }

  public render(): void {
    this.screen.render();
  }
}
