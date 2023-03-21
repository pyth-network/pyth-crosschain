import Web3 from "web3";
import {
  CustomGasChainId,
  TxSpeed,
  verifyValidOption,
  txSpeeds,
  customGasChainIds,
} from "../utils";

type chainMethods = Record<CustomGasChainId, () => Promise<string | undefined>>;

export class CustomGasStation {
  private chain: CustomGasChainId;
  private speed: TxSpeed;
  private chainMethods: chainMethods = {
    137: this.fetchMaticMainnetGasPrice.bind(this),
  };
  constructor(chain: number, speed: string) {
    this.speed = verifyValidOption(speed, txSpeeds);
    this.chain = verifyValidOption(chain, customGasChainIds);
  }

  async getCustomGasPrice() {
    return this.chainMethods[this.chain]();
  }

  private async fetchMaticMainnetGasPrice() {
    try {
      const res = await fetch("https://gasstation-mainnet.matic.network/v2");
      const jsonRes = await res.json();
      const gasPrice = jsonRes[this.speed].maxFee;
      const gweiGasPrice = Web3.utils.toWei(gasPrice.toFixed(2), "Gwei");
      return gweiGasPrice.toString();
    } catch (e) {
      console.error(
        "Failed to fetch gas price from Matic mainnet. Returning undefined"
      );
      console.error(e);
      return undefined;
    }
  }
}

export function getCustomGasStation(
  customGasStation?: number,
  txSpeed?: string
) {
  if (customGasStation && txSpeed) {
    return new CustomGasStation(customGasStation, txSpeed);
  }
}
