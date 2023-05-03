import { ChainExecutor } from "./chain-executor";
import { CosmwasmExecutor } from "./cosmwasm";
import { InjectiveExecutor } from "./injective";

export enum ChainType {
  INJECTIVE = "injective",
  COSMWASM = "cosmwasm",
}

// GUIDELINES: to add new chains
// ENUM Key should be of the form:
// CHAINNAME{_OPTIONAL-IDENTIFIER}
// ENUM Value should be of the form:
// chainname{_optional-identifier}
export enum ChainIdTestnet {
  INJECTIVE = "injective",
  OSMOSIS_4 = "osmosis_4",
  OSMOSIS_5 = "osmosis_5",
  SEI_ATLANTIC_2 = "sei_atlantic_2",
  NEUTRON_PION_1 = "neutron_pion_1",
}

export const ChainIdsTestnet = Object.values(ChainIdTestnet);

// TODO: ADD MAINNET IDs IN FUTURE
// export enum ChainIdMainnet {
//   INJECTIVE = "injective",
// }

export type ChainConfig =
  | {
      // usually the chain name
      // osmosis, injective
      chainId: ChainIdTestnet;
      chainType: ChainType.INJECTIVE;

      // endpoints to create executor and querier for a particular chain
      querierEndpoint: string;
      executorEndpoint: string;
    }
  | {
      // usually the chain name
      // osmosis, injective
      chainId: ChainIdTestnet;
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

export const ChainsConfigTestnet: Record<ChainIdTestnet, ChainConfig> = {
  [ChainIdTestnet.INJECTIVE]: {
    chainId: ChainIdTestnet.INJECTIVE,
    chainType: ChainType.INJECTIVE,
    querierEndpoint: "https://k8s.testnet.tm.injective.network:443",
    executorEndpoint: "https://k8s.testnet.chain.grpc-web.injective.network",
  },
  [ChainIdTestnet.OSMOSIS_5]: {
    chainId: ChainIdTestnet.OSMOSIS_5,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.osmotest5.osmosis.zone/",
    querierEndpoint: "https://rpc.osmotest5.osmosis.zone/",
    prefix: "osmo",
    gasPrice: "0.025uosmo",
  },
  [ChainIdTestnet.OSMOSIS_4]: {
    chainId: ChainIdTestnet.OSMOSIS_4,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc-test.osmosis.zone:443",
    querierEndpoint: "https://rpc-test.osmosis.zone:443",
    prefix: "osmo",
    gasPrice: "0.025uosmo",
  },
  [ChainIdTestnet.SEI_ATLANTIC_2]: {
    chainId: ChainIdTestnet.SEI_ATLANTIC_2,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.atlantic-2.seinetwork.io/",
    querierEndpoint: "https://rpc.atlantic-2.seinetwork.io/",
    prefix: "sei",
    gasPrice: "0.1usei",
  },
  [ChainIdTestnet.NEUTRON_PION_1]: {
    chainId: ChainIdTestnet.NEUTRON_PION_1,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.pion.rs-testnet.polypore.xyz/",
    querierEndpoint: "https://rpc.pion.rs-testnet.polypore.xyz/",
    prefix: "neutron",
    gasPrice: "0.025untrn",
  },
};

/**
 * This method will return an executor for that corresponding chainType for given chainId.
 */
export function createExecutorForChain(
  chainId: ChainIdTestnet,
  mnemonic: string
): ChainExecutor {
  const chainConfig = ChainsConfigTestnet[chainId];
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
