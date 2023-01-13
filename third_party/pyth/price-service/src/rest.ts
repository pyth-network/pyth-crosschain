import { HexString } from "@pythnetwork/pyth-sdk-js";
import cors from "cors";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import express, { NextFunction, Request, Response } from "express";
import { Joi, schema, validate, ValidationError } from "express-validation";
import { Server } from "http";
import { StatusCodes } from "http-status-codes";
import morgan from "morgan";
import fetch from "node-fetch";
import { envOrErr, TimestampInSec } from "./helpers";
import { PriceStore } from "./listen";
import { logger } from "./logging";
import { PromClient } from "./promClient";
dotenv.config();

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
  private dbApiEndpoint?: string;
  private dbApiCluster?: string;

  constructor(
    config: { port: number, dbApiEndpoint?: string, dbApiCluster?: string },
    priceFeedVaaInfo: PriceStore,
    isReady?: () => boolean,
    promClient?: PromClient,
  ) {
    this.port = config.port;
    this.dbApiEndpoint = config.dbApiEndpoint;
    this.dbApiCluster = config.dbApiCluster;
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

    const endpoints: string[] = [];

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
        const priceIds = req.query.ids as string[];

        // Multiple price ids might share same vaa, we use sequence number as
        // key of a vaa and deduplicate using a map of seqnum to vaa bytes.
        const vaaMap = new Map<number, Buffer>();

        const notFoundIds: string[] = [];

        for (let id of priceIds) {
          if (id.startsWith("0x")) {
            id = id.substring(2);
          }

          const latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(id);

          if (latestPriceInfo === undefined) {
            notFoundIds.push(id);
            continue;
          }

          vaaMap.set(latestPriceInfo.seqNum, latestPriceInfo.vaa);
        }

        if (notFoundIds.length > 0) {
          throw RestException.PriceFeedIdNotFound(notFoundIds);
        }

        const jsonResponse = Array.from(vaaMap.values(), (vaa) =>
          vaa.toString("base64")
        );

        res.json(jsonResponse);
      }
    );
    endpoints.push(
      "api/latest_vaas?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&.."
    );

    const getVaaInputSchema: schema = {
      query: Joi.object({
        id: Joi.string()
          .regex(/^(0x)?[a-f0-9]{64}$/)
          .required(),
        publish_time: Joi.number().required(),
      }).required(),
    };
    app.get(
      "/api/get_vaa",
      validate(getVaaInputSchema),
      (req: Request, res: Response) => {
        const priceFeedId = req.query.id as string;
        const publishTime = Number(req.query.publish_time as string);
        const vaa = this.priceFeedVaaInfo.getVaa(priceFeedId, publishTime);
        // if publishTime is older than cache ttl or vaa is not found, fetch from db
        if (!vaa) {
          // cache miss
          if (this.dbApiEndpoint && this.dbApiCluster) {
            fetch(
              `${this.dbApiEndpoint}/vaa?id=${priceFeedId}&publishTime=${publishTime}&cluster=${this.dbApiCluster}`
            )
              .then((r: any) => r.json())
              .then((arr: any) => {
                if (arr.length > 0 && arr[0]) {
                  res.json(arr[0]);
                } else {
                  res.status(StatusCodes.NOT_FOUND).send("VAA not found");
                }
              });
          }
        } else {
          // cache hit
          const processedVaa = {
            publishTime: new Date(vaa.publishTime),
            vaa: vaa.vaa,
          };
          res.json(processedVaa);
        }
      }
    );
    endpoints.push(
      "api/get_vaa?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>"
    );

    const latestPriceFeedsInputSchema: schema = {
      query: Joi.object({
        ids: Joi.array()
          .items(Joi.string().regex(/^(0x)?[a-f0-9]{64}$/))
          .required(),
        verbose: Joi.boolean(),
        binary: Joi.boolean(),
      }).required(),
    };
    app.get(
      "/api/latest_price_feeds",
      validate(latestPriceFeedsInputSchema),
      (req: Request, res: Response) => {
        const priceIds = req.query.ids as string[];
        // verbose is optional, default to false
        const verbose = req.query.verbose === "true";
        // binary is optional, default to false
        const binary = req.query.binary === "true";

        const responseJson = [];

        const notFoundIds: string[] = [];

        for (let id of priceIds) {
          if (id.startsWith("0x")) {
            id = id.substring(2);
          }

          const latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(id);

          if (latestPriceInfo === undefined) {
            notFoundIds.push(id);
            continue;
          }

          responseJson.push({
            ...latestPriceInfo.priceFeed.toJson(),
            ...(verbose && {
              metadata: {
                emitter_chain: latestPriceInfo.emitterChainId,
                attestation_time: latestPriceInfo.attestationTime,
                sequence_number: latestPriceInfo.seqNum,
                price_service_receive_time:
                  latestPriceInfo.priceServiceReceiveTime,
              },
            }),
            ...(binary && {
              vaa: latestPriceInfo.vaa.toString("base64"),
            }),
          });
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
    endpoints.push(
      "api/latest_price_feeds?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..&verbose=true&binary=true"
    );

    app.get("/api/price_feed_ids", (req: Request, res: Response) => {
      const availableIds = this.priceFeedVaaInfo.getPriceIds();
      res.json([...availableIds]);
    });
    endpoints.push("api/price_feed_ids");

    const staleFeedsInputSchema: schema = {
      query: Joi.object({
        threshold: Joi.number().required(),
      }).required(),
    };
    app.get(
      "/api/stale_feeds",
      validate(staleFeedsInputSchema),
      (req: Request, res: Response) => {
        const stalenessThresholdSeconds = Number(req.query.threshold as string);

        const currentTime: TimestampInSec = Math.floor(Date.now() / 1000);

        const priceIds = [...this.priceFeedVaaInfo.getPriceIds()];
        const stalePrices: Record<HexString, number> = {};

        for (const priceId of priceIds) {
          const latency =
            currentTime -
            this.priceFeedVaaInfo.getLatestPriceInfo(priceId)!.attestationTime;
          if (latency > stalenessThresholdSeconds) {
            stalePrices[priceId] = latency;
          }
        }

        res.json(stalePrices);
      }
    );
    endpoints.push("/api/stale_feeds?threshold=<staleness_threshold_seconds>");

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

    app.use((err: any, _: Request, res: Response, next: NextFunction) => {
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
    const app = await this.createApp();
    return app.listen(this.port, () =>
      logger.debug("listening on REST port " + this.port)
    );
  }
}
