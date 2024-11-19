require('dotenv').config();

module.exports = {

  //yt
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  OAUTH2_REDIRECT_URI: process.env.OAUTH2_REDIRECT_URI || 'http://localhost:8080/oauth2callback',
  //GOOGLE SEARCH
  SEARCH_ENGINE_ID: process.env.SEARCH_ENGINE_ID || 'your-search-engine-id',

  // Free tier limits
  FREE_TIER_DAILY_LIMIT: process.env.FREE_TIER_DAILY_LIMIT
    ? parseInt(process.env.FREE_TIER_DAILY_LIMIT)
    : 100, // Default to 100 summaries per day

  FREE_TIER_MAX_DAYS: process.env.FREE_TIER_MAX_DAYS
    ? parseInt(process.env.FREE_TIER_MAX_DAYS)
    : 14, // Default to 14 days

  // Vertex AI configuration
  VERTEX_AI_MODEL_PDF: process.env.VERTEX_AI_MODEL_PDF || 'gemini-1.5-flash-002',
  VERTEX_AI_MODEL_TEXT: process.env.VERTEX_AI_MODEL_TEXT || 'gemini-1.5-flash-002',
  VERTEX_AI_MODEL: process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-002',
  VERTEX_AI_LOCATION: process.env.VERTEX_AI_LOCATION || 'us-central1', // Default location

  // Summarization parameters
  SUMMARIZATION_TEMPERATURE: process.env.SUMMARIZATION_TEMPERATURE
    ? parseFloat(process.env.SUMMARIZATION_TEMPERATURE)
    : 0.7, // Default temperature

  SUMMARIZATION_MAX_OUTPUT_TOKENS: process.env.SUMMARIZATION_MAX_OUTPUT_TOKENS
    ? parseInt(process.env.SUMMARIZATION_MAX_OUTPUT_TOKENS)
    : 1024, // Adjusted for typical usage

  SUMMARIZATION_TOP_P: process.env.SUMMARIZATION_TOP_P
    ? parseFloat(process.env.SUMMARIZATION_TOP_P)
    : 0.9, // Default top_p

  SUMMARIZATION_TOP_K: process.env.SUMMARIZATION_TOP_K
    ? parseInt(process.env.SUMMARIZATION_TOP_K)
    : 40, // Default top_k

  // Slack app configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug', // Set default log level to 'debug' for verbosity

  // Google Cloud configuration
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'your-google-cloud-project-id',

  //DIALOGFLOW CX
  DIALOGFLOW_AGENT_ID: process.env.DIALOGFLOW_AGENT_ID || 'your-dialogflow-agent-id',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'dialogflowcx-bucket-briefops'


};