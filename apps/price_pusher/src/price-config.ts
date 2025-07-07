import { HexString } from "@pythnetwork/hermes-client";
import Joi from "joi";
import YAML from "yaml";
import fs from "fs";
import { Logger } from "pino";
import { DurationInSeconds, PctNumber, removeLeading0x } from "./utils";
import { PriceInfo } from "./interface";

const PriceConfigFileSchema: Joi.Schema = Joi.array()
  .items(
    Joi.object({
      alias: Joi.string().required(),
      id: Joi.string()
        .regex(/^(0x)?[a-f0-9]{64}$/)
        .required(),
      time_difference: Joi.number().required(),
      price_deviation: Joi.number().required(),
      confidence_ratio: Joi.number().required(),
      early_update: Joi.object({
        time_difference: Joi.number().optional(),
        price_deviation: Joi.number().optional(),
        confidence_ratio: Joi.number().optional(),
      }).optional(),
    }),
  )
  .unique("id")
  .unique("alias")
  .required();

export type PriceConfig = {
  alias: string;
  id: HexString;
  timeDifference: DurationInSeconds;
  priceDeviation: PctNumber;
  confidenceRatio: PctNumber;

  // An early update happens when another price has met the conditions to be pushed, so this
  // price can be included in a batch update for minimal gas cost.
  // By default, every price feed will be early updated in a batch if any other price update triggers
  // the conditions. This configuration will typically minimize gas usage.
  //
  // However, if you would like to customize this behavior, set `customEarlyUpdate: true` in your config
  // for the price feed, then set the specific conditions (time / price / confidence) under which you would
  // like the early update to trigger.
  customEarlyUpdate: boolean | undefined;
  earlyUpdateTimeDifference: DurationInSeconds | undefined;
  earlyUpdatePriceDeviation: PctNumber | undefined;
  earlyUpdateConfidenceRatio: PctNumber | undefined;
};

export function readPriceConfigFile(path: string): PriceConfig[] {
  const priceConfigs = YAML.parse(fs.readFileSync(path, "utf-8"));
  const validationResult = PriceConfigFileSchema.validate(priceConfigs);

  if (validationResult.error !== undefined) {
    throw validationResult.error;
  }

  return (priceConfigs as any[]).map((priceConfigRaw) => {
    const priceConfig: PriceConfig = {
      alias: priceConfigRaw.alias,
      id: removeLeading0x(priceConfigRaw.id),
      timeDifference: priceConfigRaw.time_difference,
      priceDeviation: priceConfigRaw.price_deviation,
      confidenceRatio: priceConfigRaw.confidence_ratio,

      customEarlyUpdate: priceConfigRaw.early_update !== undefined,
      earlyUpdateTimeDifference: priceConfigRaw.early_update?.time_difference,
      earlyUpdatePriceDeviation: priceConfigRaw.early_update?.price_deviation,
      earlyUpdateConfidenceRatio: priceConfigRaw.early_update?.confidence_ratio,
    };
    return priceConfig;
  });
}

export enum UpdateCondition {
  // This price feed must be updated
  YES,
  // This price feed may be updated as part of a larger batch
  EARLY,
  // This price feed shouldn't be updated
  NO,
}

/**
 * Checks whether on-chain price needs to be updated with the latest pyth price information.
 *
 * @param priceConfig Config of the price feed to check
 * @returns True if the on-chain price needs to be updated.
 */
export function shouldUpdate(
  priceConfig: PriceConfig,
  sourceLatestPrice: PriceInfo | undefined,
  targetLatestPrice: PriceInfo | undefined,
  logger: Logger,
): UpdateCondition {
  const priceId = priceConfig.id;

  // There is no price to update the target with. So we should not update it.
  if (sourceLatestPrice === undefined) {
    logger.info(
      `${priceConfig.alias} (${priceId}) is not available on the source network. Ignoring it.`,
    );
    return UpdateCondition.NO;
  }

  // It means that price never existed there. So we should push the latest price feed.
  if (targetLatestPrice === undefined) {
    logger.info(
      `${priceConfig.alias} (${priceId}) is not available on the target network. Pushing the price.`,
    );
    return UpdateCondition.YES;
  }

  // The current price is not newer than the price onchain
  if (sourceLatestPrice.publishTime < targetLatestPrice.publishTime) {
    return UpdateCondition.NO;
  }

  const timeDifference =
    sourceLatestPrice.publishTime - targetLatestPrice.publishTime;

  const priceDeviationPct =
    (Math.abs(
      Number(sourceLatestPrice.price) - Number(targetLatestPrice.price),
    ) /
      Number(targetLatestPrice.price)) *
    100;
  const confidenceRatioPct = Math.abs(
    (Number(sourceLatestPrice.conf) / Number(sourceLatestPrice.price)) * 100,
  );

  logger.info(
    {
      sourcePrice: sourceLatestPrice,
      targetPrice: targetLatestPrice,
      symbol: priceConfig.alias,
    },
    `Analyzing price ${priceConfig.alias} (${priceId}). ` +
      `Time difference: ${timeDifference} (< ${priceConfig.timeDifference}? / early: < ${priceConfig.earlyUpdateTimeDifference}) OR ` +
      `Price deviation: ${priceDeviationPct.toFixed(5)}% (< ${
        priceConfig.priceDeviation
      }%? / early: < ${priceConfig.earlyUpdatePriceDeviation}%?) OR ` +
      `Confidence ratio: ${confidenceRatioPct.toFixed(5)}% (< ${
        priceConfig.confidenceRatio
      }%? / early: < ${priceConfig.earlyUpdateConfidenceRatio}%?)`,
  );

  if (
    timeDifference >= priceConfig.timeDifference ||
    priceDeviationPct >= priceConfig.priceDeviation ||
    confidenceRatioPct >= priceConfig.confidenceRatio
  ) {
    return UpdateCondition.YES;
  } else if (
    priceConfig.customEarlyUpdate === undefined ||
    !priceConfig.customEarlyUpdate ||
    (priceConfig.earlyUpdateTimeDifference !== undefined &&
      timeDifference >= priceConfig.earlyUpdateTimeDifference) ||
    (priceConfig.earlyUpdatePriceDeviation !== undefined &&
      priceDeviationPct >= priceConfig.earlyUpdatePriceDeviation) ||
    (priceConfig.earlyUpdateConfidenceRatio !== undefined &&
      confidenceRatioPct >= priceConfig.earlyUpdateConfidenceRatio)
  ) {
    return UpdateCondition.EARLY;
  } else {
    return UpdateCondition.NO;
  }
}
