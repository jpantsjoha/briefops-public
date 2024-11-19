// summarization.js

const {
  downloadFile,
  summarizeDocument,
  fetchThreadMessages,
  fetchThreadMessagesAndFiles,
  analyzeMessagesForContent,
  summarizeDocumentFromFile,
  summarizeUrlContent,
} = require('./utils');

const { summarizeTextContent } = require('./vertexAIClient');
const db = require('./firebaseClient');
const {
  FREE_TIER_DAILY_LIMIT,
  FREE_TIER_MAX_DAYS,
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
      const { messages, files } = await fetchThreadMessagesAndFiles(
        app,
        channelId,
        threadTs
      );

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
        text: `*Summary for the thread:*\n${summary}`,
        thread_ts: threadTs,
      });
    } catch (error) {
      console.error('Error handling @briefops mention:', error);
      await say({
        text: error.message || 'An error occurred while processing your request.',
        thread_ts: message.thread_ts || message.ts,
      });
    }
  });

  // Handle the /briefops command
  app.command('/briefops', async ({ command, ack, respond, say }) => {
    try {
      // Acknowledge the command
      await ack();

      const isInThread = Boolean(command.thread_ts);
      const threadTs = command.thread_ts || command.ts;
      const channelId = command.channel_id;

      // Parse the command text for flags
      const args = command.text.trim().split(/\s+/);
      let numDays = 7; // Default number of days
      let isPublic = true;
      const isYouTubeFlagPresent = args.includes('--youtube');

      args.forEach((arg) => {
        if (arg === '--private') {
          isPublic = false;
        } else if (/^\d+$/.test(arg)) {
          numDays = parseInt(arg, 10);
          if (numDays <= 0) numDays = 7; // Ensure positive integer
        }
      });

      if (isInThread) {
        // Summarization in a thread
        const messages = await fetchThreadMessages(app, channelId, threadTs);

        // Analyze messages for content (files, URLs, etc.)
        const { file, youtubeUrl, url } = analyzeMessagesForContent(messages);

        if (file) {
          await say({
            text: `Found a document "${file.name}". Summarizing...`,
            thread_ts: threadTs,
          });
          try {
            const summary = await summarizeDocumentFromFile(file);
            await say({
              text: `*Summary of the document "${file.name}":*\n${summary}`,
              thread_ts: threadTs,
            });
          } catch (error) {
            console.error('Error summarizing document:', error);
            await say({
              text: `:warning: Failed to summarize the document. ${error.message}`,
              thread_ts: threadTs,
            });
          }
        } else if (youtubeUrl) {
          await say({
            text: `Found a YouTube link: ${youtubeUrl}`,
            thread_ts: threadTs,
          });
          if (isYouTubeFlagPresent) {
            await say({
              text: ':construction: Summarizing YouTube videos is under development.',
              thread_ts: threadTs,
            });
          } else {
            await say({
              text: ':information_source: Use `--youtube` for YouTube transcript summaries.',
              thread_ts: threadTs,
            });
          }
        } else if (url) {
          await say({
            text: `Found a URL: ${url}. Summarizing...`,
            thread_ts: threadTs,
          });
          try {
            const summary = await summarizeUrlContent(url);
            await say({
              text: `*Summary of the content at ${url}:*\n${summary}`,
              thread_ts: threadTs,
            });
          } catch (error) {
            console.error('Error summarizing URL:', error);
            await say({
              text: `:warning: Failed to summarize the URL. ${error.message}`,
              thread_ts: threadTs,
            });
          }
        } else {
          await say({
            text: 'No documents or URLs found in this thread to summarize.',
            thread_ts: threadTs,
          });
        }
      } else {
        // Summarization in a channel (fetch messages for a number of days)
        let messages;
        try {
          messages = await fetchChannelMessages(app, channelId, numDays);
        } catch (error) {
          // Handle the 'not_in_channel' error specifically
          if (error.message.includes('Please invite me by typing')) {
            await respond({
              response_type: 'ephemeral',
              text: error.message,
            });
            return;
          } else {
            throw error; // Re-throw other errors
          }
        }

        if (messages.length === 0) {
          await respond({
            response_type: isPublic ? 'in_channel' : 'ephemeral',
            text: `:information_source: No messages found in the past ${numDays} day(s) to summarize.`,
          });
          return;
        }

        await respond({
          response_type: isPublic ? 'in_channel' : 'ephemeral',
          text: '_Generating the summary, please wait..._',
        });

        try {
          const summary = await summarizeMessagesAndFiles(messages, []);
          await respond({
            response_type: isPublic ? 'in_channel' : 'ephemeral',
            text: `*Here is the summary for the past ${numDays} day(s):*\n${summary}`,
          });
        } catch (error) {
          console.error('Error summarizing messages:', error);
          await respond({
            response_type: 'ephemeral',
            text: `:warning: Failed to summarize the messages. ${error.message}`,
          });
        }
      }
    } catch (error) {
      console.error('Error handling /briefops command:', error);
      await respond({
        response_type: 'ephemeral',
        text: error.message || 'An error occurred while processing your request.',
      });
    }
  });

  // Function to summarize messages and files
  async function summarizeMessagesAndFiles(messages, files) {
    let content = messages.join('\n');

    // Add file content if available
    for (const file of files) {
      const fileSummary = await summarizeFile(file);
      content += `\n\n${fileSummary}`;
    }

    try {
      console.log('[INFO] Sending messages to Vertex AI for summarization...');
      const summary = await summarizeTextContent(content);
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
      messages = messages.filter(
        (msg) => parseFloat(msg.ts) >= oldestTimestamp
      );

      return messages.map((msg) => msg.text || '').reverse(); // Reverse to chronological order
    } catch (error) {
      console.error('Error fetching channel messages:', error);

      // Check for the 'not_in_channel' error
      if (error.data?.error === 'not_in_channel') {
        throw new Error(
          `It looks like I'm not a member of this channel. Please invite me by typing: \`/invite @briefops\`.`
        );
      }

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

  // Function to fetch messages from a thread
  async function fetchThreadMessages(app, channelId, threadTs) {
    try {
      let messages = [];
      let hasMore = true;
      let cursor;

      while (hasMore) {
        const result = await app.client.conversations.replies({
          channel: channelId,
          ts: threadTs,
          limit: 200,
          cursor: cursor,
        });

        messages = messages.concat(result.messages || []);
        hasMore = result.has_more;
        cursor = result.response_metadata?.next_cursor;
      }

      return messages;
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      throw new Error('Failed to fetch thread messages due to an unexpected error.');
    }
  }

  // Function to analyze messages for content
  function analyzeMessagesForContent(messages) {
    return utils.analyzeMessagesForContent(messages);
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