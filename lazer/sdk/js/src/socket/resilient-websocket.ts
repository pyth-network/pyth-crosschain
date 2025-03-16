import type { ClientRequestArgs } from "node:http";

import type { ClientOptions, ErrorEvent } from "isomorphic-ws";
import WebSocket from "isomorphic-ws";
import type { Logger } from "ts-log";

const HEARTBEAT_TIMEOUT_DURATION = 10_000;
const CONNECTION_TIMEOUT = 5000;

export class ResilientWebSocket {
  endpoint: string;
  wsClient: undefined | WebSocket;
  wsUserClosed: boolean;
  private wsOptions: ClientOptions | ClientRequestArgs | undefined;
  private wsFailedAttempts: number;
  private heartbeatTimeout: undefined | NodeJS.Timeout;
  private logger: undefined | Logger;
  private connectionPromise: Promise<void> | undefined;
  private resolveConnection: (() => void) | undefined;
  private rejectConnection: ((error: Error) => void) | undefined;
  private _isReconnecting = false;

  get isReconnecting(): boolean {
    return this._isReconnecting;
  }

  get isConnected(): boolean {
    return this.wsClient?.readyState === WebSocket.OPEN;
  }

  onError: (error: ErrorEvent) => void;
  onMessage: (data: WebSocket.Data) => void;
  onReconnect: () => void;

  constructor(
    endpoint: string,
    wsOptions?: ClientOptions | ClientRequestArgs,
    logger?: Logger,
  ) {
    this.endpoint = endpoint;
    this.wsOptions = wsOptions;
    this.logger = logger;

    this.wsFailedAttempts = 0;
    this.onError = (error: ErrorEvent) => {
      this.logger?.error(error.error);
    };
    this.wsUserClosed = true;
    this.onMessage = (data: WebSocket.Data): void => {
      void data;
    };
    this.onReconnect = (): void => {
      // Empty function, can be set by the user.
    };
  }

  async send(data: string | Buffer) {
    this.logger?.info(`Sending message`);

    await this.waitForMaybeReadyWebSocket();

    if (this.wsClient === undefined) {
      this.logger?.error(
        "Couldn't connect to the websocket server. Error callback is called.",
      );
    } else {
      this.wsClient.send(data);
    }
  }

  async startWebSocket(): Promise<void> {
    if (this.wsClient !== undefined) {
      // If there's an existing connection attempt, wait for it
      if (this.connectionPromise) {
        return this.connectionPromise;
      }
      return;
    }

    this.logger?.info(`Creating Web Socket client`);

    // Create a new promise for this connection attempt
    this.connectionPromise = new Promise((resolve, reject) => {
      this.resolveConnection = resolve;
      this.rejectConnection = reject;
    });

    // Set a connection timeout
    const timeoutId = setTimeout(() => {
      if (this.rejectConnection) {
        this.rejectConnection(
          new Error(`Connection timeout after ${String(CONNECTION_TIMEOUT)}ms`),
        );
      }
    }, CONNECTION_TIMEOUT);

    this.wsClient = new WebSocket(this.endpoint, this.wsOptions);
    this.wsUserClosed = false;

    this.wsClient.addEventListener("open", () => {
      this.wsFailedAttempts = 0;
      this.resetHeartbeat();
      clearTimeout(timeoutId);
      this._isReconnecting = false;
      this.resolveConnection?.();
    });

    this.wsClient.addEventListener("error", (event) => {
      this.onError(event);
      if (this.rejectConnection) {
        this.rejectConnection(new Error("WebSocket connection failed"));
      }
    });

    this.wsClient.addEventListener("message", (event) => {
      this.resetHeartbeat();
      this.onMessage(event.data);
    });

    this.wsClient.addEventListener("close", () => {
      clearTimeout(timeoutId);
      if (this.rejectConnection) {
        this.rejectConnection(new Error("WebSocket closed before connecting"));
      }
      void this.handleClose();
    });

    if ("on" in this.wsClient) {
      this.wsClient.on("ping", () => {
        this.logger?.info("Ping received");
        this.resetHeartbeat();
      });
    }

    return this.connectionPromise;
  }

  private resetHeartbeat(): void {
    if (this.heartbeatTimeout !== undefined) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      this.logger?.warn("Connection timed out. Reconnecting...");
      this.wsClient?.terminate();
      void this.restartUnexpectedClosedWebsocket();
    }, HEARTBEAT_TIMEOUT_DURATION);
  }

  private async waitForMaybeReadyWebSocket(): Promise<void> {
    let waitedTime = 0;
    while (
      this.wsClient !== undefined &&
      this.wsClient.readyState !== this.wsClient.OPEN
    ) {
      if (waitedTime > 5000) {
        this.wsClient.close();
        return;
      } else {
        waitedTime += 10;
        await sleep(10);
      }
    }
  }

  private async handleClose(): Promise<void> {
    if (this.heartbeatTimeout !== undefined) {
      clearTimeout(this.heartbeatTimeout);
    }

    if (this.wsUserClosed) {
      this.logger?.info("The connection has been closed successfully.");
    } else {
      this.wsFailedAttempts += 1;
      this.wsClient = undefined;
      this.connectionPromise = undefined;
      this.resolveConnection = undefined;
      this.rejectConnection = undefined;

      const waitTime = expoBackoff(this.wsFailedAttempts);

      this._isReconnecting = true;
      this.logger?.error(
        "Connection closed unexpectedly or because of timeout. Reconnecting after " +
          String(waitTime) +
          "ms.",
      );

      await sleep(waitTime);
      await this.restartUnexpectedClosedWebsocket();
    }
  }

  private async restartUnexpectedClosedWebsocket(): Promise<void> {
    if (this.wsUserClosed) {
      return;
    }

    await this.startWebSocket();
    await this.waitForMaybeReadyWebSocket();

    if (this.wsClient === undefined) {
      this.logger?.error(
        "Couldn't reconnect to websocket. Error callback is called.",
      );
      return;
    }

    this.onReconnect();
  }

  closeWebSocket(): void {
    if (this.wsClient !== undefined) {
      const client = this.wsClient;
      this.wsClient = undefined;
      this.connectionPromise = undefined;
      this.resolveConnection = undefined;
      this.rejectConnection = undefined;
      client.close();
    }
    this.wsUserClosed = true;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expoBackoff(attempts: number): number {
  return 2 ** attempts * 100;
}
