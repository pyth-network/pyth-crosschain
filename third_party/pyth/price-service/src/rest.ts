import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { Joi, schema, validate, ValidationError } from "express-validation";
import { Server } from "http";
import { StatusCodes } from "http-status-codes";
import morgan from "morgan";
import responseTime from "response-time";
import { DurationInMs, DurationInSec } from "./helpers";
import { PriceStore } from "./listen";
import { logger } from "./logging";
import { PromClient } from "./promClient";

const MORGAN_LOG_FORMAT =
  ':remote-addr - :remote-user ":method :url HTTP/:http-version"' +
  ' :status :res[content-length] :response-time ms ":referrer" ":user-agent"';

export class RestException extends Error {
  statusCode: number;
  message: string;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
  }

  static PriceFeedIdNotFound(notFoundIds: string[]): RestException {
    return new RestException(
      StatusCodes.BAD_REQUEST,
      `Price Feeds with ids ${notFoundIds.join(", ")} not found`
    );
  }
}

export class RestAPI {
  private port: number;
  private priceFeedVaaInfo: PriceStore;
  private isReady: (() => boolean) | undefined;
  private promClient: PromClient | undefined;

  constructor(
    config: { port: number },
    priceFeedVaaInfo: PriceStore,
    isReady?: () => boolean,
    promClient?: PromClient
  ) {
    this.port = config.port;
    this.priceFeedVaaInfo = priceFeedVaaInfo;
    this.isReady = isReady;
    this.promClient = promClient;
  }

  // Run this function without blocking (`await`) if you want to run it async.
  async createApp() {
    const app = express();
    app.use(cors());

    const winstonStream = {
      write: (text: string) => {
        logger.info(text);
      },
    };

    app.use(morgan(MORGAN_LOG_FORMAT, { stream: winstonStream }));

    app.use(
      responseTime((req: Request, res: Response, time: DurationInMs) => {
        if (res.statusCode !== StatusCodes.NOT_FOUND) {
          this.promClient?.addResponseTime(req.path, res.statusCode, time);
        }
      })
    );

    let endpoints: string[] = [];

    const latestVaasInputSchema: schema = {
      query: Joi.object({
        ids: Joi.array()
          .items(Joi.string().regex(/^(0x)?[a-f0-9]{64}$/))
          .required(),
      }).required(),
    };
    app.get(
      "/api/latest_vaas",
      validate(latestVaasInputSchema),
      (req: Request, res: Response) => {
        let priceIds = req.query.ids as string[];

        // Multiple price ids might share same vaa, we use sequence number as
        // key of a vaa and deduplicate using a map of seqnum to vaa bytes.
        let vaaMap = new Map<number, string>();

        let notFoundIds: string[] = [];

        for (let id of priceIds) {
          if (id.startsWith("0x")) {
            id = id.substring(2);
          }

          let latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(id);

          if (latestPriceInfo === undefined) {
            notFoundIds.push(id);
            continue;
          }

          const freshness: DurationInSec =
            new Date().getTime() / 1000 - latestPriceInfo.attestationTime;
          this.promClient?.addApiRequestsPriceFreshness(
            req.path,
            id,
            freshness
          );

          vaaMap.set(latestPriceInfo.seqNum, latestPriceInfo.vaaBytes);
        }

        if (notFoundIds.length > 0) {
          throw RestException.PriceFeedIdNotFound(notFoundIds);
        }

        const jsonResponse = Array.from(vaaMap.values(), (vaaBytes) =>
          Buffer.from(vaaBytes, "binary").toString("base64")
        );

        res.json(jsonResponse);
      }
    );
    endpoints.push(
      "api/latest_vaas?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&.."
    );

    const latestPriceFeedsInputSchema: schema = {
      query: Joi.object({
        ids: Joi.array()
          .items(Joi.string().regex(/^(0x)?[a-f0-9]{64}$/))
          .required(),
        verbose: Joi.boolean(),
      }).required(),
    };
    app.get(
      "/api/latest_price_feeds",
      validate(latestPriceFeedsInputSchema),
      (req: Request, res: Response) => {
        let priceIds = req.query.ids as string[];
        // verbose is optional, default to false
        let verbose = req.query.verbose === "true";

        let responseJson = [];

        let notFoundIds: string[] = [];

        for (let id of priceIds) {
          if (id.startsWith("0x")) {
            id = id.substring(2);
          }

          let latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(id);

          if (latestPriceInfo === undefined) {
            notFoundIds.push(id);
            continue;
          }

          const freshness: DurationInSec =
            new Date().getTime() / 1000 - latestPriceInfo.attestationTime;
          this.promClient?.addApiRequestsPriceFreshness(
            req.path,
            id,
            freshness
          );

          if (verbose) {
            responseJson.push({
              ...latestPriceInfo.priceFeed.toJson(),
              metadata: {
                emitter_chain: latestPriceInfo.emitterChainId,
                attestation_time: latestPriceInfo.attestationTime,
                sequence_number: latestPriceInfo.seqNum,
              },
            });
          } else {
            responseJson.push(latestPriceInfo.priceFeed.toJson());
          }
        }

        if (notFoundIds.length > 0) {
          throw RestException.PriceFeedIdNotFound(notFoundIds);
        }

        res.json(responseJson);
      }
    );
    endpoints.push(
      "api/latest_price_feeds?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&.."
    );
    endpoints.push(
      "api/latest_price_feeds?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..&verbose=true"
    );

    app.get("/api/price_feed_ids", (req: Request, res: Response) => {
      const availableIds = this.priceFeedVaaInfo.getPriceIds();
      res.json([...availableIds]);
    });
    endpoints.push("api/price_feed_ids");

    app.get("/ready", (_, res: Response) => {
      if (this.isReady!()) {
        res.sendStatus(StatusCodes.OK);
      } else {
        res.sendStatus(StatusCodes.SERVICE_UNAVAILABLE);
      }
    });
    endpoints.push("ready");

    app.get("/live", (_, res: Response) => {
      res.sendStatus(StatusCodes.OK);
    });
    endpoints.push("live");

    // Websocket endpoint
    endpoints.push("ws");

    app.get("/", (_, res: Response) => res.json(endpoints));

    app.use(function (err: any, _: Request, res: Response, next: NextFunction) {
      if (err instanceof ValidationError) {
        return res.status(err.statusCode).json(err);
      }

      if (err instanceof RestException) {
        return res.status(err.statusCode).json(err);
      }

      return next(err);
    });

    return app;
  }

  async run(): Promise<Server> {
    let app = await this.createApp();
    return app.listen(this.port, () =>
      logger.debug("listening on REST port " + this.port)
    );
  }
}
