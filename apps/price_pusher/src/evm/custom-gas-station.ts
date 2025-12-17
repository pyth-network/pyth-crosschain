import type { Logger } from "pino";
import { parseGwei } from "viem";

import type { CustomGasChainId, TxSpeed } from "../utils.js";
import { customGasChainIds, txSpeeds, verifyValidOption } from "../utils.js";

type chainMethods = Record<CustomGasChainId, () => Promise<bigint | undefined>>;

export class CustomGasStation {
  private chain: CustomGasChainId;
  private speed: TxSpeed;
  private chainMethods: chainMethods = {
    137: this.fetchMaticMainnetGasPrice.bind(this),
  };
  private logger: Logger;
  constructor(logger: Logger, chain: number, speed: string) {
    this.logger = logger;
    this.speed = verifyValidOption(speed, txSpeeds);
    this.chain = verifyValidOption(chain, customGasChainIds);
  }

  async getCustomGasPrice() {
    return this.chainMethods[this.chain]();
  }

  private async fetchMaticMainnetGasPrice() {
    try {
      const res = await fetch("https://gasstation.polygon.technology/v2");
      // TODO: improve the typing specificity here
      const jsonRes = (await res.json()) as any;
      const gasPrice = jsonRes[this.speed].maxFee;
      return parseGwei(gasPrice.toFixed(2));
    } catch (error) {
      this.logger.error(
        error,
        "Failed to fetch gas price from Matic mainnet. Returning undefined",
      );
      return;
    }
  }
}

export function getCustomGasStation(
  logger: Logger,
  customGasStation?: number,
  txSpeed?: string,
) {
  if (customGasStation && txSpeed) {
    return new CustomGasStation(logger, customGasStation, txSpeed);
  }
  return;
}
