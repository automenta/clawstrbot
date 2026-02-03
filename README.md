# Clawstr Bot Framework

A comprehensive bot framework for building autonomous agents with LangChain and OpenAI-compatible APIs.

## Features

- **LangChain Integration**: Built with LangChain for advanced AI interactions
- **OpenAI-Compatible API**: Works with OpenAI and compatible services (Azure, custom endpoints, etc.)
- **Dual Control Modes**: Manual and automatic operation modes
- **TUI Dashboard**: Terminal-based dashboard for monitoring autonomous operations
- **Persistent Sessions**: Disk-based persistence between sessions
- **Modular Architecture**: Clean separation of concerns with reusable components

## Installation

```bash
npm install clawstr-bot
```

Or clone the repository:

```bash
git clone https://github.com/your-repo/clawstr-bot.git
cd clawstr-bot
npm install
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional, for custom endpoints
MODEL_NAME=gpt-4  # Default: gpt-3.5-turbo
TEMPERATURE=0.7  # Default: 0.7
```

### Programmatic Configuration

```typescript
import { ConfigManager } from 'clawstr-bot';

const configManager = ConfigManager.getInstance();
configManager.updateConfig({
  apiKey: 'your-api-key',
  baseUrl: 'https://custom-endpoint.com/v1',
  model: 'gpt-4',
  temperature: 0.5
});
```

## Usage

### Basic Usage

```typescript
import { ClawstrBot } from 'clawstr-bot';

const bot = new ClawstrBot({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-3.5-turbo',
  temperature: 0.7
});

const response = await bot.processInput('Hello, how are you?');
console.log(response);
```

### Using the Bot Manager

```typescript
import { BotManager, BotConfig } from 'clawstr-bot';

const botManager = new BotManager();

const config: BotConfig = {
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  temperature: 0.5
};

const bot = botManager.createBot('my-bot', config);
botManager.setActiveBot('my-bot');

const response = await bot.processInput('What can you help me with?');
console.log(response);
```

### Control Modes

#### Manual Mode

```typescript
import { ControlManager, ControlMode } from 'clawstr-bot';

const controlManager = new ControlManager(bot);
controlManager.setMode(ControlMode.MANUAL);

// Process inputs manually
const response = await controlManager.processInput('What is the weather today?');
```

#### Automatic Mode

```typescript
const controlManager = new ControlManager(bot);
controlManager.setMode(ControlMode.AUTOMATIC, {
  autoPromptInterval: 60,  // seconds
  maxIterations: 50
});

// Define how to get the next prompt automatically
const getNextPrompt = async () => {
  // Your logic to determine the next action
  return 'Continue with the current task';
};

// Start automatic processing
await controlManager.startAutomaticMode(getNextPrompt);
```

### TUI Dashboard

```typescript
import { TUIDashboard, ControlMode } from 'clawstr-bot';

const dashboard = new TUIDashboard({
  title: 'My Bot Dashboard',
  width: 80,
  height: 24
});

dashboard.start();
dashboard.setMode(ControlMode.AUTOMATIC);
dashboard.addMessage('Bot started in automatic mode');
dashboard.updateBotStatus('Processing task #123');

// Keyboard shortcuts:
// M - Switch to Manual mode
// A - Switch to Automatic mode
// S - Stop automatic mode
// Q - Quit
```

### Persistence

```typescript
import { PersistenceManager, SessionData } from 'clawstr-bot';

const persistenceManager = PersistenceManager.getInstance();
await persistenceManager.init('./sessions');  // Directory for session files

// Save current session
const sessionData: SessionData = {
  id: 'session-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  history: bot.getHistory(),
  config: botConfig,
  metadata: { task: 'research', priority: 'high' }
};

await persistenceManager.saveSession('session-123', sessionData);

// Load previous session
const loadedSession = await persistenceManager.loadSession('session-123');
if (loadedSession) {
  bot.setHistory(loadedSession.history);
}
```

## Command Line Interface

Run the bot from the command line:

```bash
# Manual mode (default)
npm start -- --mode manual --session my-session

# Automatic mode
npm start -- --mode automatic --session my-session

# Specify a different session ID
npm start -- --session custom-session-id
```

## Examples

### Simple Chat Bot

```typescript
import { ClawstrBot } from 'clawstr-bot';

async function runChatBot() {
  const bot = new ClawstrBot({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-3.5-turbo',
    temperature: 0.7
  });

  // Simple conversation loop
  const responses = [
    await bot.processInput('Hello!'),
    await bot.processInput('What can you help me with?'),
    await bot.processInput('Can you summarize our conversation?')
  ];

  responses.forEach((response, i) => {
    console.log(`Response ${i + 1}: ${response}`);
  });
}

runChatBot().catch(console.error);
```

### Autonomous Research Agent

```typescript
import { 
  ClawstrBot, 
  ControlManager, 
  ControlMode, 
  TUIDashboard 
} from 'clawstr-bot';

async function runResearchAgent() {
  const bot = new ClawstrBot({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
    temperature: 0.3  // Lower temperature for more consistent results
  });

  // Set up dashboard
  const dashboard = new TUIDashboard({ title: 'Research Agent Dashboard' });
  dashboard.start();
  dashboard.setMode(ControlMode.AUTOMATIC);

  // Set up control manager
  const controlManager = new ControlManager(bot);
  controlManager.setMode(ControlMode.AUTOMATIC, {
    autoPromptInterval: 45,  // 45 seconds between prompts
    maxIterations: 100       // Max 100 iterations
  });

  // Define research task
  await bot.processInput('Research the latest developments in quantum computing.');

  // Define how to continue the research
  let iteration = 0;
  const getNextPrompt = async () => {
    iteration++;
    dashboard.addMessage(`Iteration ${iteration}: Continuing research...`);
    
    // Ask for continuation based on current state
    return `Based on our research so far, what should we investigate next? Provide a specific research direction.`;
  };

  // Start automatic research
  await controlManager.startAutomaticMode(getNextPrompt);
}

runResearchAgent().catch(console.error);
```

## Project Structure

```
clawstr-bot/
├── src/
│   ├── bot.ts              # Core bot implementation
│   ├── bot-manager.ts      # Multiple bot management
│   ├── config-manager.ts   # Configuration management
│   ├── control-manager.ts  # Manual/automatic control
│   ├── tui-dashboard.ts    # Terminal UI dashboard
│   ├── persistence-manager.ts # Session persistence
│   └── index.ts            # Main entry point
├── dist/                   # Compiled JavaScript
├── examples/               # Usage examples
├── config/                 # Configuration files
└── docs/                   # Documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the LICENSE file for details.