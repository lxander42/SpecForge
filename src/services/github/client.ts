import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { getConfig } from '../../lib/config.js';
import { logger } from '../telemetry/logger.js';
import { SpecForgeError, GitHubError } from '../../lib/errors.js';

export interface GitHubClientOptions {
  auth?: string;
  baseUrl?: string;
  userAgent?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export class GitHubClient {
  private rest: Octokit;
  private graphql: typeof graphql;
  private retryAttempts: number;
  private retryDelayMs: number;
  private maxRetryDelayMs: number;

  constructor(options: GitHubClientOptions = {}) {
    const config = getConfig();
    const auth = options.auth || config.github?.token || process.env.GITHUB_TOKEN;
    if (!auth) {
      throw new SpecForgeError('GitHub token is required. Set GITHUB_TOKEN environment variable or configure via CLI.');
    }

    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.maxRetryDelayMs = options.maxRetryDelayMs || 30000;

    this.rest = new Octokit({
      auth,
      baseUrl: options.baseUrl,
      userAgent: options.userAgent || 'SpecForge/1.0.0',
      retry: {
        doNotRetry: ['400', '401', '403', '404', '422'],
      },
      throttle: {
        onRateLimit: (retryAfter, options) => {
          logger.warn(`Rate limit exceeded. Retrying after ${retryAfter} seconds.`, {
            method: options.method,
            url: options.url,
            retryAfter,
          });
          return true;
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          logger.warn(`Secondary rate limit exceeded. Retrying after ${retryAfter} seconds.`, {
            method: options.method,
            url: options.url,
            retryAfter,
          });
          return true;
        },
      },
    });

    this.graphql = graphql.defaults({
      headers: {
        authorization: `token ${auth}`,
        'user-agent': options.userAgent || 'SpecForge/1.0.0',
      },
      baseUrl: options.baseUrl ? `${options.baseUrl}/graphql` : undefined,
    });
  }

  /**
   * Execute a REST API request with exponential backoff retry logic
   */
  async executeRest<T>(operation: () => Promise<T>): Promise<T> {
    return this.executeWithRetry(operation, 'REST');
  }

  /**
   * Execute a GraphQL query with exponential backoff retry logic
   */
  async executeGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.executeWithRetry(
      () => this.graphql(query, variables),
      'GraphQL'
    );
  }

  /**
   * Get current rate limit information
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    try {
      const response = await this.rest.rateLimit.get();
      const { limit, remaining, reset, used } = response.data.rate;
      
      return {
        limit,
        remaining,
        reset: new Date(reset * 1000),
        used,
      };
    } catch (error) {
      throw new GitHubError('Failed to get rate limit information', undefined, { cause: error });
    }
  }

  /**
   * Check if we have sufficient rate limit budget for an operation
   */
  async checkRateLimit(requiredCalls: number = 1): Promise<boolean> {
    const rateLimitInfo = await this.getRateLimitInfo();
    return rateLimitInfo.remaining >= requiredCalls;
  }

  /**
   * Wait for rate limit to reset if needed
   */
  async waitForRateLimit(): Promise<void> {
    const rateLimitInfo = await this.getRateLimitInfo();
    if (rateLimitInfo.remaining <= 0) {
      const waitTime = rateLimitInfo.reset.getTime() - Date.now();
      if (waitTime > 0) {
        logger.info(`Waiting ${Math.ceil(waitTime / 1000)}s for rate limit reset`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Execute operation with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string
  ): Promise<T> {
    let lastError: unknown;
    let delay = this.retryDelayMs;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug(`Retrying ${operationType} operation, attempt ${attempt + 1}`);
          await this.sleep(delay);
          delay = Math.min(delay * 2 + this.jitter(delay * 0.1), this.maxRetryDelayMs);
        }

        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.status && error.status >= 400 && error.status < 500) {
          throw new GitHubError(
            `${operationType} operation failed with client error: ${error.message}`,
            error.status,
            { 
              cause: error,
              operation: operationType,
            }
          );
        }

        // Don't retry on the last attempt
        if (attempt === this.retryAttempts) {
          break;
        }

        logger.warn(`${operationType} operation failed, retrying...`, {
          attempt: attempt + 1,
          error: error.message,
          status: error.status,
          nextRetryIn: delay,
        });
      }
    }

    throw new GitHubError(
      `${operationType} operation failed after ${this.retryAttempts + 1} attempts`,
      undefined,
      { 
        cause: lastError,
        operation: operationType,
        attempts: this.retryAttempts + 1,
      }
    );
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add jitter to delay to avoid thundering herd
   */
  private jitter(maxJitter: number): number {
    return Math.random() * maxJitter;
  }

  /**
   * Get the underlying Octokit REST client
   */
  get octokit(): Octokit {
    return this.rest;
  }

  /**
   * Get the underlying GraphQL client
   */
  get graphqlClient(): typeof graphql {
    return this.graphql;
  }
}

// Singleton instance
let clientInstance: GitHubClient | null = null;

/**
 * Get or create the GitHub client singleton
 */
export function getGitHubClient(options?: GitHubClientOptions): GitHubClient {
  if (!clientInstance || options) {
    clientInstance = new GitHubClient(options);
  }
  return clientInstance;
}

/**
 * Reset the client singleton (useful for testing)
 */
export function resetGitHubClient(): void {
  clientInstance = null;
}
