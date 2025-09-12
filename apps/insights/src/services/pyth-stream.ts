// ─── Client → Server ───────────────────────────────────────────────────────────

type ClientMessage =
  | { type: "subscribe_price"; ids: string[]; verbose: boolean }
  | { type: "unsubscribe_price"; ids: string[]; verbose: boolean }
  | { type: "subscribe_publisher"; ids: string[]; verbose: boolean }
  | { type: "unsubscribe_publisher"; ids: string[]; verbose: boolean };

// ─── Types for price feeds ─────────────────────────────────────────────────────

export type PriceInfo = {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
  slot: number;
};

export type PriceFeed = {
  id: string;
  price: PriceInfo;
  ema_price: PriceInfo;
};

// ─── Server → Client (single) ─────────────────────────────────────────────────

export type PriceUpdate = {
  type: "price_update";
  price_feed: PriceFeed;
};


// ─── Server → Client (batched) ────────────────────────────────────────────────
// Batch frame that contains many publisher updates in one message.
export type PublisherPriceUpdateItem = {
  publisher: string;
  feed_id: string;
  price: string;
  slot: number;
};

export type PublisherPriceUpdate = {
  type: "publisher_price_update";
  updates: PublisherPriceUpdateItem[];
};

// Server can send a single message, a batch message, or an array of messages.
export type ServerMessage =
  | PriceUpdate
  | PublisherPriceUpdate;

export type ServerPayload = ServerMessage | ServerMessage[];

export class PythSubscriber {
  private ws: WebSocket | undefined = undefined;
  private url: string;

  private onPriceUpdateHandler?: (update: PriceUpdate) => void;
  private onPublisherUpdateHandler?: (update: PublisherPriceUpdate) => void;

  constructor(url = "ws://0.0.0.0:8080") {
    this.url = url;
  }

  public async connect() {
    return new Promise<void>((resolve, reject) => {
      if (this.ws) return resolve();

      this.ws = new WebSocket(this.url);

      this.ws.addEventListener("open", () => {
        console.log("Connected to WebSocket");
        resolve();
      });

      this.ws.addEventListener("message", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as ServerPayload;

          if (Array.isArray(data)) {
            for (const msg of data) this.handleServerMessage(msg);
          } else {
            this.handleServerMessage(data);
          }
        } catch (e) {
          console.error("Failed to parse message:", event.data, e);
        }
      });

      this.ws.addEventListener("close", () => {
        console.warn("WebSocket closed");
        this.ws = undefined;
      });

      this.ws.addEventListener("error", (event: Event) => {
        console.error("WebSocket error:", event);
      });
    });
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "price_update":
        this.onPriceUpdateHandler?.(msg);
        return;

      case "publisher_price_update":
        // Prefer batch handler if provided; otherwise fan out to per-item handler
        if (this.onPublisherUpdateHandler) {
          this.onPublisherUpdateHandler(msg);
        }
        return;

      default:
        console.error("Unknown message from server:", msg);
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("WebSocket not ready. Message not sent:", msg);
    }
  }

  // ── Subscriptions ───────────────────────────────────────────────────────────

  public subscribePrice(ids: string[], verbose = true) {
    this.send({ type: "subscribe_price", ids, verbose });
  }

  public unsubscribePrice(ids: string[], verbose = true) {
    this.send({ type: "unsubscribe_price", ids, verbose });
  }

  public subscribePublisher(ids: string[], verbose = true) {
    this.send({ type: "subscribe_publisher", ids, verbose });
  }

  public unsubscribePublisher(ids: string[], verbose = true) {
    this.send({ type: "unsubscribe_publisher", ids, verbose });
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────

  public onPriceUpdate(cb: (update: PriceUpdate) => void) {
    this.onPriceUpdateHandler = cb;
  }

  public onPublisherUpdate(
    cb: (update: PublisherPriceUpdate) => void
  ) {
    this.onPublisherUpdateHandler = cb;
  }

  public disconnect() {
    this.ws?.close();
    this.ws = undefined;
  }
}