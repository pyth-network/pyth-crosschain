import { HexString } from "@pythnetwork/price-service-sdk";
import * as http from "http";
import Joi from "joi";
import WebSocket, { RawData, WebSocketServer } from "ws";
import { PriceInfo, PriceStore } from "./listen";
import { logger } from "./logging";
import { PromClient } from "./promClient";

const ClientMessageSchema: Joi.Schema = Joi.object({
  type: Joi.string().valid("subscribe", "unsubscribe").required(),
  ids: Joi.array()
    .items(Joi.string().regex(/^(0x)?[a-f0-9]{64}$/))
    .required(),
  verbose: Joi.boolean(),
  binary: Joi.boolean(),
}).required();

export type ClientMessage = {
  type: "subscribe" | "unsubscribe";
  ids: HexString[];
  verbose?: boolean;
  binary?: boolean;
};

export type ServerResponse = {
  type: "response";
  status: "success" | "error";
  error?: string;
};

export type ServerPriceUpdate = {
  type: "price_update";
  price_feed: any;
};

export type PriceFeedConfig = {
  verbose: boolean;
  binary: boolean;
};

export type ServerMessage = ServerResponse | ServerPriceUpdate;

export class WebSocketAPI {
  private wsCounter: number;
  private priceFeedClients: Map<HexString, Set<WebSocket>>;
  private priceFeedClientsConfig: Map<
    HexString,
    Map<WebSocket, PriceFeedConfig>
  >;
  private aliveClients: Set<WebSocket>;
  private wsId: Map<WebSocket, number>;
  private priceFeedVaaInfo: PriceStore;
  private promClient: PromClient | undefined;

  constructor(priceFeedVaaInfo: PriceStore, promClient?: PromClient) {
    this.priceFeedVaaInfo = priceFeedVaaInfo;
    this.priceFeedClients = new Map();
    this.priceFeedClientsConfig = new Map();
    this.aliveClients = new Set();
    this.wsCounter = 0;
    this.wsId = new Map();
    this.promClient = promClient;
  }

  private addPriceFeedClient(
    ws: WebSocket,
    id: HexString,
    verbose: boolean = false,
    binary: boolean = false
  ) {
    if (!this.priceFeedClients.has(id)) {
      this.priceFeedClients.set(id, new Set());
      this.priceFeedClientsConfig.set(id, new Map([[ws, { verbose, binary }]]));
    } else {
      this.priceFeedClientsConfig.get(id)!.set(ws, { verbose, binary });
    }
    this.priceFeedClients.get(id)!.add(ws);
  }

  private delPriceFeedClient(ws: WebSocket, id: HexString) {
    if (!this.priceFeedClients.has(id)) {
      return;
    }
    this.priceFeedClients.get(id)!.delete(ws);
    this.priceFeedClientsConfig.get(id)!.delete(ws);
  }

  dispatchPriceFeedUpdate(priceInfo: PriceInfo) {
    if (this.priceFeedClients.get(priceInfo.priceFeed.id) === undefined) {
      logger.info(
        `Sending ${priceInfo.priceFeed.id} price update to no clients.`
      );
      return;
    }

    const clients: Set<WebSocket> = this.priceFeedClients.get(
      priceInfo.priceFeed.id
    )!;
    logger.info(
      `Sending ${priceInfo.priceFeed.id} price update to ${
        clients.size
      } clients: ${Array.from(clients.values()).map((ws, _idx, _arr) =>
        this.wsId.get(ws)
      )}`
    );

    for (const client of clients.values()) {
      this.promClient?.addWebSocketInteraction("server_update", "ok");

      const config = this.priceFeedClientsConfig
        .get(priceInfo.priceFeed.id)!
        .get(client);

      const verbose = config?.verbose;
      const binary = config?.binary;

      const priceUpdate: ServerPriceUpdate = {
        type: "price_update",
        price_feed: {
          ...priceInfo.priceFeed.toJson(),
          ...(verbose && {
            metadata: {
              emitter_chain: priceInfo.emitterChainId,
              attestation_time: priceInfo.attestationTime,
              sequence_number: priceInfo.seqNum,
              price_service_receive_time: priceInfo.priceServiceReceiveTime,
            },
          }),
          ...(binary && {
            vaa: priceInfo.vaa.toString("base64"),
          }),
        },
      };

      client.send(JSON.stringify(priceUpdate));
    }
  }

  clientClose(ws: WebSocket) {
    for (const clients of this.priceFeedClients.values()) {
      if (clients.has(ws)) {
        clients.delete(ws);
      }
    }

    this.aliveClients.delete(ws);
    this.wsId.delete(ws);
  }

  handleMessage(ws: WebSocket, data: RawData) {
    try {
      const jsonData = JSON.parse(data.toString());
      const validationResult = ClientMessageSchema.validate(jsonData);
      if (validationResult.error !== undefined) {
        throw validationResult.error;
      }

      const message = jsonData as ClientMessage;

      message.ids = message.ids.map((id) => {
        if (id.startsWith("0x")) {
          return id.substring(2);
        }
        return id;
      });

      const availableIds = this.priceFeedVaaInfo.getPriceIds();
      const notFoundIds = message.ids.filter((id) => !availableIds.has(id));

      if (notFoundIds.length > 0) {
        throw new Error(
          `Price Feeds with ids ${notFoundIds.join(", ")} not found`
        );
      }

      if (message.type === "subscribe") {
        message.ids.forEach((id) =>
          this.addPriceFeedClient(
            ws,
            id,
            message.verbose === true,
            message.binary === true
          )
        );
      } else {
        message.ids.forEach((id) => this.delPriceFeedClient(ws, id));
      }
    } catch (e: any) {
      const errorResponse: ServerResponse = {
        type: "response",
        status: "error",
        error: e.message,
      };

      logger.info(
        `Invalid request ${data.toString()} from client ${this.wsId.get(ws)}`
      );
      this.promClient?.addWebSocketInteraction("client_message", "err");

      ws.send(JSON.stringify(errorResponse));
      return;
    }

    logger.info(
      `Successful request ${data.toString()} from client ${this.wsId.get(ws)}`
    );
    this.promClient?.addWebSocketInteraction("client_message", "ok");

    const response: ServerResponse = {
      type: "response",
      status: "success",
    };

    ws.send(JSON.stringify(response));
  }

  run(server: http.Server): WebSocketServer {
    const wss = new WebSocketServer({
      server,
      path: "/ws",
      maxPayload: 100 * 1024, // 100 KiB
    });

    wss.on("connection", (ws: WebSocket, request: http.IncomingMessage) => {
      logger.info(
        `Incoming ws connection from ${request.socket.remoteAddress}, assigned id: ${this.wsCounter}`
      );

      this.wsId.set(ws, this.wsCounter);
      this.wsCounter += 1;

      ws.on("message", (data: RawData) => this.handleMessage(ws, data));

      this.aliveClients.add(ws);

      ws.on("pong", (_data) => {
        this.aliveClients.add(ws);
      });

      ws.on("error", (err: Error) => {
        logger.warn(`Err with client ${this.wsId.get(ws)}: ${err}`);
      });

      ws.on("close", (_code: number, _reason: Buffer) => {
        logger.info(`client ${this.wsId.get(ws)} closed the connection.`);
        this.promClient?.addWebSocketInteraction("close", "ok");

        this.clientClose(ws);
      });

      this.promClient?.addWebSocketInteraction("connection", "ok");
    });

    const pingInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (this.aliveClients.has(ws) === false) {
          logger.info(
            `client ${this.wsId.get(ws)} timed out. terminating connection`
          );
          this.promClient?.addWebSocketInteraction("timeout", "ok");
          this.clientClose(ws);
          ws.terminate();
          return;
        }

        this.aliveClients.delete(ws);
        ws.ping();
      });
    }, 30000);

    wss.on("close", () => {
      clearInterval(pingInterval);
    });

    this.priceFeedVaaInfo.addUpdateListener(
      this.dispatchPriceFeedUpdate.bind(this)
    );

    return wss;
  }
}
