import { HexString, UnixTimestamp } from "@pythnetwork/pyth-evm-js";

export type PriceInfo = {
  price: string;
  conf: string;
  publishTime: UnixTimestamp;
};

export interface PriceListener {
  // Should return undefined only when the price does not exist.
  getLatestPriceInfo(priceId: HexString): undefined | PriceInfo;
}
