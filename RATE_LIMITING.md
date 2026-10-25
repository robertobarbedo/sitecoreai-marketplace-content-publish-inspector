# Rate Limiting Documentation

## Overview

This application implements comprehensive rate limiting for all GraphQL queries and HTTP fetches to prevent API throttling and ensure consistent performance. The rate limiter uses a token bucket algorithm to control request throughput.

## Configuration

### Environment Variable

Rate limiting is configured via the `.env.local` file:

```env
# Rate limit for GraphQL queries and HTTP fetches (per second)
# Default: 30 requests per second
RATE_LIMIT_PER_SECOND=30
```

**Default Value:** 30 requests per second

### Changing the Rate Limit

1. Copy `.env.example` to `.env.local` if it doesn't exist:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and set your desired rate limit:
   ```env
   RATE_LIMIT_PER_SECOND=50
   ```

3. Restart the development server or rebuild the application for changes to take effect.

## How It Works

### Token Bucket Algorithm

The rate limiter uses a token bucket algorithm:
- **Tokens** represent available request slots
- **Bucket Capacity** equals the rate limit per second
- **Refill Rate** continuously adds tokens over time
- **Request Handling** consumes one token per request

When tokens are unavailable, requests are queued and processed as tokens become available.

### Implementation Details

#### Client-Side Rate Limiting

All client-side GraphQL queries and HTTP requests are throttled through the `getClientRateLimiter()` function:

```typescript
import { getClientRateLimiter } from '../utils/rateLimit';

// Before making a GraphQL query or HTTP fetch
const rateLimiter = getClientRateLimiter();
await rateLimiter.acquire();

// Now make your request
const response = await client.mutate(...);
```

#### Server-Side Rate Limiting

The `/api/fetch-page` route uses server-side rate limiting for external HTTP fetches:

```typescript
import { globalRateLimiter } from '../../../utils/rateLimit';

// Apply rate limiting on server side
await globalRateLimiter.acquire();

// Now make the fetch
const response = await fetch(url, options);
```

### Affected Components

Rate limiting is applied to all requests in the following components:

1. **ContentTree** (`src/components/ContentTree.tsx`)
   - Fetching authoring content items
   - Fetching item children
   - Fetching item details
   - Fetching languages

2. **DeliveryContentTree** (`src/components/DeliveryContentTree.tsx`)
   - Fetching preview/live delivery items
   - Building delivery trees

3. **WebsiteTree** (`src/components/WebsiteTree.tsx`)
   - Fetching site information
   - HTTP fetches to website pages

4. **DeliveryItemDetailModal** (`src/components/DeliveryItemDetailModal.tsx`)
   - Fetching item details
   - Fetching site info for layout
   - Fetching layout data

5. **API Routes** (`src/app/api/fetch-page/route.ts`)
   - External website fetches for comparing timestamps

## User Interface Indicators

Each tree view displays rate limit information in the header:

### Authoring API
```
Rate limit: 30/sec • Queries throttled and queued
```

### Preview API / Live API
```
Rate limit: 30/sec • Queries throttled and queued
```

### Website
```
Rate limit: 30/sec • HTTP fetches throttled and queued
```

## Monitoring & Statistics

The rate limiter tracks statistics including:
- **Queued Requests**: Current number of requests waiting
- **Total Processed**: Total requests processed since initialization
- **Total Wait Time**: Cumulative wait time for all queued requests
- **Average Wait Time**: Average time requests spend waiting in queue

Access statistics programmatically:

```typescript
const rateLimiter = getClientRateLimiter();
const stats = rateLimiter.getStats();
console.log(`Queued: ${stats.queuedRequests}, Avg Wait: ${stats.averageWaitTime}ms`);
```

## Best Practices

### Recommended Settings

- **Development**: 30-50 requests/second
- **Production with High Load**: 20-30 requests/second
- **Production with Low Load**: 50-100 requests/second

### Performance Considerations

1. **Lower Limits**: More stable, less risk of API throttling
2. **Higher Limits**: Faster initial load, higher risk of hitting API limits
3. **Queue Management**: Requests are automatically queued when limit is reached

### Troubleshooting

#### Slow Loading

If the application feels slow:
1. Check if you're hitting the rate limit (see UI indicators)
2. Consider increasing `RATE_LIMIT_PER_SECOND`
3. Monitor network requests in browser DevTools

#### API Throttling Errors

If you see 429 (Too Many Requests) errors:
1. Decrease `RATE_LIMIT_PER_SECOND`
2. Add buffer time between requests
3. Contact API provider about rate limits

## Technical Architecture

### Rate Limiter Class

Location: `src/utils/rateLimit.ts`

Key methods:
- `acquire()`: Waits for and consumes a token
- `wrap(fn)`: Wraps an async function with rate limiting
- `getStats()`: Returns current statistics
- `resetStats()`: Resets statistics counters

### Configuration Hook

Location: `src/utils/hooks/useAppConfig.ts`

Fetches configuration from the `/api/config` endpoint which reads `RATE_LIMIT_PER_SECOND` from environment variables.

### Config API Endpoint

Location: `src/app/api/config/route.ts`

Returns the rate limit configuration to the client.

## Example Usage

### Adding Rate Limiting to New Code

```typescript
import { getClientRateLimiter } from '../utils/rateLimit';

async function fetchData() {
  // Acquire a token (waits if necessary)
  const rateLimiter = getClientRateLimiter();
  await rateLimiter.acquire();
  
  // Make your request
  const response = await fetch('https://api.example.com/data');
  return response.json();
}
```

### Wrapping Multiple Requests

```typescript
import { getClientRateLimiter } from '../utils/rateLimit';

const rateLimiter = getClientRateLimiter();

// Wrap function with rate limiting
const rateLimitedFetch = rateLimiter.wrap(
  async (url: string) => fetch(url).then(r => r.json())
);

// Use the wrapped function
const data1 = await rateLimitedFetch('https://api.example.com/1');
const data2 = await rateLimitedFetch('https://api.example.com/2');
```

## Version History

- **v1.0.0**: Initial implementation with configurable rate limiting
  - Token bucket algorithm
  - Client and server-side rate limiting
  - UI indicators for all tree views
  - Environment variable configuration
