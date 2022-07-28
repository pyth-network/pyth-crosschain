import { UpdatePriceFeedsAggregateInfo } from "./events";

export interface Watcher {
  processEvent(event: UpdatePriceFeedsAggregateInfo): void;
}
