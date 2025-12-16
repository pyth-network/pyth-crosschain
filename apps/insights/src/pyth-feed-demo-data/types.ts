import type { DataSourcesReplayType } from "../schemas/pyth/pyth-pro-demo-schema";

export type NBBOEntry = Record<
  | "ticker"
  | "Domain"
  | "datetime"
  | "GMT Offset"
  | "Type"
  | "price"
  | "Volume"
  | "bid_price"
  | "bid_size"
  | "ask_price"
  | "ask_size"
  | "Average Price",
  string | null | undefined
>;

export type PythEntry = Record<
  | "publishTime"
  | "prevPublishTime"
  | "channel"
  | "priceId"
  | "symbol"
  | "price"
  | "confidence"
  | "emaPrice"
  | "emaConfidence"
  | "expo"
  | "slot"
  | "proof"
  | "proofAvailableTime"
  | "dbTime",
  string | null | undefined
>;

export type OutputEntry = {
  ask: number;
  bid: number;
  datetime: string;
  price: number;
  source: DataSourcesReplayType;
  symbol: string;
};
