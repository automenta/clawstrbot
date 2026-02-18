import storage from 'node-persist';
import { Message } from './types';

export interface SessionData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  history: Message[];
  config: any; // Store bot configuration
  metadata: Record<string, any>;
}

export class PersistenceManager {
  private static instance: PersistenceManager;
  private storage: storage.LocalStorage;
  private initialized: boolean = false;

  private constructor() {
    this.storage = storage.create();
  }

  public static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }

  async init(storagePath?: string): Promise<void> {
    const options = {
      dir: storagePath || './sessions',
      stringify: JSON.stringify,
      parse: JSON.parse,
      encoding: 'utf8' as BufferEncoding,
      logging: false,
      continuous: true,
      interval: false,
      expiredInterval: 2 * 60 * 1000, // 2 minutes
      retryDelay: 100,
      retryAttempts: 2,
      forceCreatedAt: true,
      autocreate: true,
    };

    await this.storage.init(options);
    this.initialized = true;
  }

  async saveSession(sessionId: string, sessionData: SessionData): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    // Convert dates to ISO strings for serialization
    const serializableData = {
      ...sessionData,
      createdAt: sessionData.createdAt.toISOString(),
      updatedAt: sessionData.updatedAt.toISOString(),
    };

    await this.storage.setItem(sessionId, serializableData);
  }

  async loadSession(sessionId: string): Promise<SessionData | null> {
    if (!this.initialized) {
      await this.init();
    }

    const data = await this.storage.getItem(sessionId);

    if (!data) {
      return null;
    }

    // Convert ISO strings back to Date objects
    const sessionData: SessionData = {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };

    // Also convert message timestamps back to Date objects
    if (sessionData.history) {
      sessionData.history = sessionData.history.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }

    return sessionData;
  }

  async listSessions(): Promise<string[]> {
    if (!this.initialized) {
      await this.init();
    }

    return await this.storage.keys();
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }

    try {
      await this.storage.removeItem(sessionId);
      return true;
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      return false;
    }
  }

  async clearAllSessions(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const keys = await this.storage.keys();
    for (const key of keys) {
      await this.storage.removeItem(key);
    }
  }

  async getSessionMetadata(sessionId: string): Promise<Record<string, any> | null> {
    const session = await this.loadSession(sessionId);
    return session ? session.metadata : null;
  }

  async updateSessionMetadata(sessionId: string, metadata: Record<string, any>): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (session) {
      session.metadata = { ...session.metadata, ...metadata };
      session.updatedAt = new Date();
      await this.saveSession(sessionId, session);
    }
  }
}
