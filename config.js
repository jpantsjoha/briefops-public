// config.js

require('dotenv').config();

module.exports = {
  // Free tier limits
  FREE_TIER_DAILY_LIMIT: process.env.FREE_TIER_DAILY_LIMIT
    ? parseInt(process.env.FREE_TIER_DAILY_LIMIT)
    : 100, // Default to 10 summaries per day

  FREE_TIER_MAX_DAYS: process.env.FREE_TIER_MAX_DAYS
    ? parseInt(process.env.FREE_TIER_MAX_DAYS)
    : 14, // Default to 7 days

  // Vertex AI configuration
  VERTEX_AI_MODEL: process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-002',
  VERTEX_AI_LOCATION: process.env.VERTEX_AI_LOCATION || 'us-central1', // Default location

  // Summarization parameters
  SUMMARIZATION_TEMPERATURE: process.env.SUMMARIZATION_TEMPERATURE
    ? parseFloat(process.env.SUMMARIZATION_TEMPERATURE)
    : 0.7, // Default temperature

  SUMMARIZATION_MAX_OUTPUT_TOKENS: process.env.SUMMARIZATION_MAX_OUTPUT_TOKENS
    ? parseInt(process.env.SUMMARIZATION_MAX_OUTPUT_TOKENS)
    : 1000, // Default max output tokens

  SUMMARIZATION_TOP_P: process.env.SUMMARIZATION_TOP_P
    ? parseFloat(process.env.SUMMARIZATION_TOP_P)
    : 0.9, // Default top_p

  SUMMARIZATION_TOP_K: process.env.SUMMARIZATION_TOP_K
    ? parseInt(process.env.SUMMARIZATION_TOP_K)
    : 40, // Default top_k

  // Slack app configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug', // Set default log level to 'info' for less verbosity
};