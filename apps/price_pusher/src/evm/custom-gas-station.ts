/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Logger } from "pino";
import { parseGwei } from "viem";

import type { CustomGasChainId, TxSpeed } from "../utils.js";
import { customGasChainIds, txSpeeds, verifyValidOption } from "../utils.js";

export type CustomGasResult =
  | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  | { gasPrice: bigint };

type chainMethods = Record<
  CustomGasChainId,
  () => Promise<CustomGasResult | undefined>
>;

export class CustomGasStation {
  private chain: CustomGasChainId;
  private speed: TxSpeed;
  private chainMethods: chainMethods = {
    137: this.fetchMaticMainnetGasPrice.bind(this),
  };
  private logger: Logger;
  private legacy: boolean;
  constructor(logger: Logger, chain: number, speed: string, legacy: boolean) {
    this.logger = logger;
    this.speed = verifyValidOption(speed, txSpeeds);
    this.chain = verifyValidOption(chain, customGasChainIds);
    this.legacy = legacy;
  }

  async getCustomGasPrice(): Promise<CustomGasResult | undefined> {
    return this.chainMethods[this.chain]();
  }

  private async fetchMaticMainnetGasPrice(): Promise<
    CustomGasResult | undefined
  > {
    try {
      const res = await fetch("https://gasstation.polygon.technology/v2");
      // TODO: improve the typing specificity here
      const jsonRes = (await res.json()) as any;
      const speedData = jsonRes[this.speed];

      if (this.legacy) {
        const gasPrice = speedData.maxFee;
        return { gasPrice: parseGwei(gasPrice.toFixed(2)) };
      }

      const maxFee = speedData.maxFee;
      const maxPriorityFee = speedData.maxPriorityFee;
      return {
        maxFeePerGas: parseGwei(maxFee.toFixed(2)),
        maxPriorityFeePerGas: parseGwei(maxPriorityFee.toFixed(2)),
      };
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
  legacy?: boolean,
) {
  if (customGasStation && txSpeed) {
    return new CustomGasStation(logger, customGasStation, txSpeed, !!legacy);
  }
  return;
}
