import type { ClientRequestArgs } from "node:http";

import type { ClientOptions, ErrorEvent } from "isomorphic-ws";
import WebSocket from "isomorphic-ws";
import type { Logger } from "ts-log";
import { dummyLogger } from "ts-log";

const DEFAULT_HEARTBEAT_TIMEOUT_DURATION_MS = 5000; // 5 seconds
const DEFAULT_MAX_RETRY_DELAY_MS = 1000; // 1 second'
const DEFAULT_LOG_AFTER_RETRY_COUNT = 10;

export type ResilientWebSocketConfig = {
  endpoint: string;
  wsOptions?: ClientOptions | ClientRequestArgs | undefined;
  logger?: Logger;
  heartbeatTimeoutDurationMs?: number;
  maxRetryDelayMs?: number;
  logAfterRetryCount?: number;
};

export class ResilientWebSocket {
  private endpoint: string;
  private wsOptions?: ClientOptions | ClientRequestArgs | undefined;
  private logger: Logger;
  private heartbeatTimeoutDurationMs: number;
  private maxRetryDelayMs: number;
  private logAfterRetryCount: number;

  wsClient: undefined | WebSocket;
  wsUserClosed = false;
  private wsFailedAttempts: number;
  private heartbeatTimeout?: NodeJS.Timeout | undefined;
  private retryTimeout?: NodeJS.Timeout | undefined;
  private _isReconnecting = false;

  isReconnecting(): boolean {
    return this._isReconnecting;
  }

  isConnected(): this is this & { wsClient: WebSocket } {
    return this.wsClient?.readyState === WebSocket.OPEN;
  }

  private shouldLogRetry() {
    return this.wsFailedAttempts % this.logAfterRetryCount === 0;
  }

  onError: (error: ErrorEvent) => void;
  onMessage: (data: WebSocket.Data) => void;
  onReconnect: () => void;

  constructor(config: ResilientWebSocketConfig) {
    this.endpoint = config.endpoint;
    this.wsOptions = config.wsOptions;
    this.logger = config.logger ?? dummyLogger;
    this.heartbeatTimeoutDurationMs =
      config.heartbeatTimeoutDurationMs ??
      DEFAULT_HEARTBEAT_TIMEOUT_DURATION_MS;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.logAfterRetryCount =
      config.logAfterRetryCount ?? DEFAULT_LOG_AFTER_RETRY_COUNT;

    this.wsFailedAttempts = 0;
    this.onError = (error: ErrorEvent) => {
      void error;
    };
    this.onMessage = (data: WebSocket.Data): void => {
      void data;
    };
    this.onReconnect = (): void => {
      // Empty function, can be set by the user.
    };
  }

  send(data: string | Buffer) {
    this.logger.debug(`Sending message`);

    if (this.isConnected()) {
      this.wsClient.send(data);
    } else {
      this.logger.warn(
        `WebSocket to ${this.endpoint} is not connected. Cannot send message.`,
      );
    }
  }

  startWebSocket() {
    if (this.wsUserClosed) {
      this.logger.error(
        "Connection was explicitly closed by user. Will not reconnect.",
      );
      return;
    }

    if (this.wsClient !== undefined) {
      this.logger.info("WebSocket client already started.");
      return;
    }

    if (this.wsFailedAttempts == 0) {
      this.logger.info(`Creating Web Socket client`);
    }

    if (this.retryTimeout !== undefined) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = undefined;
    }

    this.wsClient = new WebSocket(this.endpoint, this.wsOptions);

    this.wsClient.addEventListener("open", () => {
      this.logger.info("WebSocket connection established");
      this.wsFailedAttempts = 0;
      this._isReconnecting = false;
      this.resetHeartbeat();
      this.onReconnect();
    });

    this.wsClient.addEventListener("close", (e) => {
      if (this.wsUserClosed) {
        this.logger.info(
          `WebSocket connection to ${this.endpoint} closed by user`,
        );
      } else {
        if (this.shouldLogRetry()) {
          this.logger.warn(
            `WebSocket connection to ${this.endpoint} closed unexpectedly: Code: ${e.code.toString()}`,
          );
        }
        this.handleReconnect();
      }
    });

    this.wsClient.addEventListener("error", (event) => {
      this.onError(event);
    });

    this.wsClient.addEventListener("message", (event) => {
      this.resetHeartbeat();
      this.onMessage(event.data);
    });

    if ("on" in this.wsClient) {
      this.wsClient.on("ping", () => {
        this.logger.info("Ping received");
        this.resetHeartbeat();
      });
    }
  }

  private resetHeartbeat(): void {
    if (this.heartbeatTimeout !== undefined) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      this.logger.warn("Connection timed out. Reconnecting...");
      this.wsClient?.terminate();
      this.handleReconnect();
    }, this.heartbeatTimeoutDurationMs);
  }

  private handleReconnect() {
    if (this.wsUserClosed) {
      this.logger.info(
        "WebSocket connection closed by user, not reconnecting.",
      );
      return;
    }

    if (this.heartbeatTimeout !== undefined) {
      clearTimeout(this.heartbeatTimeout);
    }

    if (this.retryTimeout !== undefined) {
      clearTimeout(this.retryTimeout);
    }

    this.wsFailedAttempts += 1;
    this.wsClient = undefined;

    this._isReconnecting = true;

    if (this.shouldLogRetry()) {
      this.logger.error(
        "Connection closed unexpectedly or because of timeout. Reconnecting after " +
          String(this.retryDelayMs()) +
          "ms.",
      );
    }

    this.retryTimeout = setTimeout(() => {
      this.startWebSocket();
    }, this.retryDelayMs());
  }

  closeWebSocket(): void {
    if (this.wsClient !== undefined) {
      this.wsClient.close();
      this.wsClient = undefined;
    }
    this.wsUserClosed = true;
  }

  /**
   * Calculates the delay in milliseconds for exponential backoff based on the number of failed attempts.
   *
   * The delay increases exponentially with each attempt, starting at 20ms for the first attempt,
   * and is capped at maxRetryDelayMs for attempts greater than or equal to 10.
   *
   * @returns The calculated delay in milliseconds before the next retry.
   */
  private retryDelayMs(): number {
    if (this.wsFailedAttempts >= 10) {
      return this.maxRetryDelayMs;
    }
    return Math.min(2 ** this.wsFailedAttempts * 10, this.maxRetryDelayMs);
  }
}
