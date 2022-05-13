import { HexString, PriceFeed } from "@pythnetwork/pyth-sdk-js";
import express from "express";
import * as http from 'http';
import Joi from "joi";
import WebSocket, { RawData, WebSocketServer } from "ws";
import { PriceFeedPriceInfo } from "./listen";
import { logger } from "./logging";


const ClientMessageSchema: Joi.Schema = Joi.object({
  type: Joi.string().valid("subscribe", "unsubscribe").required(),
  ids: Joi.array().items(Joi.string().regex(/^(0x)?[a-f0-9]{64}$/)).required(),
});

type ClientMessage = {
  type: "subscribe" | "unsubscribe",
  ids: HexString[],
}

type ServerResponse = {
  type: "response",
  status: "success" | "error",
  error?: string
}

type ServerPriceUpdate = {
  type: "price_update",
  price_feed: any[],
}

type ServerMessage = ServerResponse | ServerPriceUpdate;


export class WebSocketAPI {
  private port: number;
  private priceFeedClients: Map<HexString, Set<WebSocket>>;
  private aliveClients: Set<WebSocket>;
  private priceFeedVaaInfo: PriceFeedPriceInfo;

  constructor(
    config: { port: number; },
    priceFeedVaaInfo: PriceFeedPriceInfo
  ) {
    this.port = config.port;
    this.priceFeedVaaInfo = priceFeedVaaInfo;
    this.priceFeedClients = new Map();
    this.aliveClients = new Set();
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

  dispatchPriceFeedUpdates(priceFeed: PriceFeed) {
    if (this.priceFeedClients.get(priceFeed.id) === undefined) {
      return;
    }

    logger.info(`Sending ${priceFeed.id} price update to ${this.priceFeedClients.get(priceFeed.id)!.size} clients`)

    for (let client of this.priceFeedClients.get(priceFeed.id)!.values()) {
      let priceUpdate: ServerPriceUpdate = {
        type: "price_update",
        price_feed: priceFeed.toJson(),
      };

      client.send(JSON.stringify(priceUpdate));
    }
  }

  clientClose(ws: WebSocket) {
    for( let clients of this.priceFeedClients.values() ) {
      if (clients.has(ws)) {
        clients.delete(ws);
      }
    }
  }

  handleMessage(ws: WebSocket, data: RawData) {
    logger.info(`Received message ${data.toString()}`);
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
      
      ws.send(JSON.stringify(response));
      return;
    }

    let response: ServerResponse = {
      type: "response",
      status: "success",
    }
    
    ws.send(JSON.stringify(response));
  }

  createServer(): http.Server {
    const app = express();
    const server = http.createServer(app);

    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
      logger.info(`Incoming ws connection from ${request}: ${ws}`)

      ws.on("message", (data: RawData) => this.handleMessage(ws, data));

      this.aliveClients.add(ws);

      ws.on("pong", (_data) => {
        this.aliveClients.add(ws);
      });

      ws.on("close", (_code: number, _reason: Buffer) => {
        this.aliveClients.delete(ws);
        this.clientClose(ws);
        console.log(`Connection with a client closed`);
      });
    });

    const pingInterval = setInterval( () => {
      wss.clients.forEach( ws => {
        if ( this.aliveClients.has(ws) === false) return ws.terminate();
    
        logger.info("A client timed out. terminating connection");
        this.aliveClients.delete(ws);
        ws.ping();
      });
    }, 30000);
    
    wss.on('close', () => {
      clearInterval(pingInterval);
    });
    
    return server;
  }

  async run() {
    let server = this.createServer();
    server.listen(this.port, () =>
      logger.debug("listening on WS port " + this.port)
    );
    this.priceFeedVaaInfo.addUpdateListener(this.dispatchPriceFeedUpdates.bind(this));
  }
}
