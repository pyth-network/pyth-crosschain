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
import { validate, ValidationError, Joi, schema } from "express-validation";

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
    
    const latestVaaBytesInputSchema: schema = {
      query: Joi.object({
        id: Joi.string().regex(/^[a-f0-9]{64}$/)
      })
    }
    app.get("/latest_vaa_bytes", validate(latestVaaBytesInputSchema), (req: Request, res: Response) => {
      let priceId = req.query.id as string;

      let latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(priceId);

      if (latestPriceInfo === undefined) {
        res.sendStatus(StatusCodes.BAD_REQUEST);
        return;
      }

      const freshness: DurationInSec = (new Date).getTime() / 1000 - latestPriceInfo.receiveTime;
      this.promClient?.addApiRequestsPriceFreshness(req.path, priceId, freshness);

      res.send(latestPriceInfo.vaaBytes);
    });
    endpoints.push("latest_vaa_bytes?id=<price_feed_id>");

    const latestPriceFeedInputSchema: schema = {
      query: Joi.object({
        id: Joi.array().items(Joi.string().regex(/^[a-f0-9]{64}$/))
      })
    }
    app.get("/latest_price_feed", validate(latestPriceFeedInputSchema), (req: Request, res: Response) => {
      let priceIds = req.query.id as string[];

      let responseJson = [];

      for (let id of priceIds) {
        let latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(id);

        if (latestPriceInfo === undefined) {
          res.status(StatusCodes.BAD_REQUEST).send(`Price Feed with id ${id} not found`);
          return;
        }

        const freshness: DurationInSec = (new Date).getTime() / 1000 - latestPriceInfo.receiveTime;
        this.promClient?.addApiRequestsPriceFreshness(req.path, id, freshness);

        responseJson.push(latestPriceInfo.priceFeed.toJson());
      }

      res.json(responseJson);
    });
    endpoints.push("latest_price_feed?id[]=<price_feed_id>&id[]=<price_feed_id_2>&..");


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

    app.use(function(err: any, _: Request, res: Response, next: NextFunction) {
      if (err instanceof ValidationError) {
        return res.status(err.statusCode).json(err);
      }
    
      return next(err);
    })
  }
}
