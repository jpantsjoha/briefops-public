// main.js
const registerGoogleSearch = require('./googleSearch');
const { App } = require('@slack/bolt');
const db = require('./firebaseClient'); // Use the existing Firebase client
const { LOG_LEVEL } = require('./config');
const fetch = require('node-fetch');
const axios = require('axios');
const validations = require('./validations');
const summarization = require('./summarization');
const fsSummary = require('./fs-summary'); // Import the fs-summary.js module
const appOnboarding = require('./onboarding');


const {
  fetchThreadMessages,
  analyzeMessagesForContent,
  summarizeDocumentFromFile,
  summarizeUrlContent,
} = require('./utils');

// Set a global axios default timeout
axios.defaults.timeout = 15000; // 15 seconds

// Provide a global fetch and Headers implementation for environments like Cloud Run.
if (typeof global.fetch === 'undefined') {
  global.fetch = fetch;
}
if (typeof global.Headers === 'undefined') {
  global.Headers = fetch.Headers;
}

console.log('Starting BriefOps App...');

// Function to initialize the app
async function initializeApp() {
  try {
    // Validate secrets before starting the app
    await validations.validateSecrets();
    console.log('Secrets validated, initializing Slack App...');



    // Initialize the Slack app
    const app = new App({
      token: process.env.SLACK_BOT_TOKEN, // Bot User OAuth Access Token
      signingSecret: process.env.SLACK_SIGNING_SECRET, // Signing Secret
      socketMode: true, // Enable socket mode
      appToken: process.env.SLACK_APP_TOKEN, // App-Level Token
      logLevel: LOG_LEVEL,
    });
    console.log('Slack App initialized successfully.');

    // Register the command handler
    registerGoogleSearch(app);
    
    // After initializing the app
    const socketModeClient = app.receiver.client;

    socketModeClient.on('disconnect', (event) => {
      console.warn('Socket Mode client disconnected:', event);
      // Optionally attempt to reconnect or clean up resources
    });

    socketModeClient.on('error', (error) => {
      console.error('Socket Mode client error:', error);
      // Handle the error accordingly
    });

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

    // Add retry logic for socket connection
    validations.retrySocketConnection(socketModeClient);

    // Initialize modules
    console.log('Initializing modules...');
    try {
      summarization(app);
      fsSummary(app); // Initialize the fs-summary module
      appOnboarding(app); // Initialize onboarding functionality

      console.log('Modules loaded successfully.');
    } catch (error) {
      console.error('Error loading modules:', error);
      console.error(
        'Please check if all required modules are properly configured and available.'
      );
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

    // Command handlers
    app.command('/briefops-status', async ({ command, ack, respond }) => {
      await validations.handleStatusCommand({ command, ack, respond });
    });

    // Start the app
    const port = process.env.PORT || 8080;
    try {
      console.log('Starting Slack Bolt App...');
      await app.start(port);
      console.log(`⚡️ BriefOps app is running on port ${port}!`);
    } catch (error) {
      console.error(`Error starting the app on port ${port}:`, error);
      console.error(
        'Please check if the port is available and that all necessary environment variables are set.'
      );
      process.exit(1);
    }

    // Test network access
    validations.testNetworkAccess();
    validations.testSlackApi();

    // Return the app instance for testing purposes
    return app;
  } catch (error) {
    console.error('Failed to validate secrets or initialize the app:', error);
    console.error(
      'Please ensure all secrets are correctly configured in Google Secret Manager or environment variables.'
    );
    process.exit(1);
  }
}

// If the script is run directly, initialize the app
if (require.main === module) {
  initializeApp();
}

// Export the initializeApp function for testing
module.exports = { initializeApp };

// Additional Environment Variable Debugging
console.log('Environment Variables:');
console.log(
  `GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT || 'Not Set'}`
);
console.log(`PORT: ${process.env.PORT || 8080}`);
console.log(
  `GOOGLE_APPLICATION_CREDENTIALS: ${
    process.env.GOOGLE_APPLICATION_CREDENTIALS || 'Not Set'
  }`
);
console.log(
  `SLACK_SIGNING_SECRET: ${
    process.env.SLACK_SIGNING_SECRET ? 'Set' : 'Not Set'
  }`
);
console.log(
  `SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN ? 'Set' : 'Not Set'}`
);
console.log(
  `SLACK_APP_TOKEN: ${process.env.SLACK_APP_TOKEN ? 'Set' : 'Not Set'}`
);