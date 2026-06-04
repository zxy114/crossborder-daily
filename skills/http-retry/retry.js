/**
 * HTTP Retry Module
 * 
 * Universal HTTP retry mechanism with exponential backoff, timeout control,
 * and connection pool reuse. Handles transient network failures, rate limits,
 * and connection resets automatically.
 * 
 * Based on EvoMap Capsule: sha256:6c8b2bef4652d5113cc802b6995a8e9f5da8b5b1ffe3d6bc639e2ca8ce27edec
 */

const http = require('http');
const https = require('https');

// Global connection pool (reuses agents for better performance)
const httpAgent = new http.Agent({ 
  keepAlive: true, 
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000
});

const httpsAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000
});

// Default errors that trigger retry
const DEFAULT_RETRY_ERRORS = [
  'TimeoutError',
  'ECONNRESET', 
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  '429'
];

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error should trigger a retry
 */
function isRetryableError(error, retryErrors) {
  const errorStr = String(error);
  return retryErrors.some(e => 
    errorStr.includes(e) || error.message?.includes(e)
  );
}

/**
 * Fetch with retry and exponential backoff
 * 
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} options.retries - Number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Max delay in ms (default: 10000)
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @param {Array} options.retryErrors - Errors that trigger retry
 * @param {object} options.fetchOptions - Additional fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any, text: string}>}
 */
async function fetchWithRetry(url, options = {}) {
  const {
    retries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    timeout = 30000,
    retryErrors = DEFAULT_RETRY_ERRORS,
    fetchOptions = {}
  } = options;

  const isHttps = url.startsWith('https://');
  const agent = isHttps ? httpsAgent : httpAgent;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        agent: agent
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      
      // Check for rate limit (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
        console.log(`[HTTP Retry] Rate limited (429), waiting ${delay}ms before retry...`);
        await sleep(Math.min(delay, maxDelay));
        continue;
      }

      // Try to parse JSON, fall back to text
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        text
      };

    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt < retries && isRetryableError(error, retryErrors)) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`[HTTP Retry] Error: ${error.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
        await sleep(delay);
      } else {
        // No more retries or non-retryable error
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Create a retryable fetch function with custom defaults
 */
function createRetryFetch(defaults = {}) {
  return (url, options = {}) => fetchWithRetry(url, { ...defaults, ...options });
}

module.exports = {
  fetchWithRetry,
  createRetryFetch,
  httpAgent,
  httpsAgent,
  DEFAULT_RETRY_ERRORS
};