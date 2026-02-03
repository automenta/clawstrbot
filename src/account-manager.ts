import { PersistenceManager, SessionData } from './persistence-manager';

export interface Account {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  profile?: UserProfile;
  permissions: string[];
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  preferences?: Record<string, any>;
}

export interface AccountCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AccountLogin {
  username: string;
  password: string;
}

export interface AccountUpdate {
  username?: string;
  email?: string;
  password?: string;
  profile?: Partial<UserProfile>;
}

export interface PersistedAccountData {
  accounts: Account[];
  emailIndex: [string, string][]; // [email, accountId][]
  usernameIndex: [string, string][]; // [username, accountId][]
}

export class AccountManager {
  private accounts: Map<string, Account> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> accountId
  private usernameIndex: Map<string, string> = new Map(); // username -> accountId
  private persistenceManager: PersistenceManager;

  constructor(persistenceManager: PersistenceManager) {
    this.persistenceManager = persistenceManager;
    // Load existing accounts from persistence after initialization
    // The persistence manager should be initialized before this is called
  }

  async loadAccounts(): Promise<void> {
    try {
      const persistedData = await this.persistenceManager.loadSession('accounts');
      if (persistedData) {
        const data = persistedData as unknown as PersistedAccountData;
        
        // Clear current state
        this.accounts.clear();
        this.emailIndex.clear();
        this.usernameIndex.clear();
        
        // Restore accounts
        for (const account of data.accounts) {
          this.accounts.set(account.id, account);
        }
        
        // Restore indexes
        for (const [email, accountId] of data.emailIndex) {
          this.emailIndex.set(email, accountId);
        }
        
        for (const [username, accountId] of data.usernameIndex) {
          this.usernameIndex.set(username, accountId);
        }
      } else {
        // Initialize with a default admin account for development
        this.createAccount({
          username: 'admin',
          email: 'admin@example.com',
          password: 'password123'
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      // Initialize with a default admin account for development
      this.createAccount({
        username: 'admin',
        email: 'admin@example.com',
        password: 'password123'
      }).catch(console.error);
    }
  }

  private async saveAccounts(): Promise<void> {
    try {
      const data: PersistedAccountData = {
        accounts: Array.from(this.accounts.values()),
        emailIndex: Array.from(this.emailIndex.entries()),
        usernameIndex: Array.from(this.usernameIndex.entries())
      };

      // Create a proper SessionData object for the accounts
      const sessionData: SessionData = {
        id: 'accounts',
        createdAt: new Date(),
        updatedAt: new Date(),
        history: [],
        config: {},
        metadata: { type: 'accounts' },
        ...data
      };

      await this.persistenceManager.saveSession('accounts', sessionData);
    } catch (error) {
      console.error('Failed to save accounts:', error);
    }
  }

  async createAccount(credentials: AccountCredentials): Promise<Account> {
    // Validate credentials
    this.validateCredentials(credentials);
    
    // Check if username or email already exists
    if (this.emailIndex.has(credentials.email)) {
      throw new Error(`Account with email ${credentials.email} already exists`);
    }
    
    if (this.usernameIndex.has(credentials.username)) {
      throw new Error(`Account with username ${credentials.username} already exists`);
    }

    // Generate unique ID and API key
    const id = this.generateId();
    const apiKey = this.generateApiKey();
    
    // Hash password (in a real implementation, use bcrypt or similar)
    const passwordHash = this.hashPassword(credentials.password);
    
    const account: Account = {
      id,
      username: credentials.username,
      email: credentials.email,
      passwordHash,
      apiKey,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      profile: {
        firstName: '',
        lastName: '',
        avatar: '',
        bio: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        preferences: {}
      },
      permissions: ['basic']
    };

    // Store account
    this.accounts.set(id, account);
    this.emailIndex.set(account.email, id);
    this.usernameIndex.set(account.username, id);

    // Persist the changes
    await this.saveAccounts();

    return account;
  }

  async login(loginData: AccountLogin): Promise<Account | null> {
    // Find account by username
    const accountId = this.usernameIndex.get(loginData.username);
    if (!accountId) {
      return null;
    }

    const account = this.accounts.get(accountId);
    if (!account || !account.isActive) {
      return null;
    }

    // Verify password
    const passwordHash = this.hashPassword(loginData.password);
    if (account.passwordHash !== passwordHash) {
      return null;
    }

    // Update last login
    account.lastLoginAt = new Date();
    account.updatedAt = new Date();
    this.accounts.set(accountId, account);

    // Persist the changes
    await this.saveAccounts();

    return account;
  }

  async logout(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return false;
    }

    // In a real implementation, you might invalidate tokens here
    return true;
  }

  async getAccount(accountId: string): Promise<Account | null> {
    return this.accounts.get(accountId) || null;
  }

  async getAccountByUsername(username: string): Promise<Account | null> {
    const accountId = this.usernameIndex.get(username);
    if (!accountId) {
      return null;
    }
    return this.getAccount(accountId);
  }

  async getAccountByEmail(email: string): Promise<Account | null> {
    const accountId = this.emailIndex.get(email);
    if (!accountId) {
      return null;
    }
    return this.getAccount(accountId);
  }

  async updateAccount(accountId: string, updateData: AccountUpdate): Promise<Account | null> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return null;
    }

    // Update fields if provided
    if (updateData.username) {
      // Check if new username is taken
      if (this.usernameIndex.has(updateData.username) &&
          this.usernameIndex.get(updateData.username) !== accountId) {
        throw new Error(`Username ${updateData.username} is already taken`);
      }

      // Update username index
      this.usernameIndex.delete(account.username);
      this.usernameIndex.set(updateData.username, accountId);
      account.username = updateData.username;
    }

    if (updateData.email) {
      // Check if new email is taken
      if (this.emailIndex.has(updateData.email) &&
          this.emailIndex.get(updateData.email) !== accountId) {
        throw new Error(`Email ${updateData.email} is already taken`);
      }

      // Update email index
      this.emailIndex.delete(account.email);
      this.emailIndex.set(updateData.email, accountId);
      account.email = updateData.email;
    }

    if (updateData.password) {
      account.passwordHash = this.hashPassword(updateData.password);
    }

    if (updateData.profile) {
      account.profile = { ...account.profile, ...updateData.profile };
    }

    account.updatedAt = new Date();
    this.accounts.set(accountId, account);

    // Persist the changes
    await this.saveAccounts();

    return account;
  }

  async deactivateAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return false;
    }

    account.isActive = false;
    account.updatedAt = new Date();
    this.accounts.set(accountId, account);

    // Persist the changes
    await this.saveAccounts();

    return true;
  }

  async activateAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return false;
    }

    account.isActive = true;
    account.updatedAt = new Date();
    this.accounts.set(accountId, account);

    // Persist the changes
    await this.saveAccounts();

    return true;
  }

  async deleteAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return false;
    }

    // Remove from indexes
    this.emailIndex.delete(account.email);
    this.usernameIndex.delete(account.username);
    
    // Remove account
    this.accounts.delete(accountId);

    // Persist the changes
    await this.saveAccounts();

    return true;
  }

  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return false;
    }

    // Verify current password
    const currentPasswordHash = this.hashPassword(currentPassword);
    if (account.passwordHash !== currentPasswordHash) {
      return false;
    }

    // Update password
    account.passwordHash = this.hashPassword(newPassword);
    account.updatedAt = new Date();
    this.accounts.set(accountId, account);

    // Persist the changes
    await this.saveAccounts();

    return true;
  }

  private validateCredentials(credentials: AccountCredentials): void {
    if (!credentials.username || credentials.username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    if (!credentials.email || !this.isValidEmail(credentials.email)) {
      throw new Error('Valid email is required');
    }

    if (!credentials.password || credentials.password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private hashPassword(password: string): string {
    // In a real implementation, use bcrypt or similar
    // For now, we'll use a simple approach for demonstration
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateApiKey(): string {
    return 'sk-' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 20);
  }

  listAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }
}