#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { EnhancedClawstrBot } from './enhanced-bot';
import { BotManager } from './bot-manager';
import { ConfigManager } from './config-manager';
import { ControlManager, ControlMode } from './control-manager';
import { TUIDashboard } from './tui-dashboard';
import { PersistenceManager, SessionData } from './persistence-manager';
import { AccountManager, AccountCredentials, Account } from './account-manager';
import { EventSystem } from './event-system';
import { ExampleAgentImplementation } from './example-agent-implementation';
import { ApprovalSystem } from './approval-system';
import { ApprovalPolicyManager } from './approval-policy-manager';
import { ApprovalEnabledBot } from './approval-enabled-bot';
import { ApprovalStatus, ActionType } from './approval-types';
import { LMReasoningAgent } from './lm-reasoning-agent';

// Print banner
console.log(
  chalk.blue(
    figlet.textSync('Clawstr Bot', { horizontalLayout: 'full' })
  )
);

// Setup CLI
program
  .version('1.0.0')
  .description('A bot framework for building autonomous agents')
  .option('-s, --session <sessionId>', 'Session ID to load', 'default-session')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-u, --username <username>', 'Username for account', 'default-user')
  .option('-e, --email <email>', 'Email for account', 'user@example.com')
  .option('-a, --agent-demo', 'Run agent demonstration', false)
  .option('--enable-approvals', 'Enable approval system', false)
  .parse();

const options = program.opts();

async function main() {
  console.log(chalk.green('Starting Clawstr Bot Framework...'));

  // Initialize configuration
  const configManager = ConfigManager.getInstance();
  let botConfig = configManager.getBotConfig();

  // Check if configuration is complete, if not, run interactive setup
  // For Ollama, apiKey is 'ollama' which is a valid placeholder
  if (!botConfig.apiKey || botConfig.apiKey === '') {
    console.log(chalk.yellow('LM provider not configured. Running interactive setup...'));

    const { LMProviderManager } = await import('./lm-provider-manager');
    const providerManager = new LMProviderManager();
    const providerConfig = await providerManager.configureInteractively();

    // Convert provider config to bot config
    botConfig = providerManager.toBotConfig(providerConfig);

    // Update config manager with new settings
    configManager.updateConfig({
      apiKey: botConfig.apiKey,
      baseUrl: botConfig.baseUrl,
      model: botConfig.model,
      temperature: botConfig.temperature
    });

    console.log(chalk.green('LM provider configured successfully!'));
  }

  // Initialize event system
  const eventSystem = new EventSystem();

  // Initialize persistence
  const persistenceManager = PersistenceManager.getInstance();
  await persistenceManager.init('./sessions');

  // Initialize account manager
  const accountManager = new AccountManager(persistenceManager);

  // Load existing accounts from persistence
  await accountManager.loadAccounts();

  // Create or authenticate user account
  let account = await accountManager.getAccountByUsername(options.username);
  if (!account) {
    console.log(chalk.yellow(`Creating new account for ${options.username}...`));
    try {
      account = await accountManager.createAccount({
        username: options.username,
        email: options.email,
        password: 'default-password' // In production, this should be properly handled
      } as AccountCredentials);
      console.log(chalk.green(`Account created for ${account.username}`));
    } catch (error) {
      console.error(chalk.red(`Failed to create account: ${error}`));
      process.exit(1);
    }
  } else {
    console.log(chalk.green(`Using existing account: ${account.username}`));
  }

  // Initialize approval system if enabled
  let approvalSystem: ApprovalSystem | undefined;
  let approvalEnabledBot: ApprovalEnabledBot | undefined;

  if (options.enableApprovals) {
    console.log(chalk.blue('Initializing approval system...'));

    const policyManager = new ApprovalPolicyManager();
    const approvalConfig = policyManager.createDefaultConfig();

    // Customize approval config for spam prevention
    approvalConfig.requireApprovalFor = [
      ActionType.POST,
      ActionType.DELETE,
      ActionType.EXECUTE_TOOL
    ]; // Require approval for posts, deletes, and tool execution

    approvalSystem = new ApprovalSystem(approvalConfig);
    approvalSystem.setEventSystem(eventSystem);

    // Subscribe to approval notifications
    approvalSystem.subscribeToNotifications((notification) => {
      console.log(chalk.yellow(`[APPROVAL] ${notification.message}`));
    });
  }

  // Create bot manager
  const botManager = new BotManager();

  // Check if session exists
  let sessionData: SessionData | null = null;
  try {
    sessionData = await persistenceManager.loadSession(options.session);
  } catch (error) {
    console.log(chalk.yellow(`No existing session found for ID: ${options.session}. Creating new session.`));
  }

  // Create or restore bot
  let bot: EnhancedClawstrBot;
  if (sessionData) {
    console.log(chalk.green(`Restoring bot from session: ${options.session}`));
    bot = new EnhancedClawstrBot(sessionData.config);

    // Restore history
    bot.setHistory(sessionData.history);
  } else {
    console.log(chalk.green(`Creating new bot session: ${options.session}`));
    bot = new EnhancedClawstrBot(botConfig);
  }

  // If approval system is enabled, wrap the bot
  if (approvalSystem) {
    approvalEnabledBot = new ApprovalEnabledBot({
      bot,
      approvalSystem
    });
  }

  // Subscribe to bot events
  bot.subscribeToEvent('response', (data: any) => {
    eventSystem.emit('bot_response', {
      sessionId: options.session,
      ...data
    }, 'bot');
  });

  bot.subscribeToEvent('error', (error: any) => {
    eventSystem.emit('bot_error', {
      sessionId: options.session,
      error
    }, 'bot');
  });

  // Create dashboard
  const dashboard = new TUIDashboard({
    title: 'Clawstr Bot Dashboard',
  });

  // Update dashboard with initial info
  dashboard.updateBotStatus(`Session: ${options.session}\nStatus: Running\nUser: ${account.username}`);
  dashboard.addMessage(`Bot initialized for user: ${account.username}`);
  dashboard.setMode(ControlMode.AUTOMATIC); // Using AUTOMATIC mode to represent autonomous operation

  // Register event handlers for dashboard updates
  eventSystem.subscribe('bot_response', (event) => {
    dashboard.addMessage(`Response: ${event.payload.response.substring(0, 100)}...`);
  });

  eventSystem.subscribe('bot_error', (event) => {
    dashboard.addMessage(`ERROR: ${event.payload.error.message}`);
  });

  eventSystem.subscribe('session_saved', (event) => {
    dashboard.addMessage(`Session saved: ${event.payload.sessionId}`);
  });

  // Subscribe to approval events if approval system is enabled
  if (approvalSystem) {
    eventSystem.subscribe('approval_notification', (event) => {
      dashboard.addMessage(`[APPROVAL] ${event.payload.message}`);
    });

    eventSystem.subscribe('approval_granted', (event) => {
      dashboard.addMessage(`[APPROVAL] Request ${event.payload.requestId} granted by ${event.payload.approvedBy}`);
    });

    eventSystem.subscribe('approval_rejected', (event) => {
      dashboard.addMessage(`[APPROVAL] Request ${event.payload.requestId} rejected by ${event.payload.rejectedBy}`);
    });
  }

  // Create and initialize the MCP Integration Agent as the core intelligence
  console.log(chalk.blue('Initializing MCP Integration Agent...'));

  const { MCPIntegrationAgent } = await import('./mcp-integration-agent');

  // Create the MCP Integration Agent with MCP-style tools
  const agent = new MCPIntegrationAgent(bot, eventSystem, account.id);

  // Connect approval system to behavioral controller if available
  if (approvalSystem) {
    agent.behavioralCtrl.setApprovalSystem(approvalSystem);
  }

  // Add agent events to dashboard
  eventSystem.subscribe('agent_action', (event) => {
    dashboard.addMessage(`[AGENT] Action: ${event.payload.actionName} - ${JSON.stringify(event.payload.result).substring(0, 100)}...`);
  });

  // Subscribe to activity events for dashboard updates
  eventSystem.subscribe('agent_activity_start', (event) => {
    dashboard.addMessage(`[ACTIVITY] Started: ${event.payload.activityType} (scheduled: ${event.payload.scheduledDurationMs}ms)`);
  });

  eventSystem.subscribe('agent_activity_complete', (event) => {
    dashboard.addMessage(`[ACTIVITY] Completed: ${event.payload.activityType} (actual: ${event.payload.durationMs}ms)`);
  });

  eventSystem.subscribe('agent_activity_progress', (event) => {
    // Optionally show progress updates
    // dashboard.addMessage(`[ACTIVITY] Progress: ${event.payload.activityType} (${(event.payload.progress * 100).toFixed(1)}%)`);
  });

  // Set up the activity distribution callback from the dashboard
  dashboard.setActivityDistributionCallback((distribution) => {
    console.log(chalk.yellow('Updating agent activity distribution from UI:'), distribution);
    agent.updateActivityDistribution(distribution);
  });

  // Set up the behavior management callback from the dashboard
  dashboard.setBehaviorManagementCallback((action, params) => {
    console.log(chalk.yellow('Behavior management action from UI:'), action, params);
    switch (action) {
      case 'list':
        const allBehaviors = agent.getBehaviors();
        const behaviorList = allBehaviors.map(b => `${b.getConfig().id} (${b.getConfig().type}) - ${b.isEnabled() ? 'enabled' : 'disabled'}`).join('\n');
        dashboard.addMessage(`[BEHAVIOR] Available behaviors:\n${behaviorList || 'No behaviors registered'}`);
        break;
      case 'enable':
        // For simplicity, we'll just list behaviors that can be enabled
        const disabledBehaviors = agent.getBehaviors().filter(b => !b.isEnabled());
        if (disabledBehaviors.length > 0) {
          // Enable the first disabled behavior as an example
          const behaviorToEnable = disabledBehaviors[0];
          agent.enableBehavior(behaviorToEnable.getConfig().id);
          dashboard.addMessage(`[BEHAVIOR] Enabled behavior: ${behaviorToEnable.getConfig().id}`);
        } else {
          dashboard.addMessage(`[BEHAVIOR] No disabled behaviors to enable`);
        }
        break;
      case 'disable':
        // For simplicity, we'll just list behaviors that can be disabled
        const enabledBehaviors = agent.getBehaviors().filter(b => b.isEnabled());
        if (enabledBehaviors.length > 0) {
          // Disable the first enabled behavior as an example
          const behaviorToDisable = enabledBehaviors[0];
          agent.disableBehavior(behaviorToDisable.getConfig().id);
          dashboard.addMessage(`[BEHAVIOR] Disabled behavior: ${behaviorToDisable.getConfig().id}`);
        } else {
          dashboard.addMessage(`[BEHAVIOR] No enabled behaviors to disable`);
        }
        break;
    }
  });

  // Set up the agent to run continuously
  console.log(chalk.blue('Starting agent-driven operations...'));
  dashboard.setStatus('Agent running - autonomous mode');

  // Start the agent's main loop
  const runAgentLoop = async () => {
    try {
      console.log(chalk.cyan('MCP Integration Agent starting activity cycle...'));
      dashboard.addMessage('[AGENT] Starting activity cycle...');

      // Run the agent's activity cycle
      await (agent as any).runActivityCycle();

      console.log(chalk.cyan('MCP Integration Agent activity cycle completed'));
      dashboard.addMessage('[AGENT] Activity cycle completed');
    } catch (error) {
      console.error(chalk.red('Agent error:'), error);
      dashboard.addMessage(`[AGENT ERROR] ${error}`);
    }
  };

  // Run the agent loop periodically
  setInterval(runAgentLoop, 60000); // Run every minute

  // Also run immediately
  setTimeout(runAgentLoop, 5000); // Start after 5 seconds to allow other systems to initialize

  // Create and initialize the example agent
  const agentDemo = new ExampleAgentImplementation(bot, eventSystem);

  // If agent demo option is enabled, run the demonstration
  if (options.agentDemo) {
    console.log(chalk.cyan('Running agent demonstration...'));
    await agentDemo.runCompleteDemonstration();
  }

  // If approval system is enabled, periodically check for pending requests
  if (approvalSystem) {
    setInterval(() => {
      const pendingRequests = approvalSystem!.getPendingRequests();
      if (pendingRequests.length > 0) {
        console.log(chalk.yellow(`[APPROVAL] ${pendingRequests.length} pending approval requests`));
      }
    }, 30000); // Check every 30 seconds
  }

  // Save session periodically (in a real app, you'd do this more frequently)
  setInterval(async () => {
    if (bot) {
      const currentSessionData: SessionData = {
        id: options.session,
        createdAt: sessionData?.createdAt || new Date(),
        updatedAt: new Date(),
        history: bot.getHistory(),
        config: bot.getConfig(),
        metadata: {
          lastUpdate: new Date(),
          userId: account.id,
          userName: account.username,
          approvalsEnabled: !!approvalSystem
        }
      };

      try {
        await persistenceManager.saveSession(options.session, currentSessionData);
        console.log(chalk.gray(`Session ${options.session} saved at ${new Date().toISOString()}`));
        eventSystem.emit('session_saved', { sessionId: options.session }, 'persistence');
      } catch (error) {
        console.error(chalk.red(`Failed to save session: ${error}`));
        eventSystem.emit('session_save_error', { sessionId: options.session, error }, 'persistence');
      }
    }
  }, 30000); // Save every 30 seconds

  // Handle exit
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down gracefully...'));

    // Save session before exiting
    if (bot) {
      const currentSessionData: SessionData = {
        id: options.session,
        createdAt: sessionData?.createdAt || new Date(),
        updatedAt: new Date(),
        history: bot.getHistory(),
        config: bot.getConfig(),
        metadata: {
          lastUpdate: new Date(),
          userId: account.id,
          userName: account.username,
          approvalsEnabled: !!approvalSystem,
          agentStatus: agent.getState().status
        }
      };

      try {
        await persistenceManager.saveSession(options.session, currentSessionData);
        console.log(chalk.green(`Session ${options.session} saved on exit`));
        eventSystem.emit('session_saved_on_exit', { sessionId: options.session }, 'persistence');
      } catch (error) {
        console.error(chalk.red(`Failed to save session on exit: ${error}`));
        eventSystem.emit('session_save_error_on_exit', { sessionId: options.session, error }, 'persistence');
      }
    }

    process.exit(0);
  });
}

// Run the application
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});