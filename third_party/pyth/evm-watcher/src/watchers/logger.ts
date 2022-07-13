import { Handler, PythUpdateEvent } from "../handler";

export class Logger {
  constructor(handler: Handler) {
    handler.subscribe(this.processEvent.bind(this));
  }

  processEvent(event: PythUpdateEvent) {
    console.dir(event);
  }
}
