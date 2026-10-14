/**
 * Hermes API Client
 * Real-time price data from Pyth Network
 */

import {
  PriceFeed,
  PriceFeedSchema,
  PriceUpdateResponse,
  PriceUpdateResponseSchema,
  TwapResponse,
  TwapResponseSchema,
  PublisherStakeCapsResponse,
  PublisherStakeCapsResponseSchema,
  PriceFeedQuery,
  PriceUpdateQuery,
  TwapQuery,
  HistoricalQuery,
  isValidFeedId,
  normalizeFeedId,
} from '../types/pyth.js';

import {
  ApiError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  InvalidFeedIdError,
  ValidationError,
  wrapError,
} from '../types/errors.js';

import { getConfig, type ApiConfig } from './config.js';

/**
 * Hermes API client for real-time Pyth data
 */
export class HermesClient {
  private readonly config: ApiConfig;
  private readonly baseUrl: string;

  constructor(config?: Partial<ApiConfig>) {
    this.config = { ...getConfig(), ...config };
    this.baseUrl = this.config.hermesUrl;
  }

  /**
   * Make an HTTP request with error handling and retries
   */
  private async request<T>(
    path: string,
    params?: Record<string, string | string[] | boolean | number | undefined>,
    schema?: { parse: (data: unknown) => T }
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    // Add query parameters
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(`${key}[]`, v));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new RateLimitError(retryAfter ? Number(retryAfter) * 1000 : undefined);
          }

          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new ApiError(path, errorBody, response.status);
        }

        const data: unknown = await response.json();

        // Validate response if schema provided
        if (schema) {
          return schema.parse(data);
        }

        return data as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation or client errors
        if (error instanceof ApiError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        if (error instanceof RateLimitError) {
          throw error;
        }

        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError(path, this.config.timeout);
        }

        // Retry on network errors
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError ? wrapError(lastError) : new NetworkError(path);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate feed IDs
   */
  private validateFeedIds(feedIds: string[]): string[] {
    if (feedIds.length === 0) {
      throw new ValidationError('At least one feed ID is required');
    }

    if (feedIds.length > this.config.maxFeedsPerRequest) {
      throw new ValidationError(
        `Maximum ${this.config.maxFeedsPerRequest} feed IDs per request`
      );
    }

    return feedIds.map(id => {
      const normalized = normalizeFeedId(id);
      if (!isValidFeedId(normalized)) {
        throw new InvalidFeedIdError(id);
      }
      return normalized;
    });
  }

  /**
   * Get available price feeds
   */
  async getPriceFeeds(query?: PriceFeedQuery): Promise<PriceFeed[]> {
    const params: Record<string, string | undefined> = {};

    if (query?.query) {
      params['query'] = query.query;
    }

    if (query?.assetType) {
      params['asset_type'] = query.assetType;
    }

    const response = await this.request<unknown[]>('/v2/price_feeds', params);

    // Validate each feed
    return response.map(feed => PriceFeedSchema.parse(feed));
  }

  /**
   * Get latest price updates
   */
  async getLatestPrices(query: PriceUpdateQuery): Promise<PriceUpdateResponse> {
    const feedIds = this.validateFeedIds(query.feedIds);

    return this.request(
      '/v2/updates/price/latest',
      {
        ids: feedIds,
        encoding: query.encoding ?? 'hex',
        parsed: query.parsed ?? true,
        binary: query.binary ?? false,
      },
      PriceUpdateResponseSchema
    );
  }

  /**
   * Get price at specific timestamp
   */
  async getPriceAtTimestamp(query: HistoricalQuery): Promise<PriceUpdateResponse> {
    const feedIds = this.validateFeedIds(query.feedIds);

    if (query.timestamp <= 0) {
      throw new ValidationError('Timestamp must be a positive Unix timestamp');
    }

    return this.request(
      `/v2/updates/price/${query.timestamp}`,
      {
        ids: feedIds,
        encoding: query.encoding ?? 'hex',
        parsed: query.parsed ?? true,
      },
      PriceUpdateResponseSchema
    );
  }

  /**
   * Get time-weighted average price
   */
  async getTwap(query: TwapQuery): Promise<TwapResponse> {
    const feedIds = this.validateFeedIds(query.feedIds);

    const windowSeconds = query.windowSeconds ?? 60;
    if (windowSeconds < 1 || windowSeconds > 600) {
      throw new ValidationError('TWAP window must be between 1 and 600 seconds');
    }

    return this.request(
      '/v2/updates/twap/latest',
      {
        ids: feedIds,
        window_seconds: windowSeconds,
      },
      TwapResponseSchema
    );
  }

  /**
   * Get publisher stake caps
   */
  async getPublisherStakeCaps(): Promise<PublisherStakeCapsResponse> {
    return this.request(
      '/v2/updates/publisher_stake_caps/latest',
      undefined,
      PublisherStakeCapsResponseSchema
    );
  }

  /**
   * Stream price updates via SSE (async generator)
   */
  async *streamPrices(
    feedIds: string[],
    options?: { parsed?: boolean; allowUnordered?: boolean }
  ): AsyncIterable<PriceUpdateResponse> {
    const validatedIds = this.validateFeedIds(feedIds);

    const url = new URL('/v2/updates/price/stream', this.baseUrl);
    validatedIds.forEach(id => url.searchParams.append('ids[]', id));

    if (options?.parsed !== false) {
      url.searchParams.set('parsed', 'true');
    }

    if (options?.allowUnordered) {
      url.searchParams.set('allow_unordered', 'true');
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'text/event-stream' },
    });

    if (!response.ok) {
      throw new ApiError('/v2/updates/price/stream', 'Failed to connect to stream', response.status);
    }

    if (!response.body) {
      throw new ApiError('/v2/updates/price/stream', 'No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as unknown;
              yield PriceUpdateResponseSchema.parse(data);
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * Default client instance
 */
let defaultClient: HermesClient | null = null;

export function getHermesClient(): HermesClient {
  if (!defaultClient) {
    defaultClient = new HermesClient();
  }
  return defaultClient;
}
