import { UpdatePriceFeedsAggregateInfo } from "./events";
import { Watcher } from "./watcher";

export class Handler {
  private watchers: Watcher[];

  constructor() {
    this.watchers = [];
  }

  dispatchEvent(event: UpdatePriceFeedsAggregateInfo) {
    for (let watcher of this.watchers) {
      watcher.processEvent(event);
    }
  }

  subscribe(watcher: Watcher) {
    this.watchers.push(watcher);
  }
}
