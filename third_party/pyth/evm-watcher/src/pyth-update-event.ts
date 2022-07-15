import { HexString, UnixTimestamp } from "./utils"

export type PythUpdateEvent = {
  txHash: HexString,
  txFrom: HexString,
  txTo: HexString,
  chainId: number,
  sequenceNumber: number,
  sender: HexString, // Equal to txTo when a contract calls updatePriceFeeds and txFrom when someone calls Pyth contract directly
  block: number,
  timestamp: UnixTimestamp,
  rawInput: string,
  gasUsage: number,
  txFee: number,
  batchSize: number,
  numUpdatedPrices: number,
  prices: {
    id: HexString,
    updated: boolean,
    publishTime: UnixTimestamp,
    existingPublishTime: UnixTimestamp,
    price: string,
    conf: string,
  }[]
}
