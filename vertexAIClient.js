// vertexAIClient.js

const { VertexAI } = require('@google-cloud/vertexai');
const { VERTEX_AI_LOCATION } = require('./config');

const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: VERTEX_AI_LOCATION,
});

module.exports = vertex_ai;