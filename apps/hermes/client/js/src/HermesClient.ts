import EventSource from "eventsource";
import { schemas } from "./zodSchemas";
import { z } from "zod";

// Accessing schema objects
export type AssetType = z.infer<typeof schemas.AssetType>;
export type BinaryPriceUpdate = z.infer<typeof schemas.BinaryPriceUpdate>;
export type EncodingType = z.infer<typeof schemas.EncodingType>;
export type PriceFeedMetadata = z.infer<typeof schemas.PriceFeedMetadata>;
export type PriceIdInput = z.infer<typeof schemas.PriceIdInput>;
export type PriceUpdate = z.infer<typeof schemas.PriceUpdate>;

const DEFAULT_TIMEOUT: DurationInMs = 5000;
const DEFAULT_HTTP_RETRIES = 3;

export type UnixTimestamp = number;
export type DurationInSeconds = number;
export type HexString = string;
export type DurationInMs = number;

export type HermesClientConfig = {
  /* Timeout of each request (for all of retries). Default: 5000ms */
  timeout?: DurationInMs;
  /**
   * Number of times a HTTP request will be retried before the API returns a failure. Default: 3.
   *
   * The connection uses exponential back-off for the delay between retries. However,
   * it will timeout regardless of the retries at the configured `timeout` time.
   */
  httpRetries?: number;
};

export class HermesClient {
  private baseURL: string;
  private timeout: DurationInMs;
  private httpRetries: number;

  /**
   * Constructs a new Connection.
   *
   * @param endpoint endpoint URL to the price service. Example: https://website/example/
   * @param config Optional HermesClientConfig for custom configurations.
   */
  constructor(endpoint: string, config?: HermesClientConfig) {
    this.baseURL = endpoint;
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.httpRetries = config?.httpRetries ?? DEFAULT_HTTP_RETRIES;
  }

  private async httpRequest<ResponseData>(
    url: string,
    schema: z.ZodSchema<ResponseData>,
    options?: RequestInit,
    retries = this.httpRetries,
    backoff = 100 + Math.floor(Math.random() * 100), // Adding randomness to the initial backoff to avoid "thundering herd" scenario where a lot of clients that get kicked off all at the same time (say some script or something) and fail to connect all retry at exactly the same time too
    externalAbortController?: AbortController
  ): Promise<ResponseData> {
    const controller = externalAbortController ?? new AbortController();
    const { signal } = controller;
    options = { ...options, signal }; // Merge any existing options with the signal

    // Set a timeout to abort the request if it takes too long
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, options);
      clearTimeout(timeout); // Clear the timeout if the request completes in time
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return schema.parse(data);
    } catch (error) {
      clearTimeout(timeout);
      if (
        retries > 0 &&
        !(error instanceof Error && error.name === "AbortError")
      ) {
        // Wait for a backoff period before retrying
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return this.httpRequest(url, schema, options, retries - 1, backoff * 2); // Exponential backoff
      }
      throw error;
    }
  }

  /**
   * Fetch the set of available price feeds.
   * This endpoint can be filtered by asset type and query string.
   * This will throw an error if there is a network problem or the price service returns a non-ok response.
   *
   * @param options Optional parameters:
   *        - query: String to filter the price feeds. If provided, the results will be filtered to all price feeds whose symbol contains the query string. Query string is case insensitive. Example: "bitcoin".
   *        - filter: String to filter the price feeds by asset type. Possible values are "crypto", "equity", "fx", "metal", "rates". Filter string is case insensitive.
   *
   * @returns Array of PriceFeedMetadata objects.
   */
  async getPriceFeeds(options?: {
    query?: string;
    filter?: string;
  }): Promise<PriceFeedMetadata[]> {
    const url = new URL("/v2/price_feeds", this.baseURL);
    if (options) {
      this.appendUrlSearchParams(url, options);
    }
    return await this.httpRequest(
      url.toString(),
      schemas.PriceFeedMetadata.array()
    );
  }

  /**
   * Fetch the latest price updates for a set of price feed IDs.
   * This endpoint can be customized by specifying the encoding type and whether the results should also return the parsed price update using the options object.
   * This will throw an error if there is a network problem or the price service returns a non-ok response.
   *
   * @param ids Array of hex-encoded price feed IDs for which updates are requested.
   * @param options Optional parameters:
   *        - encoding: Encoding type. If specified, return the price update in the encoding specified by the encoding parameter. Default is hex.
   *        - parsed: Boolean to specify if the parsed price update should be included in the response. Default is false.
   *
   * @returns PriceUpdate object containing the latest updates.
   */
  async getLatestPriceUpdates(
    ids: HexString[],
    options?: {
      encoding?: EncodingType;
      parsed?: boolean;
    }
  ): Promise<PriceUpdate> {
    const url = new URL(`${this.baseURL}/v2/updates/price/latest`);
    for (const id of ids) {
      url.searchParams.append("ids[]", id);
    }

    if (options) {
      this.appendUrlSearchParams(url, options);
    }

    return this.httpRequest(url.toString(), schemas.PriceUpdate);
  }

  /**
   * Fetch the price updates for a set of price feed IDs at a given timestamp.
   * This endpoint can be customized by specifying the encoding type and whether the results should also return the parsed price update.
   * This will throw an error if there is a network problem or the price service returns a non-ok response.
   *
   * @param publishTime Unix timestamp in seconds.
   * @param ids Array of hex-encoded price feed IDs for which updates are requested.
   * @param options Optional parameters:
   *        - encoding: Encoding type. If specified, return the price update in the encoding specified by the encoding parameter. Default is hex.
   *        - parsed: Boolean to specify if the parsed price update should be included in the response. Default is false.
   *
   * @returns PriceUpdate object containing the updates at the specified timestamp.
   */
  async getPriceUpdatesAtTimestamp(
    publishTime: UnixTimestamp,
    ids: HexString[],
    options?: {
      encoding?: EncodingType;
      parsed?: boolean;
    }
  ): Promise<PriceUpdate> {
    const url = new URL(`${this.baseURL}/v2/updates/price/${publishTime}`);
    for (const id of ids) {
      url.searchParams.append("ids[]", id);
    }

    if (options) {
      this.appendUrlSearchParams(url, options);
    }

    return this.httpRequest(url.toString(), schemas.PriceUpdate);
  }

  /**
   * Fetch streaming price updates for a set of price feed IDs.
   * This endpoint can be customized by specifying the encoding type, whether the results should include parsed updates,
   * and if unordered updates or only benchmark updates are allowed.
   * This will return an EventSource that can be used to listen to streaming updates.
   * If an invalid hex-encoded ID is passed, it will throw an error.
   *
   *
   * @param ids Array of hex-encoded price feed IDs for which streaming updates are requested.
   * @param encoding Optional encoding type. If specified, updates are returned in the specified encoding. Default is hex.
   * @param parsed Optional boolean to specify if the parsed price update should be included in the response. Default is false.
   * @param allow_unordered Optional boolean to specify if unordered updates are allowed to be included in the stream. Default is false.
   * @param benchmarks_only Optional boolean to specify if only benchmark prices that are the initial price updates at a given timestamp (i.e., prevPubTime != pubTime) should be returned. Default is false.
   * @returns An EventSource instance for receiving streaming updates.
   */
  async getPriceUpdatesStream(
    ids: HexString[],
    options?: {
      encoding?: EncodingType;
      parsed?: boolean;
      allow_unordered?: boolean;
      benchmarks_only?: boolean;
    }
  ): Promise<EventSource> {
    const url = new URL("/v2/updates/price/stream", this.baseURL);
    ids.forEach((id) => {
      url.searchParams.append("ids[]", id);
    });

    if (options) {
      this.appendUrlSearchParams(url, options);
    }

    return new EventSource(url.toString());
  }

  private appendUrlSearchParams(
    url: URL,
    params: Record<string, string | boolean>
  ) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }
}
