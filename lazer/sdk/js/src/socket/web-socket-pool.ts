import TTLCache from "@isaacs/ttlcache";
import WebSocket from "isomorphic-ws";
import { dummyLogger, type Logger } from "ts-log";

import { ResilientWebSocket } from "./resilient-web-socket.js";
import type { Request, Response } from "../protocol.js";

// Number of redundant parallel WebSocket connections
const DEFAULT_NUM_CONNECTIONS = 3;

export class WebSocketPool {
  rwsPool: ResilientWebSocket[];
  private cache: TTLCache<string, boolean>;
  private subscriptions: Map<number, Request>; // id -> subscription Request
  private messageListeners: ((event: WebSocket.Data) => void)[];

  /**
   * Creates a new WebSocketPool instance that uses multiple redundant WebSocket connections for reliability.
   * Usage semantics are similar to using a regular WebSocket client.
   * @param urls - List of WebSocket URLs to connect to
   * @param token - Authentication token to use for the connections
   * @param numConnections - Number of parallel WebSocket connections to maintain (default: 3)
   * @param logger - Optional logger to get socket level logs. Compatible with most loggers such as the built-in console and `bunyan`.
   */
  constructor(
    urls: string[],
    token: string,
    numConnections: number = DEFAULT_NUM_CONNECTIONS,
    private readonly logger: Logger = dummyLogger
  ) {
    if (urls.length === 0) {
      throw new Error("No URLs provided");
    }
    // This cache is used to deduplicate messages received across different websocket clients in the pool.
    // A TTL cache is used to prevent unbounded memory usage. A very short TTL of 10 seconds is chosen since
    // deduplication only needs to happen between messages received very close together in time.
    this.cache = new TTLCache({ ttl: 1000 * 10 }); // TTL of 10 seconds
    this.rwsPool = [];
    this.subscriptions = new Map();
    this.messageListeners = [];
    for (let i = 0; i < numConnections; i++) {
      const url = urls[i % urls.length];
      if (!url) {
        throw new Error(`URLs must not be null or empty`);
      }
      const wsOptions = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const rws = new ResilientWebSocket(url, wsOptions, logger);

      // If a websocket client unexpectedly disconnects, ResilientWebSocket will reestablish
      // the connection and call the onReconnect callback.
      // When we reconnect, replay all subscription messages to resume the data stream.
      rws.onReconnect = () => {
        if (rws.wsUserClosed) {
          return;
        }
        for (const [, request] of this.subscriptions) {
          try {
            void rws.send(JSON.stringify(request));
          } catch (error) {
            this.logger.error(
              "Failed to resend subscription on reconnect:",
              error
            );
          }
        }
      };
      // Handle all client messages ourselves. Dedupe before sending to registered message handlers.
      rws.onMessage = this.dedupeHandler;
      this.rwsPool.push(rws);
    }

    // Let it rip
    // TODO: wait for sockets to receive `open` msg before subscribing?
    for (const rws of this.rwsPool) {
      rws.startWebSocket();
    }

    this.logger.info(
      `Using ${numConnections.toString()} redundant WebSocket connections`
    );
  }

  /**
   * Checks for error responses in JSON messages and throws appropriate errors
   */
  private handleErrorMessages(data: string): void {
    const message = JSON.parse(data) as Response;
    if (message.type === "subscriptionError") {
      throw new Error(
        `Error occurred for subscription ID ${String(
          message.subscriptionId
        )}: ${message.error}`
      );
    } else if (message.type === "error") {
      throw new Error(`Error: ${message.error}`);
    }
  }

  /**
   * Handles incoming websocket messages by deduplicating identical messages received across
   * multiple connections before forwarding to registered handlers
   */
  dedupeHandler = (data: WebSocket.Data): void => {
    // For string data, use the whole string as the cache key. This avoids expensive JSON parsing during deduping.
    // For binary data, use the hex string representation as the cache key
    const cacheKey =
      typeof data === "string"
        ? data
        : Buffer.from(data as Buffer).toString("hex");

    // If we've seen this exact message recently, drop it
    if (this.cache.has(cacheKey)) {
      this.logger.debug("Dropping duplicate message");
      return;
    }

    // Haven't seen this message, cache it and forward to handlers
    this.cache.set(cacheKey, true);

    // Check for errors in JSON responses
    if (typeof data === "string") {
      this.handleErrorMessages(data);
    }

    for (const handler of this.messageListeners) {
      handler(data);
    }
  };

  /**
   * Sends a message to all websockets in the pool
   * @param request - The request to send
   */
  async sendRequest(request: Request): Promise<void> {
    // Send to all websockets in the pool
    const sendPromises = this.rwsPool.map(async (rws) => {
      try {
        await rws.send(JSON.stringify(request));
      } catch (error) {
        this.logger.error("Failed to send request:", error);
        throw error; // Re-throw the error
      }
    });
    await Promise.all(sendPromises);
  }

  /**
   * Adds a subscription by sending a subscribe request to all websockets in the pool
   * and storing it for replay on reconnection
   * @param request - The subscription request to send
   */
  async addSubscription(request: Request): Promise<void> {
    if (request.type !== "subscribe") {
      throw new Error("Request must be a subscribe request");
    }
    this.subscriptions.set(request.subscriptionId, request);
    await this.sendRequest(request);
  }

  /**
   * Removes a subscription by sending an unsubscribe request to all websockets in the pool
   * and removing it from stored subscriptions
   * @param subscriptionId - The ID of the subscription to remove
   */
  async removeSubscription(subscriptionId: number): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    const request: Request = {
      type: "unsubscribe",
      subscriptionId,
    };
    await this.sendRequest(request);
  }

  /**
   * Adds a message handler function to receive websocket messages
   * @param handler - Function that will be called with each received message
   */
  addMessageListener(handler: (data: WebSocket.Data) => void): void {
    this.messageListeners.push(handler);
  }

  /**
   * Elegantly closes all websocket connections in the pool
   */
  shutdown(): void {
    for (const rws of this.rwsPool) {
      rws.closeWebSocket();
    }
    this.rwsPool = [];
    this.subscriptions.clear();
    this.messageListeners = [];
  }
}
