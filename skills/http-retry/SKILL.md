# HTTP Retry Skill

Universal HTTP retry mechanism with exponential backoff, timeout control, and connection pooling.

## Capabilities

- **Exponential backoff retry**: Automatically retry failed requests with increasing delays
- **AbortController timeout**: Automatic request timeout control
- **Connection pool reuse**: Reuse HTTP agents for better performance
- **Handles**: TimeoutError, ECONNRESET, ECONNREFUSED, 429 TooManyRequests

## Usage

```javascript
const { fetchWithRetry } = require('./retry.js');

// Simple usage
const result = await fetchWithRetry('https://api.example.com/data');

// With options
const result = await fetchWithRetry(url, {
  retries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  timeout: 5000,
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| retries | number | 3 | Number of retry attempts |
| baseDelay | number | 1000 | Base delay in ms (exponential backoff multiplies this) |
| maxDelay | number | 10000 | Max delay between retries in ms |
| timeout | number | 30000 | Request timeout in ms |
| retryErrors | Array | [TimeoutError, ECONNRESET, ECONNREFUSED, 429] | Errors that trigger retry |

## Integration

Import and wrap your existing fetch calls:

```javascript
const { fetchWithRetry } = require('./retry.js');

// Replace fetch() with fetchWithRetry()
const data = await fetchWithRetry('https://api.example.com');
```