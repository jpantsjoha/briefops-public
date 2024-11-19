// fs-summary.js

const { downloadFile, uploadToGCS, getYouTubeVideoId } = require('./utils');
const { summarizeDocumentFromGCS } = require('./vertexAIClient');
const db = require('./firebaseClient');
const { GCS_BUCKET_NAME } = require('./config');
const { summarizeYouTubeVideo } = require('./yt-summary');

// Global debug flag
const DEBUG = true;

function debugLog(message, ...args) {
  if (DEBUG) {
    console.log('[DEBUG fs-summary.js]', message, ...args);
  }
}

module.exports = function (app) {
  // Command to ingest a document or YouTube video
  app.command('/briefops-ingest', async ({ command, ack, respond, say }) => {
    try {
      await ack();
      const inputText = command.text.trim();

      // Check if the input is a YouTube link
      const youtubeVideoId = getYouTubeVideoId(inputText);

      if (youtubeVideoId) {
        // Handle YouTube video summarization
        await respond({
          text: `Ingestion started: Processing the YouTube video: ${inputText}`,
        });

        debugLog('Received YouTube URL for ingestion:', inputText);
        debugLog('Extracted video ID:', youtubeVideoId);

        // Summarize the YouTube video
        const summary = await summarizeYouTubeVideo(inputText);

        // Store the summary result in Firestore
        await db.collection('youtubeSummaries').add({
          videoId: youtubeVideoId,
          videoUrl: inputText,
          summary,
          createdAt: new Date(),
        });

        // Notify the channel about the success of ingestion
        await say({
          text: `🎉 The YouTube video has been successfully ingested and summarized. Here’s a brief summary: \n${summary}\nFeel free to query @briefops for further details!`,
          channel: command.channel_id,
        });

        debugLog(
          'Public notification sent for successful ingestion and summarization of YouTube video:',
          inputText
        );
      } else {
        // Handle Slack file ingestion (existing functionality)
        const slackFileUrl = inputText; // Assuming inputText is the Slack file URL
        const fileId = slackFileUrl
          .split('/')
          .find((part) => part.startsWith('F')); // Extract file ID

        if (!fileId) {
          throw new Error(
            'Invalid Slack file URL or YouTube link. Could not extract the file ID.'
          );
        }

        await respond({
          text: `Ingestion started: Processing the document from the URL: ${slackFileUrl}`,
        });

        debugLog('Received Slack file URL for ingestion:', slackFileUrl);
        debugLog('Extracted file ID:', fileId);

        // Fetch file information from Slack
        const result = await app.client.files.info({
          token: process.env.SLACK_BOT_TOKEN,
          file: fileId,
        });

        const file = result.file;
        debugLog('File to be ingested:', file.name, 'type:', file.mimetype);

        await respond({
          text: `Fetching file information from Slack for file ID: ${fileId}...`,
        });

        // Download the file from Slack
        const fileContent = await downloadFile(
          file.url_private_download,
          file.mimetype
        );
        debugLog('Downloading the document:', file.name);

        await respond({
          text: `Downloading the document: ${file.name}...`,
        });

        // Upload the file to Google Cloud Storage with grounding flag
        const gcsFileUri = await uploadToGCS(
          fileContent,
          file.name,
          GCS_BUCKET_NAME,
          true // Set isGrounding to true
        );
        debugLog('File uploaded to GCS at:', gcsFileUri);

        // Store the file metadata in Firestore for later access
        await db.collection('ingestedFiles').add({
          fileId,
          fileName: file.name,
          gcsUri: gcsFileUri,
          createdAt: new Date(),
        });

        await respond({
          text: `File uploaded to GCS. Starting Vertex AI summarization for ${file.name}...`,
        });

        // Summarize the document using Vertex AI
        const summary = await summarizeDocumentFromGCS(gcsFileUri);
        if (!summary) {
          throw new Error('Failed to summarize the document.');
        }

        // Store the summary result in Firestore
        await db.collection('documentSummaries').add({
          fileId,
          fileName: file.name,
          summary,
          createdAt: new Date(),
        });

        // Notify the whole channel about the success of ingestion
        await say({
          text: `🎉 The document *${file.name}* has been successfully ingested and summarized. Here’s a brief summary: \n${summary}\nFeel free to query @briefops for further details!`,
          channel: command.channel_id,
        });

        debugLog(
          'Public notification sent for successful ingestion and summarization of',
          file.name
        );
      }
    } catch (error) {
      console.error('[ERROR] Ingestion failed:', error.message);

      // Notify the user about the failure
      await respond({
        text: `:x: An error occurred during ingestion: ${error.message}. Please check the logs for more details.`,
      });
    }
  });
};