import { HexString } from "@pythnetwork/price-service-sdk";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { Joi, schema, validate, ValidationError } from "express-validation";
import { Server } from "http";
import { StatusCodes } from "http-status-codes";
import morgan from "morgan";
import fetch from "node-fetch";
import {
  parseBatchPriceAttestation,
  priceAttestationToPriceFeed,
} from "@pythnetwork/wormhole-attester-sdk";
import { removeLeading0x, TimestampInSec } from "./helpers";
import { createPriceInfo, PriceInfo, PriceStore, VaaConfig } from "./listen";
import { logger } from "./logging";
import { PromClient } from "./promClient";
import { retry } from "ts-retry-promise";
import { parseVaa } from "@certusone/wormhole-sdk";
import { getOrElse } from "./helpers";
import {
  TargetChain,
  validTargetChains,
  defaultTargetChain,
  VaaEncoding,
  encodeVaaForChain,
} from "./encoding";

const MORGAN_LOG_FORMAT =
  ':remote-addr - :remote-user ":method :url HTTP/:http-version"' +
  ' :status :res[content-length] :response-time ms ":referrer" ":user-agent"';

// GET argument string to represent the options for target_chain
export const targetChainArgString = `target_chain=<${validTargetChains.join(
  "|"
)}>`;

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
      `Price Feed(s) with id(s) ${notFoundIds.join(", ")} not found.`
    );
  }

  static DbApiError(): RestException {
    return new RestException(StatusCodes.INTERNAL_SERVER_ERROR, `DB API Error`);
  }

  static VaaNotFound(): RestException {
    return new RestException(StatusCodes.NOT_FOUND, "VAA not found.");
  }
}

function asyncWrapper(
  callback: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    callback(req, res, next).catch(next);
  };
}

export type VaaResponse = {
  publishTime: number;
  vaa: string;
};

export class RestAPI {
  private port: number;
  private priceFeedVaaInfo: PriceStore;
  private isReady: (() => boolean) | undefined;
  private promClient: PromClient | undefined;
  private dbApiEndpoint?: string;
  private dbApiCluster?: string;

  constructor(
    config: { port: number; dbApiEndpoint?: string; dbApiCluster?: string },
    priceFeedVaaInfo: PriceStore,
    isReady?: () => boolean,
    promClient?: PromClient
  ) {
    this.port = config.port;
    this.dbApiEndpoint = config.dbApiEndpoint;
    this.dbApiCluster = config.dbApiCluster;
    this.priceFeedVaaInfo = priceFeedVaaInfo;
    this.isReady = isReady;
    this.promClient = promClient;
  }

  async getVaaWithDbLookup(
    priceFeedId: string,
    publishTime: TimestampInSec
  ): Promise<VaaResponse | undefined> {
    // Try to fetch the vaa from the local cache
    const vaaConfig = this.priceFeedVaaInfo.getVaa(priceFeedId, publishTime);
    let vaa: VaaResponse | undefined;

    // if publishTime is older than cache ttl or vaa is not found, fetch from db
    if (vaaConfig !== undefined) {
      vaa = {
        vaa: vaaConfig.vaa,
        publishTime: vaaConfig.publishTime,
      };
    } else if (vaa === undefined && this.dbApiEndpoint && this.dbApiCluster) {
      const priceFeedWithoutLeading0x = removeLeading0x(priceFeedId);

      try {
        const data = (await retry(
          () =>
            fetch(
              `${this.dbApiEndpoint}/vaa?id=${priceFeedWithoutLeading0x}&publishTime=${publishTime}&cluster=${this.dbApiCluster}`
            ).then((res) => res.json()),
          { retries: 3 }
        )) as any[];
        if (data.length > 0) {
          vaa = {
            vaa: data[0].vaa,
            publishTime: Math.floor(
              new Date(data[0].publishTime).getTime() / 1000
            ),
          };
        }
      } catch (e: any) {
        logger.error(`DB API Error: ${e}`);
        throw RestException.DbApiError();
      }
    }

    return vaa;
  }

  vaaToPriceInfo(priceFeedId: string, vaa: Buffer): PriceInfo | undefined {
    const parsedVaa = parseVaa(vaa);

    let batchAttestation;

    try {
      batchAttestation = parseBatchPriceAttestation(
        Buffer.from(parsedVaa.payload)
      );
    } catch (e: any) {
      logger.error(e, e.stack);
      logger.error("Parsing historical VAA failed: %o", parsedVaa);
      return undefined;
    }

    for (const priceAttestation of batchAttestation.priceAttestations) {
      if (priceAttestation.priceId === priceFeedId) {
        return createPriceInfo(
          priceAttestation,
          vaa,
          parsedVaa.sequence,
          parsedVaa.emitterChain
        );
      }
    }

    return undefined;
  }

  priceInfoToJson(
    priceInfo: PriceInfo,
    verbose: boolean,
    targetChain: TargetChain | undefined
  ): object {
    return {
      ...priceInfo.priceFeed.toJson(),
      ...(verbose && {
        metadata: {
          emitter_chain: priceInfo.emitterChainId,
          attestation_time: priceInfo.attestationTime,
          sequence_number: priceInfo.seqNum,
          price_service_receive_time: priceInfo.priceServiceReceiveTime,
        },
      }),
      ...(targetChain !== undefined && {
        vaa: encodeVaaForChain(priceInfo.vaa, targetChain),
      }),
    };
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
        target_chain: Joi.string()
          .valid(...validTargetChains)
          .optional(),
      }).required(),
    };
    app.get(
      "/api/latest_vaas",
      validate(latestVaasInputSchema),
      (req: Request, res: Response) => {
        const priceIds = (req.query.ids as string[]).map(removeLeading0x);
        const targetChain = getOrElse(
          req.query.target_chain as TargetChain | undefined,
          defaultTargetChain
        );

        // Multiple price ids might share same vaa, we use sequence number as
        // key of a vaa and deduplicate using a map of seqnum to vaa bytes.
        const vaaMap = new Map<number, Buffer>();

        const notFoundIds: string[] = [];

        for (const id of priceIds) {
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
          encodeVaaForChain(vaa, targetChain)
        );

        res.json(jsonResponse);
      }
    );
    endpoints.push(
      `api/latest_vaas?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..&${targetChainArgString}`
    );

    const getVaaInputSchema: schema = {
      query: Joi.object({
        id: Joi.string()
          .regex(/^(0x)?[a-f0-9]{64}$/)
          .required(),
        publish_time: Joi.number().required(),
        target_chain: Joi.string()
          .valid(...validTargetChains)
          .optional(),
      }).required(),
    };

    app.get(
      "/api/get_vaa",
      validate(getVaaInputSchema),
      asyncWrapper(async (req: Request, res: Response) => {
        const priceFeedId = removeLeading0x(req.query.id as string);
        const publishTime = Number(req.query.publish_time as string);
        const targetChain = getOrElse(
          req.query.target_chain as TargetChain | undefined,
          defaultTargetChain
        );

        if (
          this.priceFeedVaaInfo.getLatestPriceInfo(priceFeedId) === undefined
        ) {
          throw RestException.PriceFeedIdNotFound([priceFeedId]);
        }

        const vaaConfig = await this.getVaaWithDbLookup(
          priceFeedId,
          publishTime
        );
        if (vaaConfig === undefined) {
          throw RestException.VaaNotFound();
        } else {
          vaaConfig.vaa = encodeVaaForChain(vaaConfig.vaa, targetChain);
          res.json(vaaConfig);
        }
      })
    );

    endpoints.push(
      `api/get_vaa?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>&${targetChainArgString}`
    );

    const getVaaCcipInputSchema: schema = {
      query: Joi.object({
        data: Joi.string()
          .regex(/^0x[a-f0-9]{80}$/)
          .required(),
      }).required(),
    };

    // CCIP compatible endpoint. Read more information about it from
    // https://eips.ethereum.org/EIPS/eip-3668
    app.get(
      "/api/get_vaa_ccip",
      validate(getVaaCcipInputSchema),
      asyncWrapper(async (req: Request, res: Response) => {
        const dataHex = req.query.data as string;
        const data = Buffer.from(removeLeading0x(dataHex), "hex");

        const priceFeedId = data.slice(0, 32).toString("hex");
        const publishTime = Number(data.readBigInt64BE(32));

        if (
          this.priceFeedVaaInfo.getLatestPriceInfo(priceFeedId) === undefined
        ) {
          throw RestException.PriceFeedIdNotFound([priceFeedId]);
        }

        const vaa = await this.getVaaWithDbLookup(priceFeedId, publishTime);

        if (vaa === undefined) {
          // Returning Bad Gateway error because CCIP expects a 5xx error if it needs to
          // retry or try other endpoints. Bad Gateway seems the best choice here as this
          // is not an internal error and could happen on two scenarios:
          // 1. DB Api is not responding well (Bad Gateway is appropriate here)
          // 2. Publish time is a few seconds before current time and a VAA
          //    Will be available in a few seconds. So we want the client to retry.
          res
            .status(StatusCodes.BAD_GATEWAY)
            .json({ "message:": "VAA not found." });
        } else {
          const resData = "0x" + Buffer.from(vaa.vaa, "base64").toString("hex");

          res.json({
            data: resData,
          });
        }
      })
    );

    endpoints.push(
      "api/get_vaa_ccip?data=<0x<price_feed_id_32_bytes>+<publish_time_unix_timestamp_be_8_bytes>>"
    );

    const latestPriceFeedsInputSchema: schema = {
      query: Joi.object({
        ids: Joi.array()
          .items(Joi.string().regex(/^(0x)?[a-f0-9]{64}$/))
          .required(),
        verbose: Joi.boolean(),
        binary: Joi.boolean(),
        target_chain: Joi.string()
          .valid(...validTargetChains)
          .optional(),
      }).required(),
    };
    app.get(
      "/api/latest_price_feeds",
      validate(latestPriceFeedsInputSchema),
      (req: Request, res: Response) => {
        const priceIds = (req.query.ids as string[]).map(removeLeading0x);
        // verbose is optional, default to false
        const verbose = req.query.verbose === "true";
        // The binary and target_chain are somewhat redundant. Binary still exists for backward compatibility reasons.
        // No VAA will be returned if both arguments are omitted. binary=true is the same as target_chain=default
        let targetChain = req.query.target_chain as TargetChain | undefined;
        if (targetChain === undefined && req.query.binary === "true") {
          targetChain = defaultTargetChain;
        }

        const responseJson = [];

        const notFoundIds: string[] = [];

        for (const id of priceIds) {
          const latestPriceInfo = this.priceFeedVaaInfo.getLatestPriceInfo(id);

          if (latestPriceInfo === undefined) {
            notFoundIds.push(id);
            continue;
          }

          responseJson.push(
            this.priceInfoToJson(latestPriceInfo, verbose, targetChain)
          );
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
    endpoints.push(
      `api/latest_price_feeds?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..&verbose=true&${targetChainArgString}`
    );

    const getPriceFeedInputSchema: schema = {
      query: Joi.object({
        id: Joi.string()
          .regex(/^(0x)?[a-f0-9]{64}$/)
          .required(),
        publish_time: Joi.number().required(),
        verbose: Joi.boolean(),
        binary: Joi.boolean(),
        target_chain: Joi.string()
          .valid(...validTargetChains)
          .optional(),
      }).required(),
    };

    app.get(
      "/api/get_price_feed",
      validate(getPriceFeedInputSchema),
      asyncWrapper(async (req: Request, res: Response) => {
        const priceFeedId = removeLeading0x(req.query.id as string);
        const publishTime = Number(req.query.publish_time as string);
        // verbose is optional, default to false
        const verbose = req.query.verbose === "true";
        // The binary and target_chain are somewhat redundant. Binary still exists for backward compatibility reasons.
        // No VAA will be returned if both arguments are omitted. binary=true is the same as target_chain=default
        let targetChain = req.query.target_chain as TargetChain | undefined;
        if (targetChain === undefined && req.query.binary === "true") {
          targetChain = defaultTargetChain;
        }

        if (
          this.priceFeedVaaInfo.getLatestPriceInfo(priceFeedId) === undefined
        ) {
          throw RestException.PriceFeedIdNotFound([priceFeedId]);
        }

        const vaa = await this.getVaaWithDbLookup(priceFeedId, publishTime);
        if (vaa === undefined) {
          throw RestException.VaaNotFound();
        }

        const priceInfo = this.vaaToPriceInfo(
          priceFeedId,
          Buffer.from(vaa.vaa, "base64")
        );

        if (priceInfo === undefined) {
          throw RestException.VaaNotFound();
        } else {
          res.json(this.priceInfoToJson(priceInfo, verbose, targetChain));
        }
      })
    );

    endpoints.push(
      "api/get_price_feed?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>"
    );
    endpoints.push(
      "api/get_price_feed?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>&verbose=true"
    );
    endpoints.push(
      "api/get_price_feed?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>&binary=true"
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
      if (this.isReady === undefined || this.isReady!()) {
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
