export interface BotConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  baseUrl?: string;
  memorySize?: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface BotError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface LMTool {
  name: string;
  description: string;
  schema: any; // JSON Schema object
  handler: (params: any) => Promise<any>;
}
