// dialogflowClient.js

const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const { GOOGLE_CLOUD_PROJECT, DIALOGFLOW_AGENT_ID } = require('./config');

const client = new SessionsClient();

async function detectIntentText(sessionId, text, languageCode = 'en') {
  const sessionPath = client.projectLocationAgentSessionPath(
    GOOGLE_CLOUD_PROJECT,
    'global', // Replace with your region if not 'global'
    DIALOGFLOW_AGENT_ID,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: text,
      },
      languageCode: languageCode,
    },
  };

  const [response] = await client.detectIntent(request);
  return response;
}

module.exports = {
  detectIntentText,
};