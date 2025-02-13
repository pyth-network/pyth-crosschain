export type HexString = string;

export interface PriceFeedRequestConfig {
  binary?: boolean;
}

export interface PriceServiceConnectionConfig {
  url: string;
  priceFeedRequestConfig?: PriceFeedRequestConfig;
  timeout?: number;
  httpRetries?: number;
}

export type PriceFeedUpdateCallback = (priceFeed: any) => void;
