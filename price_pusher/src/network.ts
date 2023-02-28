import { PriceServiceConnection } from "@pythnetwork/pyth-common-js";
import { ChainPricePusher, IPriceListener, PriceItem } from "./interface";
import { DurationInSeconds } from "./utils";
import { InjectivePriceListener, InjectivePricePusher } from "./injective";
import { EvmPriceListener, EvmPricePusher } from "./evm";

export enum Networks {
  EVM = "evm",
  INJECTIVE = "injective",
}

export const NetworkValues = Object.keys(Networks);

type createNetworkListener = (
  endpoint: string,
  pythContractAddr: string,
  priceItems: PriceItem[],
  pollingFrequency: DurationInSeconds
) => IPriceListener;

type createNetworkPusher = (
  endpoint: string,
  pythContractAddr: string,
  mnemonic: string,
  priceServiceConnection: PriceServiceConnection
) => ChainPricePusher;

export type NetworkHelper = Record<
  Networks,
  { createListener: createNetworkListener; createPusher: createNetworkPusher }
>;

export const NetworkHelper: NetworkHelper = {
  [Networks.EVM]: {
    createListener: EvmPriceListener.create,
    createPusher: EvmPricePusher.create,
  },
  [Networks.INJECTIVE]: {
    createListener: InjectivePriceListener.create,
    createPusher: InjectivePricePusher.create,
  },
};
