const { App } = require('@slack/bolt');
const db = require('./firebaseClient'); // Use the existing Firebase client
const { LOG_LEVEL } = require('./config');
const http = require('http');
const fetch = require('node-fetch');
const https = require('https');
const axios = require('axios');
const validations = require('./validations');
const summarization = require('./summarization');
const fsSummary = require('./fs-summary'); // Import the fs-summary.js module


// Set a global axios default timeout
axios.defaults.timeout = 15000; // 15 seconds

// Provide a global fetch and Headers implementation for environments like Cloud Run.
if (typeof global.fetch === 'undefined') {
  global.fetch = fetch;
}
if (typeof global.Headers === 'undefined') {
  global.Headers = fetch.Headers;
}

console.log("Starting BriefOps App...");

// Validate secrets before starting the app
validations.validateSecrets().then(() => {
  console.log('Secrets validated, initializing Slack App...');

  // Initialize the Slack app
  let app;
  try {
    app = new App({
      token: process.env.SLACK_BOT_TOKEN, // Bot User OAuth Access Token
      signingSecret: process.env.SLACK_SIGNING_SECRET, // Signing Secret
      socketMode: true, // Enable socket mode
      appToken: process.env.SLACK_APP_TOKEN, // App-Level Token
      logLevel: LOG_LEVEL,
    });
    console.log('Slack App initialized successfully.');
  } catch (error) {
    console.error('Error initializing Slack App:', error);
    console.error('Please ensure that all necessary environment variables are set correctly and valid.');
    console.error('Check SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and SLACK_APP_TOKEN in your environment.');
    process.exit(1); // Exit if the initialization fails
  }

  // Add a listener to handle socket readiness
  const socketModeClient = app.receiver.client;

  socketModeClient.on('authenticated', () => {
    console.log('Socket Mode client authenticated successfully.');
  });

  socketModeClient.on('open', () => {
    console.log('Socket Mode connection is open and ready.');
  });

  socketModeClient.on('connecting', () => {
    console.log('Socket Mode client is trying to connect...');
  });

  socketModeClient.on('reconnecting', () => {
    console.warn('Socket Mode client is reconnecting...');
  });

  socketModeClient.on('error', (error) => {
    console.error('Socket Mode connection error:', error);
    console.error('Check your network connectivity and ensure that the SLACK_APP_TOKEN is correct.');
  });

  validations.retrySocketConnection(socketModeClient); // Add retry logic for socket connection

  // Initialize modules
  console.log('Initializing modules...');
  try {
    summarization(app);
    fsSummary(app);  // Initialize the fs-summary module

    console.log('Modules loaded successfully.');
  } catch (error) {
    console.error('Error loading modules:', error);
    console.error('Please check if all required modules are properly configured and available.');
    process.exit(1); // Exit if modules fail to load
  }

  // Adjusted fetchChannelMessages to handle 'not_in_channel' error
async function fetchChannelMessages(channelId) {
  try {
    const result = await app.client.conversations.history({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
    });

    return result.messages;
  } catch (error) {
    console.error('Error fetching channel messages:', error);

    // Check for the specific 'not_in_channel' error
    if (error.data?.error === 'not_in_channel') {
      throw new Error(
        `It looks like the bot is not in the channel. Please invite the bot to the channel by typing: \`/invite @briefops\`.`
      );
    }

    // Handle other errors as a general fallback
    throw new Error('Failed to fetch messages due to an unexpected error.');
  }
}

// Slash command listener with enhanced error message
app.command('/briefops', async ({ command, ack, respond }) => {
  console.log(`Received /briefops command from user: ${command.user_name}, text: ${command.text}`);
  try {
    await ack(); // Acknowledge the command

    console.log('Fetching channel messages...');
    const messages = await fetchChannelMessages(command.channel_id); // Assuming you're using the channel_id from the command

    console.log('Messages fetched successfully.');
    await respond({ text: `Messages fetched successfully. Processing your request: ${command.text}` });

    // Proceed with summarization or other logic
    // ...

  } catch (error) {
    console.error('Error handling /briefops command:', error.message);

    // Respond to the user with the improved error message
    await respond({ text: error.message });
  }
});

app.command('/briefops-status', async ({ command, ack, respond }) => {
  await validations.handleStatusCommand({ command, ack, respond });
});

  // Start the app
  (async () => {
    const port = process.env.PORT || 8080;
    try {
      console.log(`Starting HTTP server on port ${port}...`);

      // Start a basic HTTP server to ensure the container is listening on the correct port
      const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('BriefOps is running');
        console.log(`Received request: ${req.method} ${req.url}`); // Log incoming requests for debugging
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Please choose a different port or stop the conflicting service.`);
          process.exit(1);
        } else {
          console.error('Server error:', err);
          process.exit(1);
        }
      });

      server.listen(port, () => {
        console.log(`HTTP server is listening on port ${port}`);
      });

      console.log('Starting Slack Bolt App...');
      await app.start(port);
      console.log(`⚡️ BriefOps app is running on port ${port}!`);
    } catch (error) {
      console.error(`Error starting the app on port ${port}:`, error);
      console.error('Please check if the port is available and that all necessary environment variables are set.');
      process.exit(1);
    }
  })();

  // Test network access
  validations.testNetworkAccess();
  validations.testSlackApi();
}).catch((error) => {
  console.error('Failed to validate secrets or initialize the app:', error);
  console.error('Please ensure all secrets are correctly configured in Google Secret Manager or environment variables.');
  process.exit(1);
});

// Additional Environment Variable Debugging
console.log('Environment Variables:');
console.log(`GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT || 'Not Set'}`);
console.log(`PORT: ${process.env.PORT || 8080}`);
console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'Not Set'}`);
console.log(`SLACK_SIGNING_SECRET: ${process.env.SLACK_SIGNING_SECRET ? 'Set' : 'Not Set'}`);
console.log(`SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN ? 'Set' : 'Not Set'}`);
console.log(`SLACK_APP_TOKEN: ${process.env.SLACK_APP_TOKEN ? 'Set' : 'Not Set'}`);
