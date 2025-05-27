import TTLCache from "@isaacs/ttlcache";
import type { ErrorEvent } from "isomorphic-ws";
import WebSocket from "isomorphic-ws";
import type { Logger } from "ts-log";
import { dummyLogger } from "ts-log";

import type { Request, Response } from "../protocol.js";
import type { ResilientWebSocketConfig } from "./resilient-websocket.js";
import { ResilientWebSocket } from "./resilient-websocket.js";

const DEFAULT_NUM_CONNECTIONS = 4;

export type WebSocketPoolConfig = {
  urls: string[];
  token: string;
  numConnections?: number;
  logger?: Logger;
  rwsConfig?: Omit<ResilientWebSocketConfig, "logger" | "endpoint">;
  onError?: (error: ErrorEvent) => void;
};

export class WebSocketPool {
  rwsPool: ResilientWebSocket[];
  private cache: TTLCache<string, boolean>;
  private subscriptions: Map<number, Request>; // id -> subscription Request
  private messageListeners: ((event: WebSocket.Data) => void)[];
  private allConnectionsDownListeners: (() => void)[];
  private wasAllDown = true;
  private checkConnectionStatesInterval: NodeJS.Timeout;

  private constructor(private readonly logger: Logger) {
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
  static async create(config: WebSocketPoolConfig): Promise<WebSocketPool> {
    if (config.urls.length === 0) {
      throw new Error("No URLs provided");
    }

    const logger = config.logger ?? dummyLogger;
    const pool = new WebSocketPool(logger);
    const numConnections = config.numConnections ?? DEFAULT_NUM_CONNECTIONS;

    for (let i = 0; i < numConnections; i++) {
      const url = config.urls[i % config.urls.length];
      if (!url) {
        throw new Error(`URLs must not be null or empty`);
      }
      const wsOptions = {
        ...config.rwsConfig?.wsOptions,
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      };
      const rws = new ResilientWebSocket({
        ...config.rwsConfig,
        endpoint: url,
        wsOptions,
        logger,
      });

      // If a websocket client unexpectedly disconnects, ResilientWebSocket will reestablish
      // the connection and call the onReconnect callback.
      rws.onReconnect = () => {
        if (rws.wsUserClosed) {
          return;
        }
        for (const [, request] of pool.subscriptions) {
          try {
            rws.send(JSON.stringify(request));
          } catch (error) {
            pool.logger.error(
              "Failed to resend subscription on reconnect:",
              error,
            );
          }
        }
      };

      if (config.onError) {
        rws.onError = config.onError;
      }
      // Handle all client messages ourselves. Dedupe before sending to registered message handlers.
      rws.onMessage = pool.dedupeHandler;
      pool.rwsPool.push(rws);
      rws.startWebSocket();
    }

    pool.logger.info(
      `Started WebSocketPool with ${numConnections.toString()} connections. Waiting for at least one to connect...`,
    );

    while (!pool.isAnyConnectionEstablished()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    pool.logger.info(
      `At least one WebSocket connection is established. WebSocketPool is ready.`,
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

  sendRequest(request: Request) {
    for (const rws of this.rwsPool) {
      rws.send(JSON.stringify(request));
    }
  }

  addSubscription(request: Request) {
    if (request.type !== "subscribe") {
      throw new Error("Request must be a subscribe request");
    }
    this.subscriptions.set(request.subscriptionId, request);
    this.sendRequest(request);
  }

  removeSubscription(subscriptionId: number) {
    this.subscriptions.delete(subscriptionId);
    const request: Request = {
      type: "unsubscribe",
      subscriptionId,
    };
    this.sendRequest(request);
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
    return this.rwsPool.every((ws) => !ws.isConnected() || ws.isReconnecting());
  }

  private isAnyConnectionEstablished(): boolean {
    return this.rwsPool.some((ws) => ws.isConnected());
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
