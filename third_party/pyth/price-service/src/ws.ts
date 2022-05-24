import { HexString, PriceFeed } from "@pythnetwork/pyth-sdk-js";
import express from "express";
import * as http from 'http';
import Joi from "joi";
import WebSocket, { RawData, WebSocketServer } from "ws";
import { PriceFeedPriceInfo } from "./listen";
import { logger } from "./logging";
import { PromClient } from "./promClient";


const ClientMessageSchema: Joi.Schema = Joi.object({
  type: Joi.string().valid("subscribe", "unsubscribe").required(),
  ids: Joi.array().items(Joi.string().regex(/^(0x)?[a-f0-9]{64}$/)).required(),
}).required();

export type ClientMessage = {
  type: "subscribe" | "unsubscribe",
  ids: HexString[],
}

export type ServerResponse = {
  type: "response",
  status: "success" | "error",
  error?: string
}

export type ServerPriceUpdate = {
  type: "price_update",
  price_feed: any,
}

export type ServerMessage = ServerResponse | ServerPriceUpdate;


export class WebSocketAPI {
  private wsCounter: number;
  private port: number;
  private priceFeedClients: Map<HexString, Set<WebSocket>>;
  private aliveClients: Set<WebSocket>;
  private wsId: Map<WebSocket, number>;
  private priceFeedVaaInfo: PriceFeedPriceInfo;
  private promClient: PromClient | undefined;

  constructor(
    config: { port: number; },
    priceFeedVaaInfo: PriceFeedPriceInfo,
    promClient?: PromClient,
  ) {
    this.port = config.port;
    this.priceFeedVaaInfo = priceFeedVaaInfo;
    this.priceFeedClients = new Map();
    this.aliveClients = new Set();
    this.wsCounter = 0;
    this.wsId = new Map();
    this.promClient = promClient;
  }

  private addPriceFeedClient(ws: WebSocket, id: HexString) {
    if (!this.priceFeedClients.has(id)) {
      this.priceFeedClients.set(id, new Set());
    }

    this.priceFeedClients.get(id)!.add(ws);
  }

  private delPriceFeedClient(ws: WebSocket, id: HexString) {
    this.priceFeedClients.get(id)?.delete(ws);
  }

  dispatchPriceFeedUpdate(priceFeed: PriceFeed) {
    if (this.priceFeedClients.get(priceFeed.id) === undefined) {
      logger.info(`Sending ${priceFeed.id} price update to no clients.`)
      return;
    }

    logger.info(`Sending ${priceFeed.id} price update to ${this.priceFeedClients.get(priceFeed.id)!.size} clients`)

    for (let client of this.priceFeedClients.get(priceFeed.id)!.values()) {
      logger.info(`Sending ${priceFeed.id} price update to client ${this.wsId.get(client)}`)
      this.promClient?.addWebSocketInteraction("server_update", "ok");

      let priceUpdate: ServerPriceUpdate = {
        type: "price_update",
        price_feed: priceFeed.toJson(),
      };

      client.send(JSON.stringify(priceUpdate));
    }
  }

  clientClose(ws: WebSocket) {
    for (let clients of this.priceFeedClients.values()) {
      if (clients.has(ws)) {
        clients.delete(ws);
      }
    }

    this.aliveClients.delete(ws);
    this.wsId.delete(ws);
  }

  handleMessage(ws: WebSocket, data: RawData) {
    try {
      let jsonData = JSON.parse(data.toString());
      let validationResult = ClientMessageSchema.validate(jsonData);
      if (validationResult.error !== undefined) {
        throw validationResult.error;
      }

      let message = jsonData as ClientMessage;

      const availableIds = this.priceFeedVaaInfo.getPriceIds();
      let notFoundIds = message.ids.filter((id) => !availableIds.has(id));

      if (notFoundIds.length > 0) {
        throw new Error(`Price Feeds with ids ${notFoundIds.join(', ')} not found`)
      }

      if (message.type == "subscribe") {
        message.ids.forEach( id => this.addPriceFeedClient(ws, id) );
      } else {
        message.ids.forEach( id => this.delPriceFeedClient(ws, id) );
      }
    } catch (e: any) {
      let response: ServerResponse = {
        type: "response",
        status: "error",
        error: e.message
      };
      
      logger.info(`Invalid request ${data.toString()} from client ${this.wsId.get(ws)}`);
      this.promClient?.addWebSocketInteraction("client_message", "err");

      ws.send(JSON.stringify(response));
      return;
    }

    logger.info(`Successful request ${data.toString()} from client ${this.wsId.get(ws)}`);
    this.promClient?.addWebSocketInteraction("client_message", "ok");

    let response: ServerResponse = {
      type: "response",
      status: "success",
    }
    
    ws.send(JSON.stringify(response));
  }

  run(): [WebSocketServer, http.Server] {
    const app = express();
    const server = http.createServer(app);

    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
      logger.info(`Incoming ws connection from ${request.socket.remoteAddress}, assigned id: ${this.wsCounter}`)

      this.wsId.set(ws, this.wsCounter);
      this.wsCounter += 1;

      ws.on("message", (data: RawData) => this.handleMessage(ws, data));

      this.aliveClients.add(ws);

      ws.on("pong", (_data) => {
        this.aliveClients.add(ws);
      });

      ws.on("close", (_code: number, _reason: Buffer) => {
        logger.info(`client ${this.wsId.get(ws)} closed the connection.`);
        this.promClient?.addWebSocketInteraction("close", "ok");

        this.clientClose(ws);
      });

      this.promClient?.addWebSocketInteraction("connection", "ok");
    });

    const pingInterval = setInterval( () => {
      wss.clients.forEach( ws => {
        if ( this.aliveClients.has(ws) === false) {
          logger.info(`client ${this.wsId.get(ws)} timed out. terminating connection`);
          this.promClient?.addWebSocketInteraction("timeout", "ok");
          this.clientClose(ws);
          ws.terminate();
          return;
        }
    
        this.aliveClients.delete(ws);
        ws.ping();
      });
    }, 30000);
    
    wss.on('close', () => {
      clearInterval(pingInterval);
    });
    
    server.listen(this.port, () =>
      logger.debug("listening on WS port " + this.port)
    );
    this.priceFeedVaaInfo.addUpdateListener(this.dispatchPriceFeedUpdate.bind(this));
    return [wss, server];
  }
}
