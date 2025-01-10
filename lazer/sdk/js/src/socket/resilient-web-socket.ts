import type { ClientRequestArgs } from "node:http";

import WebSocket, { type ClientOptions, type ErrorEvent } from "isomorphic-ws";
import type { Logger } from "ts-log";

// Reconnect with expo backoff if we don't get a message or ping for 10 seconds
const HEARTBEAT_TIMEOUT_DURATION = 10_000;

/**
 * This class wraps websocket to provide a resilient web socket client.
 *
 * It will reconnect if connection fails with exponential backoff. Also, it will reconnect
 * if it receives no ping request or regular message from server within a while as indication
 * of timeout (assuming the server sends either regularly).
 *
 * This class also logs events if logger is given and by replacing onError method you can handle
 * connection errors yourself (e.g: do not retry and close the connection).
 */
export class ResilientWebSocket {
  endpoint: string;
  wsClient: undefined | WebSocket;
  wsUserClosed: boolean;
  private wsOptions: ClientOptions | ClientRequestArgs | undefined;
  private wsFailedAttempts: number;
  private heartbeatTimeout: undefined | NodeJS.Timeout;
  private logger: undefined | Logger;

  onError: (error: ErrorEvent) => void;
  onMessage: (data: WebSocket.Data) => void;
  onReconnect: () => void;
  constructor(
    endpoint: string,
    wsOptions?: ClientOptions | ClientRequestArgs,
    logger?: Logger
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
        "Couldn't connect to the websocket server. Error callback is called."
      );
    } else {
      this.wsClient.send(data);
    }
  }

  startWebSocket(): void {
    if (this.wsClient !== undefined) {
      return;
    }

    this.logger?.info(`Creating Web Socket client`);

    this.wsClient = new WebSocket(this.endpoint, this.wsOptions);
    this.wsUserClosed = false;

    this.wsClient.addEventListener("open", () => {
      this.wsFailedAttempts = 0;
      this.resetHeartbeat();
    });

    this.wsClient.addEventListener("error", (event) => {
      this.onError(event);
    });

    this.wsClient.addEventListener("message", (event) => {
      this.resetHeartbeat();
      this.onMessage(event.data);
    });

    this.wsClient.addEventListener("close", () => {
      void this.handleClose();
    });

    // Handle ping events if supported (Node.js only)
    if ("on" in this.wsClient) {
      // Ping handler is undefined in browser side
      this.wsClient.on("ping", () => {
        this.logger?.info("Ping received");
        this.resetHeartbeat();
      });
    }
  }

  /**
   * Reset the heartbeat timeout. This is called when we receive any message (ping or regular)
   * from the server. If we don't receive any message within HEARTBEAT_TIMEOUT_DURATION,
   * we assume the connection is dead and reconnect.
   */
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
      const waitTime = expoBackoff(this.wsFailedAttempts);

      this.logger?.error(
        "Connection closed unexpectedly or because of timeout. Reconnecting after " +
          String(waitTime) +
          "ms."
      );

      await sleep(waitTime);
      await this.restartUnexpectedClosedWebsocket();
    }
  }

  private async restartUnexpectedClosedWebsocket(): Promise<void> {
    if (this.wsUserClosed) {
      return;
    }

    this.startWebSocket();
    await this.waitForMaybeReadyWebSocket();

    if (this.wsClient === undefined) {
      this.logger?.error(
        "Couldn't reconnect to websocket. Error callback is called."
      );
      return;
    }

    this.onReconnect();
  }

  closeWebSocket(): void {
    if (this.wsClient !== undefined) {
      const client = this.wsClient;
      this.wsClient = undefined;
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
