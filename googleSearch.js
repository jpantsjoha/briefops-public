// googleSearch.js

// Import necessary modules
const { google } = require('googleapis');
const customsearch = google.customsearch('v1');
const axios = require('axios');
const cheerio = require('cheerio');

// Import configurations and summarization function
const { GOOGLE_API_KEY, SEARCH_ENGINE_ID } = require('./config');
const { summarizeTextContent } = require('./vertexAIClient');

// Tweakable Variables
const MAX_SEARCH_RESULTS = 7; // Number of search results to fetch
const MAX_SUMMARIES = 5; // Maximum number of sources to summarize
const MAX_MODEL_INPUT_TOKENS = 16000; // Max tokens the model can accept
const AVERAGE_TOKEN_PER_CHAR = 0.75; // Approximate average tokens per character
const MAX_TOTAL_CONTENT_LENGTH = Math.floor(MAX_MODEL_INPUT_TOKENS / AVERAGE_TOKEN_PER_CHAR); // Max combined content length in characters
const MAX_CONTENT_PER_SOURCE = 5000; // Max characters to extract per source
const USER_AGENT = 'briefops/1.0'; // User-Agent string for HTTP requests
const FETCH_TIMEOUT = 5000; // Timeout for fetching web pages (in milliseconds)

// Google Search Function
async function googleSearch(query) {
  try {
    const res = await customsearch.cse.list({
      auth: GOOGLE_API_KEY,
      cx: SEARCH_ENGINE_ID,
      q: query,
      num: MAX_SEARCH_RESULTS,
    });
    return res.data.items;
  } catch (error) {
    console.error('Error performing Google Search:', error);
    throw error;
  }
}

// Fetch and Clean Webpage Content
async function fetchWebpageContent(url, maxLength = MAX_CONTENT_PER_SOURCE) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
      timeout: FETCH_TIMEOUT,
    });

    const $ = cheerio.load(data);
    $('script, style, noscript, meta, link, header, footer, nav').remove();

    // Extract text from paragraphs and headings
    let content = '';
    $('h1, h2, h3, p').each((i, elem) => {
      content += $(elem).text() + '\n';
    });

    const cleanedContent = content.replace(/\s+/g, ' ').trim();

    // Limit the content length to avoid exceeding model limits
    return cleanedContent.substring(0, maxLength);
  } catch (error) {
    console.error(`Error fetching web page content from ${url}:`, error.message);
    throw error;
  }
}

// Main Module Export
module.exports = function (app) {
  app.command('/briefops-search', async ({ command, ack, respond, say }) => {
    try {
      await ack();

      const args = command.text.trim().split(' ');
      let summarize = false;
      let isPublic = false;
      let queryArgs = [];

      args.forEach(arg => {
        if (arg === '--summarise' || arg === '--summarize') {
          summarize = true;
        } else if (arg === '--public' || arg === '-public') {
          isPublic = true;
        } else {
          queryArgs.push(arg);
        }
      });

      const query = queryArgs.join(' ');

      if (!query) {
        await respond('Please provide a search query.');
        return;
      }

      const results = await googleSearch(query);

      if (results && results.length > 0) {
        if (summarize) {
          if (isPublic) {
            await say('Summarizing top results, please wait...');
          } else {
            await respond('Summarizing top results, please wait...');
          }

          let combinedContent = '';
          let failedSources = [];
          let sourcesUsed = [];
          let numSummaries = 0;
          let index = 0;
          let totalContentLength = 0;

          while (numSummaries < MAX_SUMMARIES && index < results.length) {
            const item = results[index];
            index++;

            try {
              const content = await fetchWebpageContent(item.link);
              if (content) {
                const contentToAdd = `\n\nTitle: ${item.title}\n${content}`;
                const newTotalLength = totalContentLength + contentToAdd.length;

                if (newTotalLength > MAX_TOTAL_CONTENT_LENGTH) {
                  // Exceeds model limit; stop adding more content
                  break;
                }

                combinedContent += contentToAdd;
                totalContentLength = newTotalLength;
                sourcesUsed.push(`<${item.link}|${item.title}>`);
                numSummaries++;
              }
            } catch (error) {
              console.error(`Failed to process ${item.link}:`, error.message);
              failedSources.push(`<${item.link}|${item.title}>`);
            }
          }

          if (!combinedContent) {
            const message = 'Could not fetch content from the top results to summarize.';
            if (isPublic) {
              await say(message);
            } else {
              await respond(message);
            }
            return;
          }

          // Inform the user if not all desired sources could be included
          let truncationNotice = '';
          if (numSummaries < MAX_SUMMARIES) {
            truncationNotice = `\n\n*Note:* Only ${numSummaries} sources could be included due to content length limitations.`;
          }

          // Directly summarize the combined content in one request
          try {
            const finalSummary = await summarizeTextContent(combinedContent);

            // Prepare statistics
            let stats = `*Search Summary Stats:*\n- Sources Used: ${sourcesUsed.length}\n- Failed Sources: ${failedSources.length}`;
            if (failedSources.length > 0) {
              stats += `\n- Failed Sources:\n${failedSources.join('\n')}`;
            }

            // Prepare the response
            let responseText = `*Summary for:* ${query}\n\n${finalSummary}${truncationNotice}\n\n${stats}\n\n*Sources Cited:*\n${sourcesUsed.join('\n')}`;

            // Send the response
            if (isPublic) {
              await say({ text: responseText, unfurl_links: false, unfurl_media: false });
            } else {
              await respond({ text: responseText, unfurl_links: false, unfurl_media: false });
            }
          } catch (error) {
            console.error('Error during summarization:', error.message);
            const message = 'An error occurred during summarization.';
            if (isPublic) {
              await say(message);
            } else {
              await respond(message);
            }
          }

        } else {
          // Regular search results
          let responseText = `Here are the top results for *${query}*:\n`;
          results.forEach((item, index) => {
            responseText += `\n${index + 1}. *${item.title}*\n${item.snippet}\n<${item.link}>\n`;
          });
          if (isPublic) {
            await say(responseText);
          } else {
            await respond(responseText);
          }
        }
      } else {
        const message = `No results found for *${query}*.`;
        if (isPublic) {
          await say(message);
        } else {
          await respond(message);
        }
      }
    } catch (error) {
      console.error('Error handling /briefops-search command:', error);
      const message = 'An error occurred while performing the search. Please try again later.';
      if (isPublic) {
        await say(message);
      } else {
        await respond(message);
      }
    }
  });
};