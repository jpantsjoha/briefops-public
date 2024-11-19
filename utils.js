// utils.js
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { Storage } = require('@google-cloud/storage');
const {
  summarizeTextContent,
  summarizeDocumentFromGCS,
} = require('./vertexAIClient');
const { VERTEX_AI_MODEL, VERTEX_AI_LOCATION } = require('./config');

// Initialize Google Cloud Storage
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME; // Ensure your bucket name is set in environment variables

/**
 * Upload a file to Google Cloud Storage
 * @param {Buffer} fileContent - The file content as a Buffer
 * @param {string} fileName - The name of the file to upload
 * @returns {string} - Returns the file URI (gs://bucket_name/file_name)
 */

async function uploadToGCS(fileContent, fileName, bucketName = GCS_BUCKET_NAME, isGrounding = false) {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // Prepare metadata with 'grounding' custom attribute if flag is set
    const metadata = isGrounding
      ? { metadata: { grounding: 'true' } }
      : undefined;

    const stream = file.createWriteStream({
      resumable: false,
      metadata: metadata,
    });

    stream.on('error', (err) => {
      console.error('Error uploading to GCS:', err);
      throw err;
    });

    stream.end(fileContent);

    console.log(`File uploaded to GCS at: gs://${bucketName}/${fileName}`);
    return `gs://${bucketName}/${fileName}`;
  } catch (error) {
    console.error('Failed to upload file to GCS:', error.message);
    throw error;
  }
}
/**
 * Download a file from Slack
 * @param {string} url - The private URL of the file to download
 * @param {string} mimeType - The MIME type of the file being downloaded
 * @returns {Promise<Buffer>} - Returns the file content in a Buffer
 */
async function downloadFile(url, mimeType) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': mimeType,
      },
    });
    return Buffer.from(response.data); // Return file content as a Buffer
  } catch (error) {
    console.error(`[ERROR] Error downloading file from Slack: ${error.message}`);
    throw new Error('Failed to download the file from Slack.');
  }
}

/**
 * Analyze messages for content (files, URLs, YouTube links)
 * @param {Array} messages - Array of Slack messages
 * @returns {Object} - An object containing file, youtubeUrl, and url if found
 */
function analyzeMessagesForContent(messages) {
  let file = null;
  let url = null;
  let youtubeUrl = null;

  const youtubeRegex = /https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/i;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  for (const message of messages) {
    // Check for files
    if (message.files && message.files.length > 0) {
      // Prioritize files
      file = message.files.find(
        (f) =>
          f.mimetype === 'application/pdf' ||
          f.mimetype.startsWith('image/') ||
          f.mimetype.startsWith('application/')
      );
      if (file) break;
    }

    // Check for YouTube URLs
    const youtubeMatches = message.text.match(youtubeRegex);
    if (youtubeMatches && youtubeMatches.length > 0) {
      youtubeUrl = youtubeMatches[0];
      // Since a YouTube URL is found, we can proceed accordingly
      break;
    }

    // Check for other URLs in the message text
    const urls = message.text.match(urlRegex);
    if (urls && urls.length > 0) {
      url = urls[0];
      // Continue checking for files, but if a URL is found, store it
    }
  }

  return { file, youtubeUrl, url };
}

/**
 * Summarize a document from a Slack file
 * @param {Object} file - Slack file object
 * @returns {Promise<string>} - Returns the summary as a string
 */
async function summarizeDocumentFromFile(file) {
  try {
    // Download the file from Slack
    const fileContent = await downloadFile(
      file.url_private_download,
      file.mimetype
    );

    // Upload the file to Google Cloud Storage
    const gcsUri = await uploadToGCS(fileContent, file.name);

    // Summarize the document using Vertex AI
    const summary = await summarizeDocumentFromGCS(gcsUri);

    return summary;
  } catch (error) {
    console.error('Error summarizing document:', error);
    throw new Error('Failed to summarize the document.');
  }
}

/**
 * Fetch content from a URL
 * @param {string} url - The URL to fetch content from
 * @returns {Promise<string>} - Returns the content as a string
 */
async function fetchUrlContent(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`[ERROR] Error fetching URL content: ${error.message}`);
    throw new Error('Failed to fetch the URL content.');
  }
}

/**
 * Summarize content from a URL
 * @param {string} url - The URL to summarize content from
 * @returns {Promise<string>} - Returns the summary as a string
 */
async function summarizeUrlContent(url) {
  try {
    const content = await fetchUrlContent(url);

    // Extract text content from HTML using Cheerio
    const $ = cheerio.load(content);
    const text = $('body').text();

    // Summarize the extracted text using Vertex AI
    const summary = await summarizeTextContent(text);

    return summary;
  } catch (error) {
    console.error('Error summarizing URL content:', error);
    throw new Error('Failed to summarize the URL content.');
  }
}

/**
 * Extracts the YouTube video ID from a URL.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} - The video ID or null if not found.
 */
function getYouTubeVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

module.exports = {
  downloadFile,
  getYouTubeVideoId,
  uploadToGCS,
  analyzeMessagesForContent,
  summarizeDocumentFromFile,
  summarizeUrlContent,
};