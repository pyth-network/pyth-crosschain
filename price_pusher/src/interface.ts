import { HexString, UnixTimestamp } from "@pythnetwork/pyth-common-js";

export type PriceInfo = {
  price: string;
  conf: string;
  publishTime: UnixTimestamp;
};

export interface PriceListener {
  // Should return undefined only when the price does not exist.
  getLatestPriceInfo(priceId: HexString): undefined | PriceInfo;
}

export interface ChainPricePusher {
  updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: UnixTimestamp[]
  ): Promise<void>;
}
