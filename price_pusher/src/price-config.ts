import { HexString } from "@pythnetwork/pyth-evm-js";
import Joi from "joi";
import YAML from "yaml";
import fs from "fs";
import { DurationInSeconds, PctNumber, removeLeading0x } from "./utils";

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
