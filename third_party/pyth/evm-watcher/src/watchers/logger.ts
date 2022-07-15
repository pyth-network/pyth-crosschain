import { PythUpdateEvent } from "../pyth-update-event";
import { Watcher } from "../watcher";

export class Logger implements Watcher {
  processEvent(event: PythUpdateEvent) {
    console.dir(event);
  }
}
