import { HexString, NumberInString, UnixTimestampInString } from "./utils"

export type PriceFeedUpdateEventValues = {
  id: HexString,
  fresh: boolean,
  chainId: NumberInString,
  sequenceNumber: NumberInString,
  lastPublishTime: UnixTimestampInString,
  publishTime: UnixTimestampInString,
  price: NumberInString,
  conf: NumberInString
}

export type PriceFeedInfo = PriceFeedUpdateEventValues;

export type BatchPriceFeedUpdateEventValues = {
  chainId: NumberInString,
  sequenceNumber: NumberInString,
  batchSize: NumberInString,
  freshPricesInBatch: NumberInString,
}

export type BatchPriceFeedInfo = BatchPriceFeedUpdateEventValues & {
  priceUpdates: PriceFeedUpdateEventValues[];
}

export type UpdatePriceFeedsEventValues = {
  sender: HexString,
  batchCount: NumberInString,
  fee: NumberInString,
};

export type UpdatePriceFeedsInfo = UpdatePriceFeedsEventValues & {
  batchUpdates: BatchPriceFeedInfo[];
}

export type UpdatePriceFeedsAggregateInfo = {
  txHash: HexString,
  txFrom: HexString,
  txTo?: HexString,
  block: number,
  timestamp: UnixTimestampInString,
  rawInput: string,
  gasUsage: number,
  gasPrice: NumberInString,
  effectiveGasPrice?: number,
  updatePriceFeedsInfo: UpdatePriceFeedsInfo,
}
