const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const https = require('https');
const { WebClient } = require('@slack/web-api');
const { LOG_LEVEL } = require('./config');
const db = require('./firebaseClient');

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
    console.log(`Validating secret: ${secret}`);
    const value = process.env[secret] || (await getSecret(secret));
    if (!value) {
      console.error(`Missing or empty secret: ${secret}`);
      process.exit(1);
    }
    process.env[secret] = value; // Assign the value to the environment variable if fetched successfully
    console.log(`Secret ${secret} is set.`);
  }
}

// Function to test network access to Slack API
function testNetworkAccess() {
  return new Promise((resolve) => {
    console.log('Testing outbound network access to Slack API...');
    https
      .get('https://slack.com/api/api.test', (resp) => {
        let data = '';

        resp.on('data', (chunk) => {
          data += chunk;
        });

        resp.on('end', () => {
          console.log('Network access to Slack API succeeded. Response:', data);
          resolve(true);
        });
      })
      .on('error', (err) => {
        console.error('Network access to Slack API failed:', err.message);
        resolve(false);
      });
  });
}

// Function to test Slack API connectivity
async function testSlackApi() {
  try {
    console.log('Testing Slack API connectivity...');
    const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
    const response = await webClient.apiCall('api.test');
    console.log('Slack API Test Response:', response);
    return response.ok;
  } catch (error) {
    console.error('Slack API Test Error:', error);
    return false;
  }
}

// Retry logic for reconnecting socket
function retrySocketConnection(socketModeClient, retryCount = 0) {
  const MAX_RETRIES = 5;
  const RETRY_INTERVAL = 5000; // 5 seconds

  socketModeClient.on('disconnect', async (reason) => {
    console.error(`Socket disconnected. Reason: ${reason}`);
    if (retryCount < MAX_RETRIES) {
      console.warn(`Attempting to reconnect Socket Mode client, attempt #${retryCount + 1}`);
      retryCount++;

      setTimeout(async () => {
        try {
          console.log('Reconnecting Socket Mode client...');
          await socketModeClient.start(); // Use `.start()` instead of `.connect()`
          console.log('Socket Mode client reconnected successfully.');
        } catch (error) {
          console.error('Error reconnecting Socket Mode client:', error.message);
        }
      }, RETRY_INTERVAL);
    } else {
      console.error('Maximum retry attempts reached. Socket Mode client failed to reconnect.');
      process.exit(1);
    }
  });
}

// Function to handle the /briefops-status command
async function handleStatusCommand({ command, ack, respond }) {
  try {
    // Acknowledge the command
    await ack();

    console.log(`[INFO] Processing /briefops-status for user: ${command.user_name}`);

    // Fetch document ingestion stats from Firestore
    const documentsSnapshot = await db
      .collection('ingestedFiles') // Ensure the correct collection name
      .orderBy('createdAt') // Ensure documents are ordered by creation time
      .get();

    const documentCount = documentsSnapshot.size;
    let lastDocument = 'None';

    if (documentCount > 0) {
      const lastDocData = documentsSnapshot.docs[documentCount - 1].data();
      lastDocument = lastDocData.fileName || 'Unknown'; // Ensure correct field name
    }

    // Test Slack connectivity
    const slackApiStatus = await testSlackApi();
    const slackApiMessage = slackApiStatus ? 'OK' : 'Failed';

    // Test network access
    const networkAccessStatus = await testNetworkAccess();
    const networkAccessMessage = networkAccessStatus ? 'OK' : 'Failed';

    // Construct a status report
    const statusMessage = `
*BriefOps Status:*
- Number of documents ingested: ${documentCount}
- Last ingested document: ${lastDocument}
- Slack API: ${slackApiMessage}
- Network access: ${networkAccessMessage}
    `;

    // Respond with the status message in the Slack channel
    await respond({
      text: statusMessage,
      response_type: 'in_channel',
    });

    console.log('[INFO] Status report sent successfully.');
  } catch (error) {
    console.error(`[ERROR] Error in /briefops-status handler: ${error.message}`);
    await respond({
      text: `An error occurred while processing the status: ${error.message}`,
      response_type: 'ephemeral',
    });
  }
}

// Utility for handling critical errors
function handleFatalError(error) {
  console.error('Critical error occurred during initialization:', error.message);
  process.exit(1);
}

module.exports = {
  handleFatalError,
  validateSecrets,
  testNetworkAccess,
  testSlackApi,
  retrySocketConnection,
  handleStatusCommand,
};