import WebSocket from "isomorphic-ws";
import { Logger } from "ts-log";

const PING_TIMEOUT_DURATION = 30000 + 3000; // It is 30s on the server and 3s is added for delays

/**
 * This class wraps websocket to provide a resilient web socket client.
 *
 * It will reconnect if connection fails with exponential backoff. Also, in node, it will reconnect
 * if it receives no ping request from server within a while as indication of timeout (assuming
 * the server sends it regularly).
 *
 * This class also logs events if logger is given and by replacing onError method you can handle
 * connection errors yourself (e.g: do not retry and close the connection).
 */
export class ResilientWebSocket {
  private endpoint: string;
  private wsClient: undefined | WebSocket;
  private wsUserClosed: boolean;
  private wsFailedAttempts: number;
  private pingTimeout: undefined | NodeJS.Timeout;
  private logger: undefined | Logger;

  onError: (error: Error) => void;
  onMessage: (data: WebSocket.Data) => void;
  onReconnect: () => void;

  constructor(endpoint: string, logger?: Logger) {
    this.endpoint = endpoint;
    this.logger = logger;

    this.wsFailedAttempts = 0;
    this.onError = (error: Error) => {
      this.logger?.error(error);
    };
    this.wsUserClosed = true;
    this.onMessage = () => {};
    this.onReconnect = () => {};
  }

  async send(data: any) {
    this.logger?.info(`Sending ${data}`);

    await this.waitForMaybeReadyWebSocket();

    if (this.wsClient === undefined) {
      this.logger?.error(
        "Couldn't connect to the websocket server. Error callback is called.",
      );
    } else {
      this.wsClient?.send(data);
    }
  }

  async startWebSocket() {
    if (this.wsClient !== undefined) {
      return;
    }

    this.logger?.info(`Creating Web Socket client`);

    this.wsClient = new WebSocket(this.endpoint);
    this.wsUserClosed = false;

    this.wsClient.onopen = () => {
      this.wsFailedAttempts = 0;
      // Ping handler is undefined in browser side so heartbeat is disabled.
      if (this.wsClient!.on !== undefined) {
        this.heartbeat();
      }
    };

    this.wsClient.onerror = (event) => {
      this.onError(event.error);
    };

    this.wsClient.onmessage = (event) => {
      this.onMessage(event.data);
    };

    this.wsClient.onclose = async () => {
      if (this.pingTimeout !== undefined) {
        clearInterval(this.pingTimeout);
      }

      if (this.wsUserClosed === false) {
        this.wsFailedAttempts += 1;
        this.wsClient = undefined;
        const waitTime = expoBackoff(this.wsFailedAttempts);

        this.logger?.error(
          `Connection closed unexpectedly or because of timeout. Reconnecting after ${waitTime}ms.`,
        );

        await sleep(waitTime);
        this.restartUnexpectedClosedWebsocket();
      } else {
        this.logger?.info("The connection has been closed successfully.");
      }
    };

    if (this.wsClient.on !== undefined) {
      // Ping handler is undefined in browser side
      this.wsClient.on("ping", this.heartbeat.bind(this));
    }
  }

  /**
   * Heartbeat is only enabled in node clients because they support handling
   * ping-pong events.
   *
   * This approach only works when server constantly pings the clients which.
   * Otherwise you might consider sending ping and acting on pong responses
   * yourself.
   */
  private heartbeat() {
    this.logger?.info("Heartbeat");

    if (this.pingTimeout !== undefined) {
      clearTimeout(this.pingTimeout);
    }

    this.pingTimeout = setTimeout(() => {
      this.logger?.warn(`Connection timed out. Reconnecting...`);
      this.wsClient?.terminate();
      this.restartUnexpectedClosedWebsocket();
    }, PING_TIMEOUT_DURATION);
  }

  private async waitForMaybeReadyWebSocket() {
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

  private async restartUnexpectedClosedWebsocket() {
    if (this.wsUserClosed === true) {
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

  closeWebSocket() {
    if (this.wsClient !== undefined) {
      const client = this.wsClient;
      this.wsClient = undefined;
      client.close();
    }
    this.wsUserClosed = true;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expoBackoff(attempts: number): number {
  return 2 ** attempts * 100;
}
