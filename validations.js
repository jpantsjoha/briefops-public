const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const https = require('https');
const { WebClient } = require('@slack/web-api');
const { LOG_LEVEL } = require('./config');

// Function to fetch secret values from Secret Manager
async function getSecret(secretName) {
  console.log(`Attempting to fetch secret: ${secretName}`);
  const client = new SecretManagerServiceClient();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    console.log(`Successfully fetched secret: ${secretName}`);
    return payload;
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error);
    return null;
  }
}

// Function to validate the secrets
async function validateSecrets() {
  console.log('Validating secrets...');
  const secrets = [
    'SLACK_SIGNING_SECRET',
    'SLACK_BOT_TOKEN',
    'SLACK_APP_TOKEN',
  ];

  for (const secret of secrets) {
    console.log(`Validating secret: ${secret}`); // Debugging step to indicate the start of validation
    const value = process.env[secret] || (await getSecret(secret.toLowerCase()));
    if (!value) {
      console.error(`Missing or empty secret: ${secret}`);
      process.exit(1);
    }
    process.env[secret] = value; // Assign the value to the environment variable if fetched successfully
    console.log(`Secret ${secret} is set.`); // Debugging to confirm the secret is set
  }
}

// Function to test network access to Slack API
async function testNetworkAccess() {
  console.log('Testing outbound network access to Slack API...');
  https.get('https://slack.com/api/api.test', (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received.
    resp.on('end', () => {
      console.log('Network access to Slack API succeeded. Response:', data);
    });

  }).on("error", (err) => {
    console.error("Network access to Slack API failed: " + err.message);
  });
}

// Function to test Slack API connectivity
async function testSlackApi() {
  try {
    console.log('Testing Slack API connectivity...');
    const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    const response = await webClient.apiCall('api.test');
    console.log('Slack API Test Response:', response);
  } catch (error) {
    console.error('Slack API Test Error:', error);
  }
}

// Retry logic for reconnecting socket
function retrySocketConnection(socketModeClient, retryCount = 0) {
  const MAX_RETRIES = 5;
  const RETRY_INTERVAL = 5000; // 5 seconds

  socketModeClient.on('close', (code, reason) => {
    console.error(`Socket closed with code ${code}, reason: ${reason}`);
    if (retryCount < MAX_RETRIES) {
      console.warn(`Attempting to reconnect Socket Mode client, attempt #${retryCount + 1}`);
      setTimeout(() => {
        retryCount++;
        socketModeClient.connect();
      }, RETRY_INTERVAL);
    } else {
      console.error('Maximum retry attempts reached. Socket Mode client failed to reconnect.');
      process.exit(1);
    }
  });
}

module.exports = {
  validateSecrets,
  testNetworkAccess,
  testSlackApi,
  retrySocketConnection,
};
