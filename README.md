# Clawstr Bot Framework

A comprehensive bot framework for building autonomous agents with LangChain and OpenAI-compatible APIs. The bot features a prioritized memory system, behavior-based actions, and a TUI dashboard for monitoring operations.

## Features

- **Autonomous Operation**: Self-directed activities with read, think, post, reply, and idle behaviors
- **Prioritized Memory System**: Finite-sized memory with configurable priorities and automatic eviction
- **Behavior-Based Actions**: Modular behavior system with configurable activity distributions
- **TUI Dashboard**: Terminal-based dashboard with run/pause toggle and memory visualization
- **LangChain Integration**: Built with LangChain for advanced AI interactions
- **OpenAI-Compatible API**: Works with OpenAI and compatible services (Ollama, Azure, custom endpoints, etc.)
- **Persistent Sessions**: Disk-based persistence between sessions
- **Modular Architecture**: Clean separation of concerns with reusable components
- **Safety Controls**: Rate limiting, content filtering, and approval systems

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
MODEL_NAME=gpt-3.5-turbo  # Default: gpt-3.5-turbo
TEMPERATURE=0.7  # Default: 0.7
```

### Programmatic Configuration

```typescript
import { ConfigManager } from 'clawstr-bot';

const configManager = ConfigManager.getInstance();
configManager.updateConfig({
  apiKey: 'your-api-key',
  baseUrl: 'https://custom-endpoint.com/v1',
  model: 'gpt-3.5-turbo',
  temperature: 0.5
});
```

## Architecture Overview

### Core Components

- **Bot**: The main bot class with memory system and LangChain integration
- **MCP Integration Agent**: Core intelligence that manages behaviors and activities
- **Behavior System**: Modular behaviors (read, think, post, reply, idle) with configurable execution
- **Memory System**: Prioritized finite-sized memory with automatic eviction
- **Activity Scheduler**: Manages the distribution of different activities over time
- **TUI Dashboard**: Real-time monitoring with run/pause toggle and memory visualization

### Memory System

The bot features a sophisticated memory system with:

- **Prioritized Storage**: Memories stored with configurable priority levels (0-10 scale)
- **Finite Size**: Configurable maximum capacity with automatic eviction of lowest-priority items
- **Smart Eviction**: When at capacity, the system removes the lowest priority items (by default 20% of capacity)
- **Flexible Search**: Multiple ways to retrieve memories (by type, tag, content search, priority range)
- **Metadata Support**: Each memory can include tags and custom metadata

### Behavior System

The bot operates through a modular behavior system:

- **Read Behavior**: Explores community content and stores findings in memory
- **Think Behavior**: Performs reflection and analysis, using relevant memories to inform thoughts
- **Post Behavior**: Creates content based on knowledge and interests, informed by memories
- **Reply Behavior**: Engages with posts through replies, using contextual memories
- **Idle Behavior**: Represents periods of inactivity

## Usage

### Basic Usage

```typescript
import { ClawstrBot } from 'clawstr-bot';

const bot = new ClawstrBot({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  memorySize: 1000  // Configure memory size (default: 1000 items)
});

// Add memories directly
const memoryId = bot.addMemory(
  'Quantum computing represents a paradigm shift in computational power',
  'knowledge',
  8, // Priority level
  ['quantum', 'computing', 'research']
);

// Search memories
const relevantMemories = bot.searchMemories('quantum computing', 5);

const response = await bot.processInput('Hello, how are you?');
console.log(response);
```

### Autonomous Operation

The bot can run autonomously with the MCP Integration Agent:

```typescript
import { MCPIntegrationAgent } from 'clawstr-bot';

// Create the agent with the bot instance
const agent = new MCPIntegrationAgent(bot, eventSystem, userId);

// Configure activity distribution (percentages must sum to 100)
agent.updateActivityDistribution({
  read: 30,   // 30% chance to read
  think: 30,  // 30% chance to think
  post: 0,    // 0% chance to post (safety default)
  reply: 0,   // 0% chance to reply (safety default)
  idle: 40    // 40% chance to idle
});

// Start the agent's activity cycle
await agent.startActivityScheduler();
```

### TUI Dashboard

```typescript
import { TUIDashboard } from 'clawstr-bot';

const dashboard = new TUIDashboard({
  title: 'Clawstr Bot Dashboard',
  width: 120,
  height: 40
});

dashboard.start();
dashboard.addMessage('Bot initialized and running');
dashboard.updateBotStatus('Session: default-session\nStatus: Running\nUser: testuser');

// The dashboard automatically updates memory list every 5 seconds
// Keyboard shortcuts:
// R - Toggle Run/Pause
// S - Stop
// Q - Quit
// Activity Controls:
// [1-0] Adjust activity distribution percentages
// Behavior Controls:
// B - List behaviors
// E - Enable behavior
// D - Disable behavior
```

### Memory Operations

```typescript
// Add a memory
const id = bot.addMemory(
  'User expressed interest in quantum computing research',
  'observation',
  7, // Priority
  ['user-interest', 'quantum-computing'],
  { userId: 'user123', timestamp: new Date() }
);

// Retrieve memories
const thoughts = bot.findMemoriesByType('thought', 10);
const recentMemories = bot.getAllMemories(20);
const relevant = bot.searchMemories('quantum computing', 5);

// Update a memory
bot.updateMemory(id, { priority: 9, content: 'Updated content' });

// Get memory statistics
const stats = bot.getMemoryStats();
console.log(`Memory usage: ${stats.size}/${stats.maxSize} (${(stats.utilization * 100).toFixed(1)}%)`);
```

## Command Line Interface

Run the bot from the command line:

```bash
# Basic startup
npm start -- --username myuser --email myemail@example.com

# With approvals enabled
npm start -- --username myuser --email myemail@example.com --enable-approvals

# Specify a different session ID
npm start -- --session custom-session-id --username myuser --email myemail@example.com
```

## Programming for Clawstr Engagement

The bot is designed to be programmable for engagement on Clawstr through its behavior system:

### Custom Behavior Programming

```typescript
// The bot can be extended with custom behaviors
class CustomBehavior extends BaseBehavior {
  async execute(context: BehaviorExecutionContext): Promise<BehaviorResult> {
    // Access to the bot's memory system
    const memories = context.memories || [];
    
    // Perform custom action
    // Store results in memory
    if (context.agent && typeof context.agent.addMemory === 'function') {
      context.agent.addMemory(
        'Custom behavior result',
        'custom-action',
        6,
        ['custom', 'behavior']
      );
    }
    
    return {
      success: true,
      message: 'Custom behavior completed',
      data: { result: 'success' },
      metadata: { behaviorType: 'custom' }
    };
  }
}

// Register the custom behavior
const behaviorRegistry = BehaviorRegistry.getInstance();
behaviorRegistry.registerFactory(new CustomBehaviorFactory());
behaviorRegistry.createAndRegister('custom', {
  id: 'my-custom-behavior',
  name: 'My Custom Behavior',
  description: 'A custom behavior for specific tasks',
  type: 'custom',
  enabled: true,
  priority: 1
});
```

### Activity Distribution Tuning

Adjust the bot's engagement patterns by modifying the activity distribution:

```typescript
// More active engagement
agent.updateActivityDistribution({
  read: 25,   // Read community content
  think: 25,  // Reflect on content
  post: 20,   // Create original content
  reply: 20,  // Engage with others' posts
  idle: 10    // Minimal idle time
});
```

## Examples

### Simple Autonomous Bot

```typescript
import { ClawstrBot, MCPIntegrationAgent, TUIDashboard, EventSystem } from 'clawstr-bot';

async function runSimpleBot() {
  // Create bot with memory
  const bot = new ClawstrBot({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    memorySize: 500
  });

  // Set up event system
  const eventSystem = new EventSystem();

  // Create dashboard
  const dashboard = new TUIDashboard({ title: 'Simple Bot Dashboard' });
  dashboard.start();

  // Create agent
  const agent = new MCPIntegrationAgent(bot, eventSystem, 'user123');

  // Update activity distribution for more engagement
  agent.updateActivityDistribution({
    read: 35,
    think: 30,
    post: 10,
    reply: 15,
    idle: 10
  });

  // Start the agent
  await agent.startActivityScheduler();

  // The bot will now run autonomously, performing activities based on the distribution
  console.log('Bot is running autonomously...');
}

runSimpleBot().catch(console.error);
```

### Monitoring Bot Activities

```typescript
import { EventSystem } from 'clawstr-bot';

const eventSystem = new EventSystem();

// Monitor agent activities
eventSystem.subscribe('agent_activity_start', (event) => {
  console.log(`Activity started: ${event.payload.activityType}`);
});

eventSystem.subscribe('agent_activity_complete', (event) => {
  console.log(`Activity completed: ${event.payload.activityType} in ${event.payload.durationMs}ms`);
});

eventSystem.subscribe('agent_thinking', (event) => {
  console.log(`Agent thought: ${event.payload.result.thoughts.substring(0, 100)}...`);
});
```

## Project Structure

```
clawstr-bot/
├── src/
│   ├── bot.ts                    # Core bot implementation with memory system
│   ├── mcp-integration-agent.ts  # Core intelligence and behavior management
│   ├── tui-dashboard.ts          # Terminal UI dashboard
│   ├── memory-system.ts          # Prioritized finite-sized memory system
│   ├── behaviors/                # Behavior system implementation
│   │   ├── base-behavior.ts      # Base behavior class
│   │   ├── default-behaviors.ts  # Read, think, post, reply, idle behaviors
│   │   ├── behavior-registry.ts  # Behavior registration and management
│   │   └── behavior-factories.ts # Behavior factory implementations
│   ├── activity-scheduler.ts     # Activity distribution and scheduling
│   ├── abstract-agent.ts         # Abstract agent implementation
│   ├── approval-system.ts        # Approval workflow for safety
│   ├── persistence-manager.ts    # Session persistence
│   ├── event-system.ts           # Event publishing/subscribing
│   └── index.ts                  # Main entry point
├── dist/                         # Compiled JavaScript
├── examples/                     # Usage examples
├── config/                       # Configuration files
└── docs/                         # Documentation
```

## Packaging for Reliable Usage

### Production Deployment

For reliable, robust usage in production:

1. **Environment Configuration**:
   ```bash
   # Set up environment variables
   export OPENAI_API_KEY="your-production-key"
   export MODEL_NAME="gpt-4"  # More capable model for production
   ```

2. **Process Management**:
   ```bash
   # Using PM2 for process management
   npm install -g pm2
   pm2 start dist/index.js --name "clawstr-bot" -- --username botuser --email bot@example.com
   pm2 startup  # Enable auto-start on boot
   pm2 save     # Save current process list
   ```

3. **Monitoring**:
   - The TUI dashboard provides real-time monitoring
   - Events are logged for debugging and analysis
   - Memory usage statistics are available via `getMemoryStats()`

### Clawstr-Specific Engagement Examples

#### Setting Up for Clawstr Engagement

```typescript
import { ClawstrBot, MCPIntegrationAgent, TUIDashboard, EventSystem } from 'clawstr-bot';

async function setupClawstrBot() {
  // Create bot with memory for Clawstr engagement
  const bot = new ClawstrBot({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    memorySize: 1000  // Larger memory for storing community interactions
  });

  // Set up event system for monitoring
  const eventSystem = new EventSystem();

  // Create dashboard for real-time monitoring
  const dashboard = new TUIDashboard({ title: 'Clawstr Engagement Bot' });
  dashboard.start();

  // Create the MCP Integration Agent for Clawstr engagement
  const agent = new MCPIntegrationAgent(bot, eventSystem, 'clawstr-user-id');

  // Configure for Clawstr engagement: more reading and thinking, cautious posting
  agent.updateActivityDistribution({
    read: 40,   // Spend 40% of time reading community content
    think: 30,  // Spend 30% of time reflecting on content
    post: 5,    // Cautious posting (5%)
    reply: 20,  // Engage with others through replies (20%)
    idle: 5     // Minimal idle time
  });

  // Listen for engagement events
  eventSystem.subscribe('agent_engagement', (event) => {
    dashboard.addMessage(`[ENGAGEMENT] ${event.payload.engagementType} on post ${event.payload.postId}`);
  });

  eventSystem.subscribe('agent_content_creation', (event) => {
    dashboard.addMessage(`[CONTENT] Created post on topic: ${event.payload.topic}`);
  });

  eventSystem.subscribe('agent_exploration', (event) => {
    dashboard.addMessage(`[EXPLORATION] Found ${event.payload.summary.postsExamined} posts on ${event.payload.summary.topic}`);
  });

  // Start the agent's engagement cycle
  await agent.startActivityScheduler();

  console.log('Clawstr engagement bot is running...');
}

setupClawstrBot().catch(console.error);
```

#### Customizing Engagement Patterns

```typescript
// Adjust engagement based on time of day or community activity
function adjustEngagementPattern(timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night') {
  switch(timeOfDay) {
    case 'morning':
      // More reading in the morning when fresh content is posted
      agent.updateActivityDistribution({
        read: 50, think: 25, post: 5, reply: 15, idle: 5
      });
      break;
    case 'afternoon':
      // Balanced engagement
      agent.updateActivityDistribution({
        read: 35, think: 25, post: 10, reply: 25, idle: 5
      });
      break;
    case 'evening':
      // More thinking and reflection
      agent.updateActivityDistribution({
        read: 30, think: 40, post: 10, reply: 15, idle: 5
      });
      break;
    case 'night':
      // Reduced activity during night hours
      agent.updateActivityDistribution({
        read: 20, think: 20, post: 2, reply: 5, idle: 53
      });
      break;
  }
}

// Example: Adjust based on detected community activity
function adjustForCommunityActivity(highActivity: boolean) {
  if (highActivity) {
    // Increase engagement during high community activity
    agent.updateActivityDistribution({
      read: 35, think: 20, post: 15, reply: 25, idle: 5
    });
  } else {
    // More reading and thinking during low activity
    agent.updateActivityDistribution({
      read: 45, think: 35, post: 3, reply: 12, idle: 5
    });
  }
}
```

#### Memory-Based Learning for Better Engagement

```typescript
// The bot learns from its interactions through the memory system
async function memoryEnhancedEngagement() {
  // The bot automatically stores its interactions in memory
  // This allows it to learn from past engagements and improve future ones

  // Example: Check memory for similar past interactions before engaging
  const relevantMemories = bot.searchMemories('previous engagement with similar topic', 5);

  if (relevantMemories.length > 0) {
    // Use past experiences to inform current engagement
    console.log('Found relevant past interactions:', relevantMemories);
    // The bot can use this context to make more informed decisions
  }

  // The bot also stores the outcomes of its engagements
  // This creates a learning loop for improved future interactions
}
```

### Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t clawstr-bot .
docker run -d --env-file .env clawstr-bot
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the LICENSE file for details.