import { HexString } from "@pythnetwork/pyth-common-js";
import Joi from "joi";
import YAML from "yaml";
import fs from "fs";
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
    })
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
    };
    return priceConfig;
  });
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
  targetLatestPrice: PriceInfo | undefined
): boolean {
  const priceId = priceConfig.id;

  // There is no price to update the target with.
  if (sourceLatestPrice === undefined) {
    return false;
  }

  // It means that price never existed there. So we should push the latest price feed.
  if (targetLatestPrice === undefined) {
    console.log(
      `${priceConfig.alias} (${priceId}) is not available on the target network. Pushing the price.`
    );
    return true;
  }

  // The current price is not newer than the price onchain
  if (sourceLatestPrice.publishTime < targetLatestPrice.publishTime) {
    return false;
  }

  const timeDifference =
    sourceLatestPrice.publishTime - targetLatestPrice.publishTime;

  const priceDeviationPct =
    (Math.abs(
      Number(sourceLatestPrice.price) - Number(targetLatestPrice.price)
    ) /
      Number(targetLatestPrice.price)) *
    100;
  const confidenceRatioPct = Math.abs(
    (Number(sourceLatestPrice.conf) / Number(sourceLatestPrice.price)) * 100
  );

  console.log(`Analyzing price ${priceConfig.alias} (${priceId})`);

  console.log("Source latest price: ", sourceLatestPrice);
  console.log("Target latest price: ", targetLatestPrice);

  console.log(
    `Time difference: ${timeDifference} (< ${priceConfig.timeDifference}?)`
  );
  console.log(
    `Price deviation: ${priceDeviationPct.toFixed(5)}% (< ${
      priceConfig.priceDeviation
    }%?)`
  );
  console.log(
    `Confidence ratio: ${confidenceRatioPct.toFixed(5)}% (< ${
      priceConfig.confidenceRatio
    }%?)`
  );

  const result =
    timeDifference >= priceConfig.timeDifference ||
    priceDeviationPct >= priceConfig.priceDeviation ||
    confidenceRatioPct >= priceConfig.confidenceRatio;

  if (result == true) {
    console.log(
      "Some of the above values passed the threshold. Will push the price."
    );
  } else {
    console.log(
      "None of the above values passed the threshold. No push needed."
    );
  }

  return result;
}
