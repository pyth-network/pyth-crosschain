import { EventSource } from "eventsource";
import { schemas } from "./zodSchemas";
import { z } from "zod";
import { camelToSnakeCaseObject } from "./utils";

// Accessing schema objects
export type AssetType = z.infer<typeof schemas.AssetType>;
export type BinaryPriceUpdate = z.infer<typeof schemas.BinaryUpdate>;
export type EncodingType = z.infer<typeof schemas.EncodingType>;
export type PriceFeedMetadata = z.infer<typeof schemas.PriceFeedMetadata>;
export type PriceIdInput = z.infer<typeof schemas.PriceIdInput>;
export type PriceUpdate = z.infer<typeof schemas.PriceUpdate>;
export type TwapsResponse = z.infer<typeof schemas.TwapsResponse>;
export type PublisherCaps = z.infer<
  typeof schemas.LatestPublisherStakeCapsUpdateDataResponse
>;

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
  /**
   * Optional headers to be included in every request.
   */
  headers?: HeadersInit;
};

export class HermesClient {
  private baseURL: string;
  private timeout: DurationInMs;
  private httpRetries: number;
  private headers: HeadersInit;

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
    this.headers = config?.headers ?? {};
  }

  private async httpRequest<ResponseData>(
    url: string,
    schema: z.ZodSchema<ResponseData>,
    options?: RequestInit,
    retries = this.httpRetries,
    backoff = 100 + Math.floor(Math.random() * 100), // Adding randomness to the initial backoff to avoid "thundering herd" scenario where a lot of clients that get kicked off all at the same time (say some script or something) and fail to connect all retry at exactly the same time too
  ): Promise<ResponseData> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.any([
          ...(options?.signal ? [options.signal] : []),
          AbortSignal.timeout(this.timeout),
        ]),
        headers: { ...this.headers, ...options?.headers },
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}${
            errorBody ? `, body: ${errorBody}` : ""
          }`,
        );
      }
      const data = await response.json();
      return schema.parse(data);
    } catch (error) {
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
   *        - assetType: String to filter the price feeds by asset type. Possible values are "crypto", "equity", "fx", "metal", "rates", "crypto_redemption_rate". Filter string is case insensitive.
   *
   * @returns Array of PriceFeedMetadata objects.
   */
  async getPriceFeeds({
    fetchOptions,
    ...options
  }: {
    query?: string;
    assetType?: AssetType;
    fetchOptions?: RequestInit;
  } = {}): Promise<PriceFeedMetadata[]> {
    const url = this.buildURL("price_feeds");
    if (options) {
      const transformedOptions = camelToSnakeCaseObject(options);
      this.appendUrlSearchParams(url, transformedOptions);
    }
    return await this.httpRequest(
      url.toString(),
      schemas.PriceFeedMetadata.array(),
      fetchOptions,
    );
  }

  /**
   * Fetch the latest publisher stake caps.
   * This endpoint can be customized by specifying the encoding type and whether the results should also return the parsed publisher caps.
   * This will throw an error if there is a network problem or the price service returns a non-ok response.
   *
   * @param options Optional parameters:
   *        - encoding: Encoding type. If specified, return the publisher caps in the encoding specified by the encoding parameter. Default is hex.
   *        - parsed: Boolean to specify if the parsed publisher caps should be included in the response. Default is false.
   *
   * @returns PublisherCaps object containing the latest publisher stake caps.
   */
  async getLatestPublisherCaps({
    fetchOptions,
    ...options
  }: {
    encoding?: EncodingType;
    parsed?: boolean;
    fetchOptions?: RequestInit;
  } = {}): Promise<PublisherCaps> {
    const url = this.buildURL("updates/publisher_stake_caps/latest");
    if (options) {
      this.appendUrlSearchParams(url, options);
    }
    return await this.httpRequest(
      url.toString(),
      schemas.LatestPublisherStakeCapsUpdateDataResponse,
      fetchOptions,
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
   *        - ignoreInvalidPriceIds: Boolean to specify if invalid price IDs should be ignored instead of returning an error. Default is false.
   *
   * @returns PriceUpdate object containing the latest updates.
   */
  async getLatestPriceUpdates(
    ids: HexString[],
    options?: {
      encoding?: EncodingType;
      parsed?: boolean;
      ignoreInvalidPriceIds?: boolean;
    },
    fetchOptions?: RequestInit,
  ): Promise<PriceUpdate> {
    const url = this.buildURL("updates/price/latest");
    for (const id of ids) {
      url.searchParams.append("ids[]", id);
    }

    if (options) {
      const transformedOptions = camelToSnakeCaseObject(options);
      this.appendUrlSearchParams(url, transformedOptions);
    }

    return this.httpRequest(url.toString(), schemas.PriceUpdate, fetchOptions);
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
   *        - ignoreInvalidPriceIds: Boolean to specify if invalid price IDs should be ignored instead of returning an error. Default is false.
   *
   * @returns PriceUpdate object containing the updates at the specified timestamp.
   */
  async getPriceUpdatesAtTimestamp(
    publishTime: UnixTimestamp,
    ids: HexString[],
    options?: {
      encoding?: EncodingType;
      parsed?: boolean;
      ignoreInvalidPriceIds?: boolean;
    },
    fetchOptions?: RequestInit,
  ): Promise<PriceUpdate> {
    const url = this.buildURL(`updates/price/${publishTime}`);
    for (const id of ids) {
      url.searchParams.append("ids[]", id);
    }

    if (options) {
      const transformedOptions = camelToSnakeCaseObject(options);
      this.appendUrlSearchParams(url, transformedOptions);
    }

    return this.httpRequest(url.toString(), schemas.PriceUpdate, fetchOptions);
  }

  /**
   * Fetch streaming price updates for a set of price feed IDs.
   * This endpoint can be customized by specifying the encoding type, whether the results should include parsed updates,
   * and if unordered updates or only benchmark updates are allowed.
   * This will return an EventSource that can be used to listen to streaming updates.
   * If an invalid hex-encoded ID is passed, it will throw an error.
   *
   * @param ids Array of hex-encoded price feed IDs for which streaming updates are requested.
   * @param options Optional parameters:
   *        - encoding: Encoding type. If specified, updates are returned in the specified encoding. Default is hex.
   *        - parsed: Boolean to specify if the parsed price update should be included in the response. Default is false.
   *        - allowUnordered: Boolean to specify if unordered updates are allowed to be included in the stream. Default is false.
   *        - benchmarksOnly: Boolean to specify if only benchmark prices should be returned. Default is false.
   *        - ignoreInvalidPriceIds: Boolean to specify if invalid price IDs should be ignored instead of returning an error. Default is false.
   *
   * @returns An EventSource instance for receiving streaming updates.
   */
  async getPriceUpdatesStream(
    ids: HexString[],
    options?: {
      encoding?: EncodingType;
      parsed?: boolean;
      allowUnordered?: boolean;
      benchmarksOnly?: boolean;
      ignoreInvalidPriceIds?: boolean;
    },
  ): Promise<EventSource> {
    const url = this.buildURL("updates/price/stream");
    ids.forEach((id) => {
      url.searchParams.append("ids[]", id);
    });

    if (options) {
      const transformedOptions = camelToSnakeCaseObject(options);
      this.appendUrlSearchParams(url, transformedOptions);
    }

    return new EventSource(url.toString(), {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            ...this.headers,
          },
        }),
    });
  }

  /**
   * Fetch the latest TWAP (time weighted average price) for a set of price feed IDs.
   * This endpoint can be customized by specifying the encoding type and whether the results should also return the calculated TWAP using the options object.
   * This will throw an error if there is a network problem or the price service returns a non-ok response.
   *
   * @param ids Array of hex-encoded price feed IDs for which updates are requested.
   * @param window_seconds The time window in seconds over which to calculate the TWAP, ending at the current time.
   *  For example, a value of 300 would return the most recent 5 minute TWAP. Must be greater than 0 and less than or equal to 600 seconds (10 minutes).
   * @param options Optional parameters:
   *        - encoding: Encoding type. If specified, return the TWAP binary data in the encoding specified by the encoding parameter. Default is hex.
   *        - parsed: Boolean to specify if the calculated TWAP should be included in the response. Default is false.
   *        - ignoreInvalidPriceIds: Boolean to specify if invalid price IDs should be ignored instead of returning an error. Default is false.
   *
   * @returns TwapsResponse object containing the latest TWAPs.
   */
  async getLatestTwaps(
    ids: HexString[],
    window_seconds: number,
    options?: {
      encoding?: EncodingType;
      parsed?: boolean;
      ignoreInvalidPriceIds?: boolean;
    },
    fetchOptions?: RequestInit,
  ): Promise<TwapsResponse> {
    const url = this.buildURL(`updates/twap/${window_seconds}/latest`);
    for (const id of ids) {
      url.searchParams.append("ids[]", id);
    }

    if (options) {
      const transformedOptions = camelToSnakeCaseObject(options);
      this.appendUrlSearchParams(url, transformedOptions);
    }

    return this.httpRequest(
      url.toString(),
      schemas.TwapsResponse,
      fetchOptions,
    );
  }

  private appendUrlSearchParams(
    url: URL,
    params: Record<string, string | boolean>,
  ) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  private buildURL(endpoint: string) {
    return new URL(
      `./v2/${endpoint}`,
      // We ensure the `baseURL` ends with a `/` so that URL doesn't resolve the
      // path relative to the parent.
      `${this.baseURL}${this.baseURL.endsWith("/") ? "" : "/"}`,
    );
  }
}
