import express from "express";
import cors from "cors";
import morgan from "morgan";
import responseTime from "response-time";
import { Request, Response, NextFunction } from "express";
import { PriceFeedPriceInfo } from "./listen";
import { logger } from "./logging";
import { PromClient } from "./promClient";
import { DurationInMs, DurationInSec } from "./helpers";
import { StatusCodes } from "http-status-codes";

const MORGAN_LOG_FORMAT = ':remote-addr - :remote-user ":method :url HTTP/:http-version"' +
  ' :status :res[content-length] :response-time ms ":referrer" ":user-agent"';

export class RestAPI {
  private port: number;
  private priceFeedVaaInfo: PriceFeedPriceInfo;
  private isReady: (() => boolean) | undefined;
  private promClient: PromClient | undefined;

  constructor(config: { port: number; },
    priceFeedVaaInfo: PriceFeedPriceInfo,
    isReady?: () => boolean,
    promClient?: PromClient) {
    this.port = config.port;
    this.priceFeedVaaInfo = priceFeedVaaInfo;
    this.isReady = isReady;
    this.promClient = promClient;
  }

  // Run this function without blocking (`await`) if you want to run it async.
  async run() {
    const app = express();
    app.use(cors());

    const winstonStream = {
      write: (text: string) => {
        logger.info(text);
      }
    };

    app.use(morgan(MORGAN_LOG_FORMAT, { stream: winstonStream }));

    app.use(responseTime((req: Request, res: Response, time: DurationInMs) => {
      if (res.statusCode == StatusCodes.NOT_FOUND) {
        this.promClient?.addResponseTime('/not_found', res.statusCode, time);
      } else {
        this.promClient?.addResponseTime(req.path, res.statusCode, time);
      }
    }))

    app.listen(this.port, () =>
      logger.debug("listening on REST port " + this.port)
    );

    let endpoints: string[] = [];

    app.get("/latest_vaa_bytes/:price_feed_id", (req: Request, res: Response) => {
      let latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(req.params.price_feed_id);

      if (latestPriceInfo === undefined) {
        res.sendStatus(StatusCodes.BAD_REQUEST);
        return;
      }

      const freshness: DurationInSec = (new Date).getTime() / 1000 - latestPriceInfo.receiveTime;
      this.promClient?.addApiRequestsPriceFreshness(req.path, freshness);

      res.send(latestPriceInfo.vaaBytes);
    });
    endpoints.push("latest_vaa_bytes/<price_feed_id>");

    // It will be called with query param `id` such as: `/latest_price_feed?id=xyz&id=abc
    app.get("/latest_price_feed", (req: Request, res: Response) => {
      if (req.query.id === undefined) {
        res.status(StatusCodes.BAD_REQUEST).send("No id is provided");
        return;
      }

      let priceIds: string[] = [];
      if (typeof (req.query.id) === "string") {
        priceIds.push(req.query.id);
      } else if (Array.isArray(req.query.id)) {
        for (let entry of req.query.id) {
          if (typeof (entry) === "string") {
            priceIds.push(entry);
          } else {
            res.status(StatusCodes.BAD_REQUEST).send("id is expected to be a hex string or an array of hex strings");
            return;
          }
        }
      } else {
        res.status(StatusCodes.BAD_REQUEST).send("id is expected to be a hex string or an array of hex strings");
        return;
      }

      let responseJson = [];

      for (let id of priceIds) {
        let latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(id);

        if (latestPriceInfo === undefined) {
          res.status(StatusCodes.BAD_REQUEST).send(`Price Feed with id ${id} not found`);
          return;
        }

        const freshness: DurationInSec = (new Date).getTime() / 1000 - latestPriceInfo.receiveTime;
        this.promClient?.addApiRequestsPriceFreshness(req.path, freshness);

        responseJson.push(latestPriceInfo.priceFeed.toJson());
      }

      res.json(responseJson);
    });
    endpoints.push("latest_price_feed/<price_feed_id>");


    app.get("/ready", (_, res: Response) => {
      if (this.isReady!()) {
        res.sendStatus(StatusCodes.OK);
      } else {
        res.sendStatus(StatusCodes.SERVICE_UNAVAILABLE);
      }
    });
    endpoints.push('ready');

    app.get("/live", (_, res: Response) => {
      res.sendStatus(StatusCodes.OK);
    });
    endpoints.push("live");


    app.get("/", (_, res: Response) =>
      res.json(endpoints)
    );
  }
}
