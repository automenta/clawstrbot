import { ClawstrBot, ControlManager, ControlMode, TUIDashboard } from './src';

async function runExample() {
  console.log('Starting Clawstr Bot Example...');

  // Initialize bot with configuration
  const bot = new ClawstrBot({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    model: 'gpt-3.5-turbo',
    temperature: 0.7
  });

  // Create a dashboard for visualization
  const dashboard = new TUIDashboard({ title: 'Clawstr Bot Example Dashboard' });
  dashboard.start();
  dashboard.addMessage('Bot initialized');

  // Example: Manual mode interaction
  console.log('\n--- Manual Mode Example ---');
  dashboard.setMode(ControlMode.MANUAL);
  dashboard.updateBotStatus('Manual Mode: Waiting for input');
  
  const response1 = await bot.processInput('Hello, what can you do?');
  console.log('Response:', response1);
  dashboard.addMessage(`User: Hello, what can you do?`);
  dashboard.addMessage(`Bot: ${response1}`);

  // Example: Switch to automatic mode
  console.log('\n--- Switching to Automatic Mode ---');
  dashboard.setMode(ControlMode.AUTOMATIC);
  dashboard.updateBotStatus('Automatic Mode: Running');
  
  // Simulate automatic mode with a simple callback
  const controlManager = new ControlManager(bot);
  controlManager.setMode(ControlMode.AUTOMATIC, {
    autoPromptInterval: 5, // 5 seconds for demo purposes
    maxIterations: 3       // Just 3 iterations for demo
  });

  let iteration = 0;
  const getNextPrompt = async () => {
    iteration++;
    const prompt = `This is automatic iteration ${iteration}. Provide a brief summary of what we've discussed so far.`;
    console.log(`Auto iteration ${iteration}: ${prompt}`);
    dashboard.addMessage(`Auto ${iteration}: ${prompt}`);
    return prompt;
  };

  console.log('\n--- Starting Automatic Mode (3 iterations) ---');
  await controlManager.startAutomaticMode(getNextPrompt);

  console.log('\n--- Example Completed ---');
  dashboard.addMessage('Example completed');
  dashboard.updateBotStatus('Example completed - press Q to quit');
}

// Run the example
runExample().catch(err => {
  console.error('Error running example:', err);
  process.exit(1);
});