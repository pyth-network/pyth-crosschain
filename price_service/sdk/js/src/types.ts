export const HexString = String as { new(...args: any[]): string };
export type HexString = string;

export interface PriceFeedRequestConfig {
  binary?: boolean;
  verbose?: boolean;
  allowOutOfOrder?: boolean;
  logger?: {
    trace: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

export interface PriceServiceConnectionConfig {
  url: string;
  priceFeedRequestConfig?: PriceFeedRequestConfig;
  timeout?: number;
  httpRetries?: number;
  verbose?: boolean;
  logger?: {
    trace: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

export type PriceFeedUpdateCallback = (priceFeed: any) => void;
