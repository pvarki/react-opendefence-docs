/**
 * Rate-Limited Fetch Utility
 *
 * Handles rate limiting with both local rate limiting (to prevent hitting API
 * limits) and server-side rate limit handling via Retry-After and RateLimit-*
 * headers. Ported essentially verbatim from the old wiki pipeline — the
 * Outline cloud instance enforces ~100 req/min and intermittently returns
 * 429/5xx mid-sync, so the sliding window + retry behavior here is load-bearing.
 *
 * Features:
 * - Configurable requests per window (default 100/min, matching Outline)
 * - Automatic retry on 429 responses
 * - Respects Retry-After and RateLimit-* headers
 * - Exponential backoff on transient 5xx errors
 */

// Types

export interface RateLimitConfig {
  /** Maximum requests per window (default: 100) */
  maxRequestsPerWindow: number;
  /** Rate limit window in milliseconds (default: 60000 = 1 minute) */
  windowMs: number;
  /** Maximum number of retries on 429/5xx responses (default: 60, effectively unlimited) */
  maxRetries: number;
  /** Buffer time in ms to add when waiting (default: 100) */
  bufferMs: number;
  /** Suppress console output for rate limit waits (default: false) */
  quiet: boolean;
  /** Initial backoff in ms for exponential backoff on errors (default: 2000) */
  initialBackoffMs: number;
  /** Maximum backoff in ms (default: 120000 = 2 minutes) */
  maxBackoffMs: number;
}

interface RateLimitState {
  /** Timestamps of recent requests within the current window */
  requestTimestamps: number[];
  /** Server-reported remaining requests */
  serverRemaining: number | null;
  /** Server-reported reset time */
  serverResetTime: Date | null;
  /** Server-reported limit */
  serverLimit: number | null;
}

// Default Configuration

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerWindow: 100,
  windowMs: 60_000, // 1 minute
  maxRetries: 60, // effectively unlimited – keep retrying until success
  bufferMs: 100,
  quiet: false,
  initialBackoffMs: 2_000,
  maxBackoffMs: 120_000, // 2 minutes cap for any single wait
};

// Rate Limiter Class

/**
 * A rate-limited fetch wrapper that respects both local rate limits
 * and server-side rate limit headers.
 */
export class RateLimitedFetcher {
  private readonly config: RateLimitConfig;
  private state: RateLimitState;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): RateLimitState {
    return {
      requestTimestamps: [],
      serverRemaining: null,
      serverResetTime: null,
      serverLimit: null,
    };
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse rate limit headers from response
   */
  private parseRateLimitHeaders(response: Response): void {
    const remaining = response.headers.get("RateLimit-Remaining");
    const reset = response.headers.get("RateLimit-Reset");
    const limit = response.headers.get("RateLimit-Limit");

    if (remaining !== null) {
      this.state.serverRemaining = parseInt(remaining, 10);
    }

    if (reset !== null) {
      const resetValue = parseInt(reset, 10);
      if (!isNaN(resetValue)) {
        // If it's a Unix timestamp (after year 2000)
        if (resetValue > 946684800) {
          this.state.serverResetTime = new Date(resetValue * 1000);
        } else {
          // Seconds from now
          this.state.serverResetTime = new Date(Date.now() + resetValue * 1000);
        }
      } else {
        // Try parsing as ISO date string
        const parsedDate = new Date(reset);
        if (!isNaN(parsedDate.getTime())) {
          this.state.serverResetTime = parsedDate;
        }
      }
    }

    if (limit !== null) {
      this.state.serverLimit = parseInt(limit, 10);
    }
  }

  /**
   * Calculate wait time based on server rate limit headers
   */
  private getServerWaitTime(): number {
    if (this.state.serverRemaining !== null && this.state.serverRemaining > 0) {
      return 0;
    }

    if (this.state.serverRemaining === 0 && this.state.serverResetTime) {
      const waitTime = this.state.serverResetTime.getTime() - Date.now();
      if (waitTime > 0) {
        return waitTime + this.config.bufferMs;
      }
    }

    return 0;
  }

  /**
   * Wait if necessary to stay within local rate limit
   */
  private async waitForLocalRateLimit(): Promise<void> {
    const now = Date.now();

    // Remove timestamps older than the window
    this.state.requestTimestamps = this.state.requestTimestamps.filter(
      (ts) => ts >= now - this.config.windowMs,
    );

    // If we've hit the local limit, wait until the oldest request expires
    if (
      this.state.requestTimestamps.length >= this.config.maxRequestsPerWindow
    ) {
      const oldestTimestamp = this.state.requestTimestamps[0];
      const waitTime =
        oldestTimestamp + this.config.windowMs - now + this.config.bufferMs;
      if (!this.config.quiet) {
        console.log(
          `  Local rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`,
        );
      }
      await this.sleep(waitTime);
      return this.waitForLocalRateLimit();
    }

    this.state.requestTimestamps.push(now);
  }

  /**
   * Wait based on server rate limit headers if necessary
   */
  private async waitForServerRateLimit(): Promise<void> {
    const serverWaitTime = this.getServerWaitTime();
    if (serverWaitTime > 0) {
      if (!this.config.quiet) {
        console.log(
          `  Server rate limit. Waiting ${Math.ceil(serverWaitTime / 1000)}s...`,
        );
      }
      await this.sleep(serverWaitTime);
    }
  }

  /**
   * Parse Retry-After header value
   */
  private parseRetryAfter(retryAfter: string): number {
    const retrySeconds = parseInt(retryAfter, 10);
    if (!isNaN(retrySeconds)) {
      return retrySeconds * 1000;
    }

    // Try parsing as HTTP date
    const retryDate = new Date(retryAfter);
    if (!isNaN(retryDate.getTime())) {
      return Math.max(0, retryDate.getTime() - Date.now());
    }

    return 1000; // Default fallback
  }

  /**
   * Perform a rate-limited fetch request
   */
  async fetch(
    url: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<Response> {
    await this.waitForLocalRateLimit();
    await this.waitForServerRateLimit();

    const response = await fetch(url, options);
    this.parseRateLimitHeaders(response);

    if (response.status === 429) {
      if (retryCount >= this.config.maxRetries) {
        throw new Error(
          `Rate limit exceeded after ${this.config.maxRetries} retries`,
        );
      }

      const retryAfter = response.headers.get("Retry-After");
      let waitMs: number;

      if (retryAfter !== null) {
        waitMs = this.parseRetryAfter(retryAfter);
      } else {
        const serverWaitTime = this.getServerWaitTime();
        waitMs = serverWaitTime > 0 ? serverWaitTime : 1000;
      }

      if (!this.config.quiet) {
        console.log(
          `  Rate limited (429). Waiting ${Math.ceil(waitMs / 1000)}s before retry ${retryCount + 1}/${this.config.maxRetries}...`,
        );
      }
      await this.sleep(waitMs);

      return this.fetch(url, options, retryCount + 1);
    }

    // Retry on transient server errors (5xx) with exponential backoff.
    // We NEVER give up permanently – if maxRetries is exhausted we throw so
    // the outer document-level retry loop (MAX_DOC_RETRY_PASSES) can try the
    // full request again from scratch after all other pending docs are done.
    if (response.status >= 500) {
      if (retryCount >= this.config.maxRetries) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Server error ${response.status} after ${this.config.maxRetries} retries – will retry later. ${errorText.slice(0, 120)}`,
        );
      }

      // Exponential backoff: initialBackoffMs * 2^retryCount, capped at maxBackoffMs
      // e.g. 2s, 4s, 8s, 16s, 32s, 60s, 60s, … for a 503
      const backoffMs = Math.min(
        this.config.initialBackoffMs * Math.pow(2, retryCount),
        this.config.maxBackoffMs,
      );

      if (!this.config.quiet) {
        console.log(
          `  Server error (${response.status}). Waiting ${Math.ceil(backoffMs / 1000)}s before retry ${retryCount + 1}/${this.config.maxRetries}...`,
        );
      }
      await this.sleep(backoffMs);

      return this.fetch(url, options, retryCount + 1);
    }

    return response;
  }

  /**
   * Get current rate limit state (for debugging/monitoring)
   */
  getState(): Readonly<RateLimitState> {
    return { ...this.state };
  }

  /**
   * Reset the rate limiter state
   */
  reset(): void {
    this.state = this.createInitialState();
  }
}

// Singleton Instance

let defaultFetcher: RateLimitedFetcher | null = null;

/**
 * Get or create the default rate-limited fetcher.
 * Quiet mode is enabled by default to avoid corrupting progress bars.
 */
function getDefaultFetcher(): RateLimitedFetcher {
  if (!defaultFetcher) {
    defaultFetcher = new RateLimitedFetcher({ quiet: true });
  }
  return defaultFetcher;
}

/**
 * Rate-limited fetch using the default singleton instance.
 * Handles both local rate limiting and server Retry-After headers.
 */
export async function rateLimitedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return getDefaultFetcher().fetch(url, options);
}

/**
 * Create a new rate-limited fetcher with custom configuration
 */
export function createRateLimitedFetcher(
  config: Partial<RateLimitConfig> = {},
): RateLimitedFetcher {
  return new RateLimitedFetcher(config);
}

/**
 * Reset the default fetcher state
 */
export function resetDefaultFetcher(): void {
  defaultFetcher?.reset();
}

/**
 * Configure the default fetcher
 */
export function configureDefaultFetcher(
  config: Partial<RateLimitConfig>,
): void {
  defaultFetcher = new RateLimitedFetcher(config);
}
