const { downloadFile, uploadToGCS } = require('./utils'); // Utilities for file operations
const { summarizeDocumentFromGCS } = require('./vertexAIClient'); // Summarization function
const db = require('./firebaseClient'); // Firestore client
const { VERTEX_AI_MODEL_PDF, GCS_BUCKET_NAME } = require('./config'); // Configurations

module.exports = function (app) {
  // Command to ingest a document
  app.command('/briefops-ingest', async ({ command, ack, respond, say }) => {
    try {
      await ack();

      const slackFileUrl = command.text.trim(); // Get Slack file URL from the command
      const fileId = slackFileUrl.split('/').find((part) => part.startsWith('F')); // Extract file ID

      if (!fileId) {
        throw new Error('Invalid Slack file URL. Could not extract the file ID.');
      }

      await respond({
        text: `Ingestion started: Processing the document from the URL: ${slackFileUrl}`,
      });

      console.log(`[INFO] Received Slack file URL for ingestion: ${slackFileUrl}`);
      console.log(`[INFO] Extracted file ID: ${fileId}`);

      // Fetch file information from Slack
      const result = await app.client.files.info({
        token: process.env.SLACK_BOT_TOKEN,
        file: fileId,
      });

      const file = result.file;
      console.log(`[INFO] File to be ingested: ${file.name}, type: ${file.mimetype}`);

      await respond({
        text: `Fetching file information from Slack for file ID: ${fileId}...`,
      });

      // Download the file from Slack
      const fileContent = await downloadFile(file.url_private_download, file.mimetype);
      console.log(`[INFO] Downloading the document: ${file.name}`);

      await respond({
        text: `Downloading the document: ${file.name}...`,
      });

      // Upload the file to Google Cloud Storage
      const gcsFileUri = await uploadToGCS(fileContent, file.name, GCS_BUCKET_NAME);
      console.log(`[INFO] File uploaded to GCS at: ${gcsFileUri}`);

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
        throw new Error('Failed to summarize the PDF.');
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

      console.log(`[INFO] Public notification sent for successful ingestion and summarization of ${file.name}.`);

    } catch (error) {
      console.error(`[ERROR] Ingestion failed: ${error.message}`);

      // Notify the user about the failure
      await respond({
        text: `[ERROR] An error occurred during ingestion: ${error.message}. Please check the logs for more details.`,
      });
    }
  });

  // Handle @briefops mention events
  app.event('app_mention', async ({ event, say }) => {
    try {
      const text = event.text.trim();
      console.log(`[INFO] @briefops was mentioned with text: ${text}`);

      // Check for document querying requests or conversation summaries
      if (text.includes('document')) {
        // Fetch the document details from Firestore
        const docsSnapshot = await db.collection('ingestedFiles').get();
        const documents = docsSnapshot.docs.map(doc => doc.data());

        let responseText = 'Here are the documents available for querying:\n';
        documents.forEach((doc) => {
          responseText += `• *${doc.fileName}* - available at GCS URI: ${doc.gcsUri}\n`;
        });

        // Reply with the list of available documents
        await say({
          text: responseText,
          thread_ts: event.thread_ts || event.ts,
        });

      } else {
        // Handle other types of @briefops mentions
        await say({
          text: 'I am ready to assist with summarization and document queries! 🚀',
          thread_ts: event.thread_ts || event.ts,
        });
      }

    } catch (error) {
      console.error(`[ERROR] Error handling @briefops mention: ${error.message}`);
      await say({
        text: `[ERROR] An error occurred while processing your request: ${error.message}.`,
        thread_ts: event.thread_ts || event.ts,
      });
    }
  });
};
