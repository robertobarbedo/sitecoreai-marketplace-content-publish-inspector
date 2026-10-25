/**
 * Rate limiter utility for controlling GraphQL queries and HTTP fetches.
 * Uses a token bucket algorithm to limit requests per second.
 */

export interface RateLimiterStats {
  queuedRequests: number;
  totalProcessed: number;
  totalWaitTime: number;
  averageWaitTime: number;
}

export class RateLimiter {
  private queue: Array<() => void> = [];
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefillTime: number;
  private totalProcessed: number = 0;
  private totalWaitTime: number = 0;
  
  /**
   * Creates a new rate limiter
   * @param requestsPerSecond Maximum number of requests allowed per second
   */
  constructor(requestsPerSecond: number = 30) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond / 1000; // tokens per millisecond
    this.lastRefillTime = Date.now();
  }

  /**
   * Refills tokens based on time elapsed
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Processes the queue of waiting requests
   */
  private processQueue(): void {
    this.refillTokens();
    
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const resolve = this.queue.shift();
      if (resolve) {
        resolve();
      }
    }
    
    if (this.queue.length > 0) {
      // Schedule next processing
      setTimeout(() => this.processQueue(), 50);
    }
  }

  /**
   * Acquires a token, waiting if necessary
   * @returns Promise that resolves when a token is available
   */
  async acquire(): Promise<void> {
    const startTime = Date.now();
    
    this.refillTokens();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.totalProcessed++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        const waitTime = Date.now() - startTime;
        this.totalWaitTime += waitTime;
        this.totalProcessed++;
        resolve();
      });
      
      if (this.queue.length === 1) {
        // Start processing if this is the first item
        setTimeout(() => this.processQueue(), 50);
      }
    });
  }

  /**
   * Wraps an async function with rate limiting
   * @param fn The async function to wrap
   * @returns The wrapped function
   */
  wrap<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      await this.acquire();
      return fn(...args) as Promise<ReturnType<T>>;
    };
  }

  /**
   * Gets current statistics about the rate limiter
   */
  getStats(): RateLimiterStats {
    return {
      queuedRequests: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalWaitTime: this.totalWaitTime,
      averageWaitTime: this.totalProcessed > 0 
        ? Math.round(this.totalWaitTime / this.totalProcessed) 
        : 0,
    };
  }

  /**
   * Resets statistics
   */
  resetStats(): void {
    this.totalProcessed = 0;
    this.totalWaitTime = 0;
  }
}

// Get rate limit from environment variable with fallback to 30
const getRateLimitFromEnv = (): number => {
  if (typeof window !== 'undefined') {
    // Client-side: use default
    return 30;
  }
  
  const envValue = process.env.RATE_LIMIT_PER_SECOND;
  if (!envValue) return 30;
  
  const parsed = parseInt(envValue, 10);
  return isNaN(parsed) || parsed <= 0 ? 30 : parsed;
};

// Global rate limiter instances
export const globalRateLimiter = new RateLimiter(getRateLimitFromEnv());

// Client-side rate limiter configuration
let clientRateLimiter: RateLimiter | null = null;

export const getClientRateLimiter = (rateLimit?: number): RateLimiter => {
  if (!clientRateLimiter) {
    clientRateLimiter = new RateLimiter(rateLimit ?? 30);
  }
  return clientRateLimiter;
};

export const configureClientRateLimit = (rateLimit: number): void => {
  clientRateLimiter = new RateLimiter(rateLimit);
};
