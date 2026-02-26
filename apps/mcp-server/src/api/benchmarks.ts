/**
 * Benchmarks API Client
 * Historical price data from Pyth Network
 */

import {
  PriceFeed,
  PriceFeedSchema,
  PriceUpdateResponse,
  PriceUpdateResponseSchema,
  HistoricalQuery,
  HistoricalRangeQuery,
  OHLCV,
  OHLCVSchema,
  isValidFeedId,
  normalizeFeedId,
} from '../types/pyth.js';

import {
  ApiError,
  TimeoutError,
  RateLimitError,
  InvalidFeedIdError,
  ValidationError,
  wrapError,
} from '../types/errors.js';

import { getConfig, type ApiConfig } from './config.js';

/**
 * TradingView resolution values
 */
export type TradingViewResolution = '1' | '5' | '15' | '30' | '60' | '240' | 'D' | 'W' | 'M';

/**
 * Benchmarks API client for historical Pyth data
 */
export class BenchmarksClient {
  private readonly config: ApiConfig;
  private readonly baseUrl: string;

  constructor(config?: Partial<ApiConfig>) {
    this.config = { ...getConfig(), ...config };
    this.baseUrl = this.config.benchmarksUrl;
  }

  /**
   * Make an HTTP request with error handling
   */
  private async request<T>(
    path: string,
    params?: Record<string, string | string[] | boolean | number | undefined>,
    schema?: { parse: (data: unknown) => T }
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new RateLimitError();
        }

        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new ApiError(path, errorBody, response.status);
      }

      const data: unknown = await response.json();

      if (schema) {
        return schema.parse(data);
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError || error instanceof RateLimitError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(path, this.config.timeout);
      }

      throw wrapError(error);
    }
  }

  /**
   * Validate feed IDs
   */
  private validateFeedIds(feedIds: string[]): string[] {
    if (feedIds.length === 0) {
      throw new ValidationError('At least one feed ID is required');
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
   * List available price feeds
   */
  async getPriceFeeds(query?: string, assetType?: string): Promise<PriceFeed[]> {
    const params: Record<string, string | undefined> = {};

    if (query) {
      params['query'] = query;
    }

    if (assetType) {
      params['asset_type'] = assetType;
    }

    const response = await this.request<unknown[]>('/v1/price_feeds/', params);
    return response.map(feed => PriceFeedSchema.parse(feed));
  }

  /**
   * Get price feed details by ID
   */
  async getPriceFeed(feedId: string): Promise<PriceFeed> {
    const [normalized] = this.validateFeedIds([feedId]);
    return this.request(`/v1/price_feeds/${normalized}`, undefined, PriceFeedSchema);
  }

  /**
   * Get historical price at specific timestamp
   */
  async getHistoricalPrice(query: HistoricalQuery): Promise<PriceUpdateResponse> {
    const feedIds = this.validateFeedIds(query.feedIds);

    if (query.timestamp <= 0) {
      throw new ValidationError('Timestamp must be a positive Unix timestamp');
    }

    return this.request(
      `/v1/updates/price/${query.timestamp}`,
      {
        ids: feedIds,
        encoding: query.encoding ?? 'hex',
        parsed: query.parsed ?? true,
      },
      PriceUpdateResponseSchema
    );
  }

  /**
   * Get historical prices over a range
   */
  async getHistoricalPrices(query: HistoricalRangeQuery): Promise<PriceUpdateResponse[]> {
    const feedIds = this.validateFeedIds(query.feedIds);

    if (query.timestamp <= 0) {
      throw new ValidationError('Timestamp must be a positive Unix timestamp');
    }

    if (query.interval <= 0) {
      throw new ValidationError('Interval must be positive');
    }

    const response = await this.request<unknown[]>(
      `/v1/updates/price/${query.timestamp}/${query.interval}`,
      {
        ids: feedIds,
        encoding: query.encoding ?? 'hex',
        parsed: query.parsed ?? true,
        unique: query.unique ?? false,
      }
    );

    return response.map(item => PriceUpdateResponseSchema.parse(item));
  }

  /**
   * Get OHLCV data (TradingView format)
   */
  async getOHLCV(
    symbol: string,
    resolution: TradingViewResolution,
    from: number,
    to: number
  ): Promise<OHLCV> {
    if (!symbol) {
      throw new ValidationError('Symbol is required');
    }

    if (from >= to) {
      throw new ValidationError('From timestamp must be before to timestamp');
    }

    return this.request(
      '/v1/shims/tradingview/history',
      {
        symbol,
        resolution,
        from,
        to,
      },
      OHLCVSchema
    );
  }

  /**
   * Search for symbols (TradingView)
   */
  async searchSymbols(
    query: string,
    options?: { type?: string; exchange?: string; limit?: number }
  ): Promise<Array<{ symbol: string; full_name: string; description: string; type: string }>> {
    return this.request('/v1/shims/tradingview/search', {
      query,
      type: options?.type,
      exchange: options?.exchange,
      limit: options?.limit,
    });
  }

  /**
   * Get TradingView symbol info
   */
  async getSymbolInfo(
    symbol: string
  ): Promise<{ name: string; ticker: string; description: string; type: string }> {
    return this.request('/v1/shims/tradingview/symbols', { symbol });
  }
}

/**
 * Default client instance
 */
let defaultClient: BenchmarksClient | null = null;

export function getBenchmarksClient(): BenchmarksClient {
  if (!defaultClient) {
    defaultClient = new BenchmarksClient();
  }
  return defaultClient;
}
