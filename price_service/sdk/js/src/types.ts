export type HexString = string;

export interface PriceFeedRequestConfig {
  binary?: boolean;
}

export interface PriceServiceConnectionConfig {
  url: string;
  priceFeedRequestConfig?: PriceFeedRequestConfig;
}

export type PriceFeedUpdateCallback = (priceFeed: any) => void;
