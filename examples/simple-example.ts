import { ClawstrBot, WebDashboard } from '../src';

async function runExample() {
  console.log('Starting Clawstr Bot Example...');

  // Initialize bot with configuration
  const bot = new ClawstrBot({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    model: 'gpt-3.5-turbo',
    temperature: 0.7
  });

  // Create a dashboard for visualization
  const dashboard = new WebDashboard({ title: 'Clawstr Bot Example Dashboard', port: 3001, host: '0.0.0.0' });
  dashboard.start();
  dashboard.addMessage('Bot initialized');

  // Example: Basic interaction
  console.log('\n--- Basic Interaction Example ---');
  dashboard.updateBotStatus('Running: Processing input');

  const response1 = await bot.processInput('Hello, what can you do?');
  console.log('Response:', response1);
  dashboard.addMessage(`User: Hello, what can you do?`);
  dashboard.addMessage(`Bot: ${response1}`);

  // Example: More interactions
  console.log('\n--- Additional Interactions ---');
  const response2 = await bot.processInput('What is your purpose?');
  console.log('Response:', response2);
  dashboard.addMessage(`User: What is your purpose?`);
  dashboard.addMessage(`Bot: ${response2}`);

  console.log('\n--- Example Completed ---');
  dashboard.addMessage('Example completed');
  dashboard.updateBotStatus('Example completed - press Q to quit');
}

// Run the example
runExample().catch(err => {
  console.error('Error running example:', err);
  process.exit(1);
});