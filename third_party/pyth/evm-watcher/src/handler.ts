import { PythUpdateEvent } from "./pyth-update-event";
import { Watcher } from "./watcher";

export class Handler {
  private watchers: Watcher[]; 

  constructor() {
    this.watchers = [];
  }

  dispatchEvent(event: PythUpdateEvent) {
    for (let watcher of this.watchers) {
      watcher.processEvent(event);
    }
  }

  subscribe(watcher: Watcher) {
    this.watchers.push(watcher);
  }
}
