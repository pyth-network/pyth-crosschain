import { PythUpdateEvent } from "./pyth-update-event";

export interface Watcher {
  processEvent(event: PythUpdateEvent): void;
}
