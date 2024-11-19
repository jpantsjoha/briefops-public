// yt-summary.js

const { summarizeTextContent } = require('./vertexAIClient');
const { getYouTubeVideoId, uploadToGCS } = require('./utils');
const { GCS_BUCKET_NAME } = require('./config');
const { YoutubeTranscript } = require('youtube-transcript'); // Updated import

async function summarizeYouTubeVideo(url) {
  try {
    console.log('[DEBUG] Starting summarizeYouTubeVideo with URL:', url);

    const videoId = getYouTubeVideoId(url);
    console.log('[DEBUG] Extracted video ID:', videoId);

    if (!videoId) {
      throw new Error('Invalid YouTube URL.');
    }

    console.log('[DEBUG] Checking YoutubeTranscript:', YoutubeTranscript);
    console.log('[DEBUG] Available methods:', Object.keys(YoutubeTranscript));

    // Fetch the transcript using the correct method
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
    console.log('[DEBUG] Fetched transcript array:', transcriptArray);

    if (!transcriptArray || transcriptArray.length === 0) {
      throw new Error('No transcript available for this YouTube video.');
    }

    // Combine the transcript texts
    const transcript = transcriptArray.map((item) => item.text).join(' ');
    console.log('[DEBUG] Combined transcript text length:', transcript.length);

    // Optionally, upload the transcript to GCS with grounding flag
    const transcriptFileName = `youtube_transcript_${videoId}.txt`;
    await uploadToGCS(transcript, transcriptFileName, GCS_BUCKET_NAME, true);
    console.log('[DEBUG] Transcript uploaded to GCS.');

    // Handle large transcripts by splitting into chunks
    const maxTokens = 2000; // Adjust based on model limits
    const transcriptChunks = splitTextIntoChunks(transcript, maxTokens);
    console.log('[DEBUG] Number of transcript chunks:', transcriptChunks.length);

    // Summarize each chunk and collect the outputs
    let summaries = [];
    for (const chunk of transcriptChunks) {
      console.log('[DEBUG] Summarizing chunk of length:', chunk.length);
      const summary = await summarizeTextContent(chunk);
      summaries.push(summary);
    }

    // Combine the summaries and generate the final formatted output
    const combinedSummary = summaries.join('\n\n');
    console.log('[DEBUG] Combined summary length:', combinedSummary.length);

    // Optionally, summarize the combined summary
    const finalSummary = await summarizeTextContent(combinedSummary);
    console.log('[DEBUG] Final summary:', finalSummary);

    // Since the language model already formats the response, we can return it directly
    return finalSummary;
  } catch (error) {
    console.error('Error summarizing YouTube video:', error);
    throw new Error('Failed to summarize the YouTube video.');
  }
}

function splitTextIntoChunks(text, maxTokens) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.length >= maxTokens) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

module.exports = {
  summarizeYouTubeVideo,
};