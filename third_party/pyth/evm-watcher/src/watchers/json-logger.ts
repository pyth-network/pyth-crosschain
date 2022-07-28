import { UpdatePriceFeedsAggregateInfo } from "../events";
import { Watcher } from "../watcher";

export class JsonLogger implements Watcher {
  processEvent(event: UpdatePriceFeedsAggregateInfo) {
    console.log(JSON.stringify(event));
  }
}
