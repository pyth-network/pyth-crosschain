import { ChainExecutor } from "./chain-executor";
import { CosmwasmExecutor } from "./cosmwasm";
import { InjectiveExecutor } from "./injective";

// guideline to add new chains
// chains ENUM should be of the form
// CHAINNAME_[TESTNET/MAINNET/DEVNET]{_OPTIONAL-IDENTIFIER}
// value should be
// snake case
// all small but the same as enum name
export enum ChainId {
  INJECTIVE_TESTNET = "injective_testnet",
  OSMOSIS_TESTNET_4 = "osmosis_testnet_4",
  OSMOSIS_TESTNET_5 = "osmosis_testnet_5",
  SEI_TESTNET_ATLANTIC_2 = "sei_testnet_atlantic_2",
  SEI_TESTNET_DEVNET_3 = "sei_testnet_devnet_3",
  NEUTRON_TESTNET_PION_1 = "neutron_testnet_pion_1",
}

export enum ChainType {
  INJECTIVE = "injective",
  COSMWASM = "cosmwasm",
}

export type ChainConfig =
  | {
      // usually the chain name
      // osmosis, injective
      chainId: ChainId;
      chainType: ChainType.INJECTIVE;

      // endpoints to create executor and querier for a particular chain
      querierEndpoint: string;
      executorEndpoint: string;
    }
  | {
      // usually the chain name
      // osmosis, injective
      chainId: ChainId;
      chainType: ChainType.COSMWASM;

      // endpoints to create executor and querier for a particular chain
      querierEndpoint: string;
      executorEndpoint: string;

      // some extra fields
      // prefix of the particular cosmwasm chain
      // eg "osmo"
      prefix: string;
      // gas price for that chain
      // eg "0.025 uosmo"
      gasPrice: string;
    };

export type ChainsConfigType = Record<ChainId, ChainConfig>;

export const ChainsConfig: ChainsConfigType = {
  [ChainId.INJECTIVE_TESTNET]: {
    chainId: ChainId.INJECTIVE_TESTNET,
    chainType: ChainType.INJECTIVE,
    querierEndpoint: "https://k8s.testnet.tm.injective.network:443",
    executorEndpoint: "https://k8s.testnet.chain.grpc-web.injective.network",
  },
  [ChainId.OSMOSIS_TESTNET_5]: {
    chainId: ChainId.OSMOSIS_TESTNET_5,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.osmotest5.osmosis.zone/",
    querierEndpoint: "https://rpc.osmotest5.osmosis.zone/",
    prefix: "osmo",
    gasPrice: "0.025uosmo",
  },
  [ChainId.OSMOSIS_TESTNET_4]: {
    chainId: ChainId.OSMOSIS_TESTNET_4,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc-test.osmosis.zone:443",
    querierEndpoint: "https://rpc-test.osmosis.zone:443",
    prefix: "osmo",
    gasPrice: "0.025uosmo",
  },
  [ChainId.SEI_TESTNET_ATLANTIC_2]: {
    chainId: ChainId.SEI_TESTNET_ATLANTIC_2,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.atlantic-2.seinetwork.io/",
    querierEndpoint: "https://rpc.atlantic-2.seinetwork.io/",
    prefix: "sei",
    gasPrice: "0.1usei",
  },
  [ChainId.SEI_TESTNET_DEVNET_3]: {
    chainId: ChainId.SEI_TESTNET_DEVNET_3,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.sei-devnet-3.seinetwork.io/",
    querierEndpoint: "https://rpc.sei-devnet-3.seinetwork.io/",
    prefix: "sei",
    gasPrice: "0.1usei",
  },
  [ChainId.NEUTRON_TESTNET_PION_1]: {
    chainId: ChainId.NEUTRON_TESTNET_PION_1,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.pion.rs-testnet.polypore.xyz/",
    querierEndpoint: "https://rpc.pion.rs-testnet.polypore.xyz/",
    prefix: "neutron",
    gasPrice: "0.025untrn",
  },
};

/**
 * Based on the chainType associated with the given chain.
 * This method will return an executor for that corresponding chainType
 */
export function createExecutorForChain(
  chainId: ChainId,
  mnemonic: string
): ChainExecutor {
  const chainConfig = ChainsConfig[chainId];
  const chainType = chainConfig.chainType;

  if (chainType === ChainType.INJECTIVE) {
    return new InjectiveExecutor(chainConfig.executorEndpoint, mnemonic);
  } else
    return new CosmwasmExecutor(
      chainConfig.executorEndpoint,
      mnemonic,
      chainConfig.prefix,
      chainConfig.gasPrice
    );
}
