const { App } = require('@slack/bolt');
const db = require('./firebaseClient'); // Use the existing Firebase client
const { LOG_LEVEL } = require('./config');
const http = require('http');
const fetch = require('node-fetch');
const https = require('https');
const axios = require('axios');
const validations = require('./validations');
const summarization = require('./summarization');

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
  });

  validations.retrySocketConnection(socketModeClient); // Add retry logic for socket connection

  // Initialize modules
  console.log('Initializing modules...');
  try {
    summarization(app);
    console.log('Modules loaded successfully.');
  } catch (error) {
    console.error('Error loading modules:', error);
    process.exit(1); // Exit if modules fail to load
  }

  // Add slash command listener for /briefops
  app.command('/briefops', async ({ command, ack, respond }) => {
    console.log(`Received /briefops command from user: ${command.user_name}, text: ${command.text}`);
    try {
      console.log('Acknowledging /briefops command...');
      await ack(); // Acknowledge the command promptly
      console.log('Acknowledged /briefops command successfully.');

      // Add a small delay to simulate processing time and ensure acknowledgement is separated
      setTimeout(async () => {
        try {
          console.log('Responding to /briefops command...');
          await respond({ text: `Processing your request: ${command.text}` });
          console.log('/briefops command processed and responded successfully.');
        } catch (responseError) {
          console.error('Error responding to /briefops command:', responseError);
          await respond({ text: 'An error occurred while processing your request.' });
        }
      }, 10); // Delay of 10 milliseconds to avoid blocking ack()

    } catch (error) {
      console.error('Error handling /briefops command:', error);
      await respond({ text: 'An error occurred while processing your request.' });
    }
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
          console.error(`Port ${port} is already in use.`);
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
      process.exit(1);
    }
  })();

  // Test network access
  validations.testNetworkAccess();
  validations.testSlackApi();
}).catch((error) => {
  console.error('Failed to validate secrets or initialize the app:', error);
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
