// onboarding.js
const { detectIntentText } = require('./dialogflowClient');

module.exports = function (app) {
  // Retrieve the bot's user ID
  let botUserId;

  (async () => {
    try {
      const authResult = await app.client.auth.test();
      botUserId = authResult.user_id;
      console.log('[INFO] Retrieved bot user ID:', botUserId);
    } catch (error) {
      console.error('[ERROR] Failed to retrieve bot user ID:', error);
    }
  })();

  // Function to send onboarding message
  async function sendOnboardingMessage(channelId) {
    const message = `
:wave: Welcome to *BriefOps*!
Here are the commands you can use to get started:

1. \`/briefops [days]\` - Summarize channel conversations from the last [days] days (default: 7 days).
2. \`/briefops-status\` - Check the app's status and usage limits.
3. \`/briefops-ingest [SLACK-PDF][YOUTUBE_VID_URL] \` - This will summarise the content of the media and \`--public\`to share such summary with the channel
4. \`/briefops-search\` - Private Google Search. Use \`--summarise\` to summarise search result sources and \`--public\`to share such summary with the channel.

PS: In the future you'd be able to chat with \`@BriefOps\`!
Happy summarizing! 🚀
    `;

    try {
      await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channelId,
        text: message,
      });
      console.log('[INFO] Onboarding message sent successfully.');
    } catch (error) {
      console.error('[ERROR] Failed to send onboarding message:', error);
    }
  }

  // Detect when the bot is mentioned with no additional text
  app.event('app_mention', async ({ event }) => {
    try {
      console.log('[INFO] User mentioned the app:', event.user);

      const text = event.text.trim();
      const mentionSyntax = `<@${botUserId}>`;

      if (text === mentionSyntax) {
        // User mentioned the bot with no additional text
        await sendOnboardingMessage(event.channel);
      } else {
        // Handle other cases when there's additional text
        // You can process the text or respond accordingly
        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: event.channel,
          text: `Hello! How can I assist you?`,
        });
      }
    } catch (error) {
      console.error('[ERROR] Error during onboarding flow:', error);
    }
  });

  // Integrate Dialogflow CX
  app.message(async ({ message, say }) => {
    if (message.subtype && message.subtype === 'bot_message') {
      return;
    }

    const sessionId = message.user; // Use user ID as session ID
    const userText = message.text;

    try {
      const response = await detectIntentText(sessionId, userText);

      const replyText = response.queryResult.responseMessages
        .map((msg) => (msg.text ? msg.text.text : ''))
        .join('\n');

      await say(replyText);
    } catch (error) {
      console.error('[ERROR] Dialogflow CX integration error:', error);
      await say("Sorry, I'm having trouble understanding you right now.");
    }
  });
};