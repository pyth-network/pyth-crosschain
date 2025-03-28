export type Format = "evm" | "solana" | "leEcdsa" | "leUnsigned";
export type DeliveryFormat = "json" | "binary";
export type JsonBinaryEncoding = "base64" | "hex";
export type PriceFeedProperty =
  | "price"
  | "bestBidPrice"
  | "bestAskPrice"
  | "exponent"
  | "publisherCount"
  | "confidence";
export type Channel = "real_time" | "fixed_rate@50ms" | "fixed_rate@200ms";

export type Request =
  | {
      type: "subscribe";
      subscriptionId: number;
      priceFeedIds: number[];
      properties: PriceFeedProperty[];
      formats: Format[];
      deliveryFormat?: DeliveryFormat;
      jsonBinaryEncoding?: JsonBinaryEncoding;
      parsed?: boolean;
      ignoreInvalidFeedIds?: boolean;
      channel: Channel;
    }
  | {
      type: "unsubscribe";
      subscriptionId: number;
    };

export type ParsedFeedPayload = {
  priceFeedId: number;
  price?: string | undefined;
  bestBidPrice?: string | undefined;
  bestAskPrice?: string | undefined;
  publisherCount?: number | undefined;
  exponent?: number | undefined;
  confidence?: string | undefined;
};

export type ParsedPayload = {
  timestampUs: string;
  priceFeeds: ParsedFeedPayload[];
};

export type JsonBinaryData = {
  encoding: JsonBinaryEncoding;
  data: string;
};

export type InvalidFeedSubscriptionDetails = {
  unknownIds: number[];
  unsupportedChannels: number[];
  unstable: number[];
};

export type Response =
  | {
      type: "error";
      error: string;
    }
  | {
      type: "subscribed";
      subscriptionId: number;
    }
  | {
      type: "subscribedWithInvalidFeedIdsIgnored";
      subscriptionId: number;
      subscribedFeedIds: number[];
      ignoredInvalidFeedIds: InvalidFeedSubscriptionDetails;
    }
  | {
      type: "unsubscribed";
      subscriptionId: number;
    }
  | {
      type: "subscriptionError";
      subscriptionId: number;
      error: string;
    }
  | {
      type: "streamUpdated";
      subscriptionId: number;
      parsed?: ParsedPayload | undefined;
      evm?: JsonBinaryData | undefined;
      solana?: JsonBinaryData | undefined;
      leEcdsa?: JsonBinaryData | undefined;
      leUnsigned?: JsonBinaryData | undefined;
    };

export const BINARY_UPDATE_FORMAT_MAGIC_LE = 461_928_307;

export const FORMAT_MAGICS_LE = {
  JSON: 3_302_625_434,
  EVM: 2_593_727_018,
  SOLANA: 2_182_742_457,
  LE_ECDSA: 1_296_547_300,
  LE_UNSIGNED: 1_499_680_012,
};
