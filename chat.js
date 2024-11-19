// chat.js

const { VertexAI } = require('@google-cloud/vertexai');
const { ChatModel } = require('@google-cloud/vertexai').largeLanguageModels;
const {
  VERTEX_AI_LOCATION,
  SUMMARIZATION_TEMPERATURE,
  SUMMARIZATION_MAX_OUTPUT_TOKENS,
  SUMMARIZATION_TOP_P,
  SUMMARIZATION_TOP_K,
} = require('./config');

// Global debug flag
const DEBUG = true; // Set to false to disable debug messages

// Function to log debug messages
function debugLog(message, ...args) {
  if (DEBUG) {
    console.log('[DEBUG chat.js]', message, ...args);
  }
}

module.exports = function (app) {
  // Function to generate chat response using Vertex AI
  async function generateChatResponse(prompt) {
    debugLog('Initializing Vertex AI for chat response');

    // Set up Vertex AI client with service account authentication
    const vertexAI = new VertexAI({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: VERTEX_AI_LOCATION,
    });

    // Configure the ChatModel
    const model = new ChatModel({
      vertexAI,
      model: 'chat-bison@latest',
      // Optionally, you can specify parameters here
      // temperature: SUMMARIZATION_TEMPERATURE,
      // maxOutputTokens: SUMMARIZATION_MAX_OUTPUT_TOKENS,
      // topP: SUMMARIZATION_TOP_P,
      // topK: SUMMARIZATION_TOP_K,
    });

    // Start the chat session
    const chatSession = model.startChat({
      context: 'You are BriefOps, a Slack assistant.',
      examples: [],
    });

    try {
      debugLog('Sending prompt to Vertex AI:', prompt);
      const response = await chatSession.sendMessage(prompt);

      const responseText = response.text;
      debugLog('Received response from Vertex AI:', responseText);

      return responseText;
    } catch (error) {
      console.error('Error during chat response generation:', error);
      throw new Error('An error occurred while generating the response.');
    }
  }

  // Function to fetch and concatenate all messages from the thread
  async function fetchThreadContext(app, channelId, threadTs) {
    try {
      debugLog(
        'Fetching thread context for channel:',
        channelId,
        'thread_ts:',
        threadTs
      );
      let messages = [];
      let hasMore = true;
      let cursor;

      while (hasMore) {
        const result = await app.client.conversations.replies({
          token: process.env.SLACK_BOT_TOKEN,
          channel: channelId,
          ts: threadTs,
          cursor: cursor,
          limit: 200, // Max limit per API call
        });

        messages = messages.concat(result.messages || []);
        hasMore = result.has_more;
        cursor = result.response_metadata?.next_cursor;
      }

      // Concatenate all messages in the thread to provide context
      const context = messages.map((msg) => msg.text).join('\n');
      debugLog('Aggregated thread context:', context);
      return context;
    } catch (error) {
      console.error('Error fetching thread context:', error);
      throw new Error('Failed to fetch the thread context.');
    }
  }

  // Function to get the bot user ID dynamically
  async function getBotUserId(app) {
    try {
      const authResult = await app.client.auth.test();
      const botUserId = authResult.user_id;
      debugLog('Retrieved bot user ID:', botUserId);
      return botUserId;
    } catch (error) {
      console.error('Error retrieving bot user ID:', error);
      throw new Error('Failed to retrieve bot user ID.');
    }
  }

  // Handle @briefops mentions for direct chat interaction
  app.event('app_mention', async ({ event, say }) => {
    try {
      debugLog('app_mention event received:', event);

      // Get the bot user ID
      let botUserId = process.env.SLACK_BOT_USER_ID;
      if (!botUserId) {
        debugLog('SLACK_BOT_USER_ID not set, retrieving dynamically.');
        botUserId = await getBotUserId(app);
        process.env.SLACK_BOT_USER_ID = botUserId; // Set it for future use
      } else {
        debugLog('Using SLACK_BOT_USER_ID from environment:', botUserId);
      }

      // Remove only the bot's mention from the text
      const mentionRegex = new RegExp(`<@${botUserId}>`, 'g');
      const userMessage = event.text.replace(mentionRegex, '').trim();
      debugLog('User message after removing bot mention:', userMessage);

      if (!userMessage) {
        debugLog('User message is empty after removing bot mention');
        await say({
          text: `:information_source: Please provide some text to process.`,
          thread_ts: event.ts,
        });
        return;
      }

      // Fetch the complete thread context
      const threadContext = await fetchThreadContext(
        app,
        event.channel,
        event.thread_ts || event.ts
      );

      // Prepare input for the model, including thread context
      const prompt = `Consider the entire thread context for accuracy and relevance.\n\nContext:\n${threadContext}\n\nUser query:\n${userMessage}`;
      debugLog('Prepared prompt for model:', prompt);

      // Generate chat response
      const response = await generateChatResponse(prompt);
      debugLog('Generated response:', response);

      // Send the response back to Slack
      await say({
        text: `*Response:*\n${response}`,
        thread_ts: event.ts,
      });
    } catch (error) {
      console.error('Error handling @briefops chat interaction:', error);
      await say({
        text:
          error.message || 'An error occurred while processing your request.',
        thread_ts: event.ts,
      });
    }
  });
};
