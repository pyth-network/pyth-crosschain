export type Chain = "evm" | "solana";
export type DeliveryFormat = "json" | "binary";
export type JsonBinaryEncoding = "base64" | "hex";
export type PriceFeedProperty = "price" | "bestBidPrice" | "bestAskPrice";
export type Channel = "real_time" | "fixed_rate@50ms" | "fixed_rate@200ms";

export type Request =
  | {
      type: "subscribe";
      subscriptionId: number;
      priceFeedIds: number[];
      properties: PriceFeedProperty[];
      chains: Chain[];
      deliveryFormat?: DeliveryFormat;
      jsonBinaryEncoding?: JsonBinaryEncoding;
      parsed?: boolean;
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
};

export type ParsedPayload = {
  timestampUs: string;
  priceFeeds: ParsedFeedPayload[];
};

export type JsonBinaryData = {
  encoding: JsonBinaryEncoding;
  data: string;
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
    };

export const BINARY_UPDATE_FORMAT_MAGIC = 1_937_213_467;
export const PARSED_FORMAT_MAGIC = 2_584_795_844;
export const EVM_FORMAT_MAGIC = 706_910_618;
export const SOLANA_FORMAT_MAGIC_BE = 3_103_857_282;
