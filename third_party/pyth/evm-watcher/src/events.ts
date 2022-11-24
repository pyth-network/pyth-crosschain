import { HexString, NumberString, UnixTimestampString } from "./utils";

export type PriceFeedUpdateEventValues = {
  id: HexString;
  fresh: boolean;
  chainId: NumberString;
  sequenceNumber: NumberString;
  lastPublishTime: UnixTimestampString;
  publishTime: UnixTimestampString;
  price: NumberString;
  conf: NumberString;
};

export type PriceFeedInfo = PriceFeedUpdateEventValues;

export type BatchPriceFeedUpdateEventValues = {
  chainId: NumberString;
  sequenceNumber: NumberString;
  batchSize: NumberString;
  freshPricesInBatch: NumberString;
};

export type BatchPriceFeedInfo = BatchPriceFeedUpdateEventValues & {
  priceUpdates: PriceFeedUpdateEventValues[];
};

export type UpdatePriceFeedsEventValues = {
  sender: HexString;
  batchCount: NumberString;
  fee: NumberString;
};

export type UpdatePriceFeedsInfo = UpdatePriceFeedsEventValues & {
  batchUpdates: BatchPriceFeedInfo[];
};

export type UpdatePriceFeedsAggregateInfo = {
  txHash: HexString;
  txFrom: HexString;
  txTo?: HexString;
  block: number;
  timestamp: UnixTimestampString;
  rawInput: string;
  gasUsage: number;
  gasPrice: NumberString;
  effectiveGasPrice?: number;
  updatePriceFeedsInfo: UpdatePriceFeedsInfo; // Assuming there is only one UpdatePriceFeeds Event in a transaction
};
