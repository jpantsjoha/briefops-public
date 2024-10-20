const { downloadFile, summarizeDocument } = require('./utils');
const vertex_ai = require('./vertexAIClient');
const db = require('./firebaseClient');
const {
  FREE_TIER_DAILY_LIMIT,
  FREE_TIER_MAX_DAYS,
  VERTEX_AI_MODEL,
  SUMMARIZATION_TEMPERATURE,
  SUMMARIZATION_MAX_OUTPUT_TOKENS,
  SUMMARIZATION_TOP_P,
  SUMMARIZATION_TOP_K,
} = require('./config');

module.exports = function (app) {
  // Handle messages where @briefops is mentioned in a thread
  app.message(/<@\w+>/, async ({ message, say, client }) => {
    try {
      const botUserId = process.env.SLACK_BOT_USER_ID;
      if (!message.text.includes(`<@${botUserId}>`)) {
        return; // Ignore messages that don't mention the bot directly
      }

      // Fetch the thread context if this is in a thread
      const channelId = message.channel;
      const threadTs = message.thread_ts || message.ts;
      const { messages, files } = await fetchThreadMessagesAndFiles(app, channelId, threadTs);

      if (messages.length === 0 && files.length === 0) {
        await say({
          text: `:information_source: No messages or files found in the thread to summarize.`,
          thread_ts: threadTs,
        });
        return;
      }

      // Summarize messages and files using Vertex AI
      const summary = await summarizeMessagesAndFiles(messages, files);

      // Post summary back to the thread
      await say({
        text: `*Summary for the thread:*
${summary}`,
        thread_ts: threadTs,
      });
    } catch (error) {
      console.error('Error handling @briefops mention:', error);
      await say({
        text: error.message || 'An error occurred while processing your request.',
        thread_ts: message.ts,
      });
    }
  });

  // Handle the /briefops command for channel conversation summarisation
  app.command('/briefops', async ({ command, ack, respond }) => {
    try {
      await ack();

      // Parse the number of days from the command text
      let numDays = 7; // Default to 7 days
      if (command.text) {
        const match = command.text.trim().match(/^\d+/);
        if (match && !isNaN(match[0])) {
          numDays = parseInt(match[0], 10);
          if (numDays <= 0) numDays = 7; // Ensure positive integer
        }
      }

      // Check usage limits (for free tier users)
      const usageAllowed = await checkUsageLimits(command.user_id, numDays);
      if (!usageAllowed) {
        await respond({
          response_type: 'ephemeral',
          text: `:warning: You have reached your daily summary limit of ${FREE_TIER_DAILY_LIMIT} summaries.`,
        });
        return;
      }

      // Inform the user that processing has started
      await respond({
        response_type: 'in_channel', // Publish summary publicly in the channel
        text: '_Generating the public summary, please wait..._',
      });

      // Fetch messages from the specified number of days in the channel
      const channelId = command.channel_id;
      const messages = await fetchChannelMessages(app, channelId, numDays);

      if (messages.length === 0) {
        await respond({
          response_type: 'in_channel',
          text: `:information_source: No messages found in the past ${numDays} day(s) to summarize.`,
        });
        return;
      }

      // Summarize messages using Vertex AI
      const summary = await summarizeMessagesAndFiles(messages, []);

      // Send summary to the channel
      await respond({
        response_type: 'in_channel',
        text: `*Here is the public summary for the past ${numDays} day(s):*
${summary}`,
      });

      // Update usage count
      await incrementUsageCount(command.user_id);
    } catch (error) {
      console.error('Error handling /briefops command:', error);
      await respond({
        response_type: 'in_channel',
        text: error.message || 'An error occurred while processing your request.',
      });
    }
  });

  // Function to summarize messages and files using Vertex AI
  async function summarizeMessagesAndFiles(messages, files) {
    let content = messages.join('\n');

    // Add file content if available
    for (const file of files) {
      const fileSummary = await summarizeFile(file);
      content += `\n\n${fileSummary}`;
    }

    const model = VERTEX_AI_MODEL;

    // System instruction for summarization
    const systemInstruction = {
      text: 'You are an assistant that summarizes Slack messages and documents. Please provide a concise summary of the provided content.',
    };

    // Initialize the generative model
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: SUMMARIZATION_MAX_OUTPUT_TOKENS,
        temperature: SUMMARIZATION_TEMPERATURE,
        topP: SUMMARIZATION_TOP_P,
        topK: SUMMARIZATION_TOP_K,
      },
      systemInstruction: {
        parts: [systemInstruction],
      },
    });

    const userInput = { text: content };

    const req = {
      contents: [{ role: 'user', parts: [userInput] }],
    };

    try {
      const modelResponse = await generativeModel.generateContent(req);

      // Safely access the generated summary
      const response = modelResponse.response;
      const candidate = response && response.candidates && response.candidates[0];
      const summary = candidate?.content?.parts?.[0]?.text;

      if (!summary) {
        console.error('No summary generated by the model.');
        return 'The model did not generate a summary.';
      }

      return summary;
    } catch (error) {
      console.error('Error during summarization:', error);
      return 'An error occurred while generating the summary.';
    }
  }

  // Function to summarize an individual file
  async function summarizeFile(file) {
    try {
      // Only process supported file types
      const supportedTypes = ['application/pdf', 'text/csv'];
      if (!supportedTypes.includes(file.mimetype)) {
        return `:information_source: File type ${file.mimetype} is not supported for summarization.`;
      }

      // Download and summarize the file
      const fileContent = await downloadFile(file.url_private, file.mimetype);
      return await summarizeDocument(fileContent);
    } catch (error) {
      console.error('Error summarizing file:', error);
      return 'An error occurred while summarizing the file.';
    }
  }

  function getOldestTimestamp(numDays) {
    const date = new Date();
    date.setDate(date.getDate() - numDays);
    return Math.floor(date.getTime() / 1000); // Convert to Unix timestamp
  }

  // Function to fetch messages from a channel
  async function fetchChannelMessages(app, channelId, numDays) {
    try {
      const oldestTimestamp = getOldestTimestamp(numDays);
      let messages = [];
      let hasMore = true;
      let cursor;

      while (hasMore) {
        const result = await app.client.conversations.history({
          token: process.env.SLACK_BOT_TOKEN,
          channel: channelId,
          oldest: oldestTimestamp,
          limit: 200, // Max limit per API call
          cursor: cursor,
        });

        messages = messages.concat(result.messages || []);
        hasMore = result.has_more;
        cursor = result.response_metadata?.next_cursor;
      }

      // Filter messages to ensure they are within the desired time range
      messages = messages.filter((msg) => parseFloat(msg.ts) >= oldestTimestamp);

      return messages.map((msg) => msg.text).reverse(); // Reverse to chronological order
    } catch (error) {
      console.error('Error fetching channel messages:', error);
      throw new Error('Failed to fetch messages due to an unexpected error.');
    }
  }

  // Function to fetch messages and files from a thread
  async function fetchThreadMessagesAndFiles(app, channelId, threadTs) {
    try {
      let messages = [];
      let files = [];
      let hasMore = true;
      let cursor;

      while (hasMore) {
        const result = await app.client.conversations.replies({
          token: process.env.SLACK_BOT_TOKEN,
          channel: channelId,
          ts: threadTs,
          limit: 200, // Max limit per API call
          cursor: cursor,
        });

        result.messages.forEach((msg) => {
          if (msg.text) messages.push(msg.text);
          if (msg.files) {
            files = files.concat(msg.files);
          }
        });

        hasMore = result.has_more;
        cursor = result.response_metadata?.next_cursor;
      }

      return { messages: messages.reverse(), files };
    } catch (error) {
      console.error('Error fetching thread messages and files:', error);
      throw new Error('Failed to fetch messages and files due to an unexpected error.');
    }
  }

  // Function to check usage limits
  async function checkUsageLimits(userId, numDays) {
    try {
      const docRef = db.collection('usage').doc(userId);
      const doc = await docRef.get();
      const today = new Date().toISOString().slice(0, 10);

      // Check for maximum days allowed
      if (FREE_TIER_MAX_DAYS > 0 && numDays > FREE_TIER_MAX_DAYS) {
        throw new Error(`Free users can summarize up to ${FREE_TIER_MAX_DAYS} days.`);
      }

      // Check for daily summary limit
      if (FREE_TIER_DAILY_LIMIT > 0) {
        if (!doc.exists) {
          // No usage data, allow usage
          return true;
        } else {
          const data = doc.data();
          if (data.date === today && data.count >= FREE_TIER_DAILY_LIMIT) {
            // Exceeded daily limit
            return false;
          } else {
            // Allow usage
            return true;
          }
        }
      } else {
        // No daily limit imposed
        return true;
      }
    } catch (error) {
      console.error('Error in checkUsageLimits:', error);
      throw error; // Rethrow the error to be caught in the command handler
    }
  }

  // Function to increment usage count
  async function incrementUsageCount(userId) {
    if (FREE_TIER_DAILY_LIMIT > 0) {
      const docRef = db.collection('usage').doc(userId);
      const today = new Date().toISOString().slice(0, 10);
      await db.runTransaction(async (t) => {
        const doc = await t.get(docRef);
        if (!doc.exists || doc.data().date !== today) {
          t.set(docRef, { date: today, count: 1 });
        } else {
          const newCount = doc.data().count + 1;
          t.update(docRef, { count: newCount });
        }
      });
    }
    // If no daily limit, no need to increment usage count
  }
};
