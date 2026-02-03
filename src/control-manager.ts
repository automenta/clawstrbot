import { EnhancedClawstrBot } from './enhanced-bot';
import inquirer from 'inquirer';

export enum ControlMode {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic'
}

export interface ControlOptions {
  mode: ControlMode;
  autoPromptInterval?: number; // in seconds
  maxIterations?: number;
}

export class ControlManager {
  private bot: EnhancedClawstrBot;
  private mode: ControlMode = ControlMode.MANUAL;
  private autoPromptInterval: number = 30; // default 30 seconds
  private maxIterations: number = 100; // default max iterations
  private iterationCount: number = 0;
  private isRunning: boolean = false;
  private autoPromptCallback?: () => Promise<string>;

  constructor(bot: EnhancedClawstrBot) {
    this.bot = bot;
  }

  public setMode(mode: ControlMode, options?: Partial<ControlOptions>): void {
    this.mode = mode;
    
    if (options) {
      if (options.autoPromptInterval !== undefined) {
        this.autoPromptInterval = options.autoPromptInterval;
      }
      if (options.maxIterations !== undefined) {
        this.maxIterations = options.maxIterations;
      }
    }
  }

  public getMode(): ControlMode {
    return this.mode;
  }

  public async processInput(input: string): Promise<string> {
    return await this.bot.processInput(input);
  }

  public async startAutomaticMode(promptCallback?: () => Promise<string>): Promise<void> {
    if (this.mode !== ControlMode.AUTOMATIC) {
      console.log('Cannot start automatic mode: current mode is not automatic');
      return;
    }

    this.isRunning = true;
    this.iterationCount = 0;
    this.autoPromptCallback = promptCallback;

    console.log('Starting automatic mode...');
    
    while (this.isRunning && this.iterationCount < this.maxIterations) {
      try {
        // Get the next prompt
        let prompt: string;
        if (this.autoPromptCallback) {
          prompt = await this.autoPromptCallback();
        } else {
          // Default automatic behavior - could be customized
          prompt = `Continue the current task or provide an update. Iteration: ${this.iterationCount + 1}`;
        }

        console.log(`Auto iteration ${this.iterationCount + 1}: Processing prompt: ${prompt.substring(0, 50)}...`);
        
        // Process the prompt
        const response = await this.bot.processInput(prompt);
        console.log(`Response: ${response.substring(0, 100)}...`);

        this.iterationCount++;
        
        // Wait for the specified interval
        await this.sleep(this.autoPromptInterval * 1000);
      } catch (error) {
        console.error('Error in automatic mode:', error);
        break;
      }
    }

    console.log('Automatic mode finished');
    this.isRunning = false;
  }

  public stopAutomaticMode(): void {
    this.isRunning = false;
    console.log('Automatic mode stopped');
  }

  public isAutomaticModeRunning(): boolean {
    return this.isRunning;
  }

  public async switchToManual(): Promise<string> {
    this.stopAutomaticMode();
    this.setMode(ControlMode.MANUAL);
    
    // Interactive manual mode
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'userInput',
        message: 'Enter your command:',
      }
    ]);
    
    return answer.userInput;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}