import TTLCache from "@isaacs/ttlcache";
import WebSocket from "isomorphic-ws";
import type { Logger } from "ts-log";
import { dummyLogger } from "ts-log";

import type { Request, Response } from "../protocol.js";
import { ResilientWebSocket } from "./resilient-websocket.js";

const DEFAULT_NUM_CONNECTIONS = 3;

export class WebSocketPool {
  rwsPool: ResilientWebSocket[];
  private cache: TTLCache<string, boolean>;
  private subscriptions: Map<number, Request>; // id -> subscription Request
  private messageListeners: ((event: WebSocket.Data) => void)[];
  private allConnectionsDownListeners: (() => void)[];
  private wasAllDown = true;
  private checkConnectionStatesInterval: NodeJS.Timeout;

  private constructor(private readonly logger: Logger = dummyLogger) {
    this.rwsPool = [];
    this.cache = new TTLCache({ ttl: 1000 * 10 }); // TTL of 10 seconds
    this.subscriptions = new Map();
    this.messageListeners = [];
    this.allConnectionsDownListeners = [];

    // Start monitoring connection states
    this.checkConnectionStatesInterval = setInterval(() => {
      this.checkConnectionStates();
    }, 100);
  }

  /**
   * Creates a new WebSocketPool instance that uses multiple redundant WebSocket connections for reliability.
   * Usage semantics are similar to using a regular WebSocket client.
   * @param urls - List of WebSocket URLs to connect to
   * @param token - Authentication token to use for the connections
   * @param numConnections - Number of parallel WebSocket connections to maintain (default: 3)
   * @param logger - Optional logger to get socket level logs. Compatible with most loggers such as the built-in console and `bunyan`.
   */
  static async create(
    urls: string[],
    token: string,
    numConnections: number = DEFAULT_NUM_CONNECTIONS,
    logger: Logger = dummyLogger,
  ): Promise<WebSocketPool> {
    if (urls.length === 0) {
      throw new Error("No URLs provided");
    }

    const pool = new WebSocketPool(logger);

    // Create all websocket instances
    const connectionPromises: Promise<void>[] = [];

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
      rws.onReconnect = () => {
        if (rws.wsUserClosed) {
          return;
        }
        for (const [, request] of pool.subscriptions) {
          try {
            void rws.send(JSON.stringify(request));
          } catch (error) {
            pool.logger.error(
              "Failed to resend subscription on reconnect:",
              error,
            );
          }
        }
      };

      // Handle all client messages ourselves. Dedupe before sending to registered message handlers.
      rws.onMessage = pool.dedupeHandler;
      pool.rwsPool.push(rws);

      // Start the websocket and collect the promise
      connectionPromises.push(rws.startWebSocket());
    }

    // Wait for all connections to be established
    try {
      await Promise.all(connectionPromises);
    } catch (error) {
      // If any connection fails, clean up and throw
      pool.shutdown();
      throw error;
    }

    pool.logger.info(
      `Successfully established ${numConnections.toString()} redundant WebSocket connections`,
    );

    return pool;
  }

  /**
   * Checks for error responses in JSON messages and throws appropriate errors
   */
  private handleErrorMessages(data: string): void {
    const message = JSON.parse(data) as Response;
    if (message.type === "subscriptionError") {
      throw new Error(
        `Error occurred for subscription ID ${String(
          message.subscriptionId,
        )}: ${message.error}`,
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
    const cacheKey =
      typeof data === "string"
        ? data
        : Buffer.from(data as Buffer).toString("hex");

    if (this.cache.has(cacheKey)) {
      this.logger.debug("Dropping duplicate message");
      return;
    }

    this.cache.set(cacheKey, true);

    if (typeof data === "string") {
      this.handleErrorMessages(data);
    }

    for (const handler of this.messageListeners) {
      handler(data);
    }
  };

  async sendRequest(request: Request): Promise<void> {
    const sendPromises = this.rwsPool.map(async (rws) => {
      try {
        await rws.send(JSON.stringify(request));
      } catch (error) {
        this.logger.error("Failed to send request:", error);
        throw error;
      }
    });
    await Promise.all(sendPromises);
  }

  async addSubscription(request: Request): Promise<void> {
    if (request.type !== "subscribe") {
      throw new Error("Request must be a subscribe request");
    }
    this.subscriptions.set(request.subscriptionId, request);
    await this.sendRequest(request);
  }

  async removeSubscription(subscriptionId: number): Promise<void> {
    this.subscriptions.delete(subscriptionId);
    const request: Request = {
      type: "unsubscribe",
      subscriptionId,
    };
    await this.sendRequest(request);
  }

  addMessageListener(handler: (data: WebSocket.Data) => void): void {
    this.messageListeners.push(handler);
  }

  /**
   * Calls the handler if all websocket connections are currently down or in reconnecting state.
   * The connections may still try to reconnect in the background.
   */
  addAllConnectionsDownListener(handler: () => void): void {
    this.allConnectionsDownListeners.push(handler);
  }

  private areAllConnectionsDown(): boolean {
    return this.rwsPool.every((ws) => !ws.isConnected || ws.isReconnecting);
  }

  private checkConnectionStates(): void {
    const allDown = this.areAllConnectionsDown();

    // If all connections just went down
    if (allDown && !this.wasAllDown) {
      this.wasAllDown = true;
      this.logger.error("All WebSocket connections are down or reconnecting");
      // Notify all listeners
      for (const listener of this.allConnectionsDownListeners) {
        listener();
      }
    }
    // If at least one connection was restored
    if (!allDown && this.wasAllDown) {
      this.wasAllDown = false;
    }
  }

  shutdown(): void {
    for (const rws of this.rwsPool) {
      rws.closeWebSocket();
    }
    this.rwsPool = [];
    this.subscriptions.clear();
    this.messageListeners = [];
    this.allConnectionsDownListeners = [];
    clearInterval(this.checkConnectionStatesInterval);
  }
}
