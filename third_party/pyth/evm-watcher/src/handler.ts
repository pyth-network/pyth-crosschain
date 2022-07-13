import { HexString, UnixTimestamp } from "./utils"

export type PythUpdateEvent = {
  txHash: HexString,
  txFrom: HexString,
  txTo: HexString,
  sender: HexString, // Equal to txTo when a contract calls updatePriceFeeds and txFrom when someone calls Pyth contract directly
  block: number,
  timestamp: number,
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
  }[]
}

export type PythUpdateEventCallback = (event: PythUpdateEvent) => (void);

export class Handler {
  private callbacks: PythUpdateEventCallback[]; 

  constructor() {
    this.callbacks = [];
  }

  dispatchEvent(event: PythUpdateEvent) {
    for (let cb of this.callbacks) {
      cb(event);
    }
  }

  subscribe(callback: PythUpdateEventCallback) {
    this.callbacks.push(callback);
  }
}
