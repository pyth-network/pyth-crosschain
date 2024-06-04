import { EncodingType, PriceFeedMetadata, PriceUpdate } from "./types";
import { Logger } from "ts-log";
import EventSource from "eventsource";

export type UnixTimestamp = number;
export type DurationInSeconds = number;
export type HexString = string;
export type DurationInMs = number;

export type HermesConnectionConfig = {
  /* Timeout of each request (for all of retries). Default: 5000ms */
  timeout?: DurationInMs;
  /**
   * Number of times a HTTP request will be retried before the API returns a failure. Default: 3.
   *
   * The connection uses exponential back-off for the delay between retries. However,
   * it will timeout regardless of the retries at the configured `timeout` time.
   */
  httpRetries?: number;
  /* Optional logger (e.g: console or any logging library) to log internal events */
  logger?: Logger;
};

export class HermesConnection {
  private baseURL: string;
  private timeout: DurationInMs;
  private httpRetries: number;
  private logger: Logger;

  /**
   * Custom handler for web socket errors (connection and message parsing).
   *
   * Default handler only logs the errors.
   */
  onWsError: (error: Error) => void;

  /**
   * Constructs a new Connection.
   *
   * @param endpoint endpoint URL to the price service. Example: https://website/example/
   * @param config Optional HermesConnectionConfig for custom configurations.
   */
  constructor(endpoint: string, config?: HermesConnectionConfig) {
    this.baseURL = endpoint;
    this.timeout = config?.timeout || 5000;
    this.httpRetries = config?.httpRetries || 3;

    // Default logger is console for only warnings and errors.
    this.logger = config?.logger || {
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: console.warn,
      error: console.error,
    };

    this.onWsError = (error: Error) => {
      this.logger.error(error);

      // Exit the process if it is running in node.
      if (
        typeof process !== "undefined" &&
        typeof process.exit === "function"
      ) {
        this.logger.error("Halting the process due to the websocket error");
        process.exit(1);
      } else {
        this.logger.error(
          "Cannot halt process. Please handle the websocket error."
        );
      }
    };
  }

  private async httpRequest(
    url: string,
    options?: RequestInit,
    retries = this.httpRetries,
    backoff = 300
  ): Promise<any> {
    const controller = new AbortController();
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
      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (
        retries > 0 &&
        !(error instanceof Error && error.name === "AbortError")
      ) {
        // Wait for a backoff period before retrying
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return this.httpRequest(url, options, retries - 1, backoff * 2); // Exponential backoff
      }
      if (error instanceof Error) {
        this.logger.error("HTTP Request Failed", error);
        throw error;
      } else {
        // If the caught error is not an instance of Error, handle it as an unknown error.
        this.logger.error("An unknown error occurred", error);
        throw new Error("An unknown error occurred");
      }
    }
  }

  /**
   * Fetch the set of available price feeds.
   * This endpoint can be filtered by asset type and query string.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response.
   *
   * @param query Optional query string to filter the price feeds. If provided, the results will be filtered to all price feeds whose symbol contains the query string. Query string is case insensitive. Example : bitcoin
   * @param filter Optional filter string to filter the price feeds. If provided, the results will be filtered by asset type. Possible values are crypto, equity, fx, metal, rates. Filter string is case insensitive. Available values : crypto, fx, equity, metals, rates
   * @returns Array of hex-encoded price ids.
   */
  async getPriceFeeds(
    query?: string,
    filter?: string
  ): Promise<PriceFeedMetadata[]> {
    const url = new URL(`${this.baseURL}/v2/price_feeds`);
    if (query) {
      url.searchParams.append("query", query);
    }
    if (filter) {
      url.searchParams.append("filter", filter);
    }
    return await this.httpRequest(url.toString());
  }

  /**
   * Fetch the latest price updates for a set of price feed IDs.
   * This endpoint can be customized by specifying the encoding type and whether the results should also return the parsed price update.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response.
   *
   * @param ids Array of hex-encoded price feed IDs for which updates are requested.
   * @param encoding Optional encoding type. If true, return the price update in the encoding specified by the encoding parameter. Default is hex.
   * @param parsed Optional boolean to specify if the parsed price update should be included in the response. Default is false.
   * @returns Array of PriceFeed objects containing the latest updates.
   */
  async getLatestPriceUpdates(
    ids: HexString[],
    encoding?: EncodingType,
    parsed?: boolean
  ): Promise<PriceUpdate[]> {
    const url = new URL(`${this.baseURL}/v2/updates/price/latest`);
    // Append parameters to the URL search parameters
    ids.forEach((id) => url.searchParams.append("ids[]", id));
    if (encoding) {
      url.searchParams.append("encoding", encoding);
    }
    if (parsed !== undefined) {
      url.searchParams.append("parsed", String(parsed));
    }
    return await this.httpRequest(url.toString());
  }

  /**
   * Fetch the price updates for a set of price feed IDs at a given timestamp.
   * This endpoint can be customized by specifying the encoding type and whether the results should also return the parsed price update.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response.
   *
   * @param publishTime Unix timestamp in seconds.
   * @param ids Array of hex-encoded price feed IDs for which updates are requested.
   * @param encoding Optional encoding type. If true, return the price update in the encoding specified by the encoding parameter. Default is hex.
   * @param parsed Optional boolean to specify if the parsed price update should be included in the response. Default is false.
   * @returns Array of PriceFeed objects containing the latest updates.
   */
  async getTimestampPriceUpdates(
    publishTime: UnixTimestamp,
    ids: HexString[],
    encoding?: EncodingType,
    parsed?: boolean
  ): Promise<PriceUpdate[]> {
    const url = new URL(`${this.baseURL}/v2/updates/price/${publishTime}`);
    ids.forEach((id) => url.searchParams.append("ids[]", id));
    if (encoding) {
      url.searchParams.append("encoding", encoding);
    }
    if (parsed !== undefined) {
      url.searchParams.append("parsed", String(parsed));
    }
    return await this.httpRequest(url.toString());
  }

  /**
   * Fetch streaming price updates for a set of price feed IDs.
   * This endpoint can be customized by specifying the encoding type, whether the results should include parsed updates,
   * and if unordered updates or only benchmark updates are allowed.
   * This will return an EventSource that can be used to listen to streaming updates.
   *
   * @param ids Array of hex-encoded price feed IDs for which streaming updates are requested.
   * @param encoding Optional encoding type. If specified, updates are returned in the specified encoding. Default is hex.
   * @param parsed Optional boolean to specify if the parsed price update should be included in the response. Default is false.
   * @param allow_unordered Optional boolean to specify if unordered updates are allowed to be included in the stream. Default is false.
   * @param benchmarks_only Optional boolean to specify if only benchmark prices that are the initial price updates at a given timestamp (i.e., prevPubTime != pubTime) should be returned. Default is false.
   * @returns An EventSource instance for receiving streaming updates.
   */
  async getStreamingPriceUpdates(
    ids: HexString[],
    encoding?: EncodingType,
    parsed?: boolean,
    allow_unordered?: boolean,
    benchmarks_only?: boolean
  ): Promise<EventSource> {
    const url = new URL("/v2/updates/price/stream", this.baseURL);
    ids.forEach((id) => {
      url.searchParams.append("ids[]", id);
    });
    const params = {
      encoding,
      parsed: parsed !== undefined ? String(parsed) : undefined,
      allow_unordered:
        allow_unordered !== undefined ? String(allow_unordered) : undefined,
      benchmarks_only:
        benchmarks_only !== undefined ? String(benchmarks_only) : undefined,
    };
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
    const eventSource = new EventSource(url.toString());
    return eventSource;
  }
}
