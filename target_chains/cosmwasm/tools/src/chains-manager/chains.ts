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
export enum ChainId {
  INJECTIVE_TESTNET = "injective_testnet",
  OSMOSIS_TESTNET_4 = "osmosis_testnet_4",
  OSMOSIS_TESTNET_5 = "osmosis_testnet_5",
  SEI_TESTNET_ATLANTIC_2 = "sei_testnet_atlantic_2",
  NEUTRON_TESTNET_PION_1 = "neutron_testnet_pion_1",
  JUNO_TESTNET = "juno_testnet",

  // Below are mainnet chain ids
  INJECTIVE = "injective",
  OSMOSIS = "osmosis",
  SEI_PACIFIC_1 = "sei_pacific_1",
  NEUTRON = "neutron",
}

export const ChainIds = Object.values(ChainId);

export type ChainNetworkConfig =
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

export const CHAINS_NETWORK_CONFIG: Record<ChainId, ChainNetworkConfig> = {
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
    gasPrice: "0.01usei",
  },
  [ChainId.NEUTRON_TESTNET_PION_1]: {
    chainId: ChainId.NEUTRON_TESTNET_PION_1,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc-palvus.pion-1.ntrn.tech/",
    querierEndpoint: "https://rpc-palvus.pion-1.ntrn.tech/",
    prefix: "neutron",
    gasPrice: "0.025untrn",
  },
  [ChainId.JUNO_TESTNET]: {
    chainId: ChainId.JUNO_TESTNET,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.uni.junonetwork.io/",
    querierEndpoint: "https://rpc.uni.junonetwork.io/",
    prefix: "juno",
    gasPrice: "0.025ujunox",
  },

  // Mainnet chains
  [ChainId.INJECTIVE]: {
    chainId: ChainId.INJECTIVE,
    chainType: ChainType.INJECTIVE,
    querierEndpoint: "https://k8s.testnet.tm.injective.network:443",
    executorEndpoint: "https://k8s.testnet.chain.grpc-web.injective.network",
  },
  [ChainId.OSMOSIS]: {
    chainId: ChainId.OSMOSIS,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc.osmosis.zone:443",
    querierEndpoint: "https://rpc.osmosis.zone:443",
    prefix: "osmo",
    gasPrice: "0.025uosmo",
  },
  [ChainId.SEI_PACIFIC_1]: {
    chainId: ChainId.SEI_PACIFIC_1,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://sei-rpc.polkachu.com",
    querierEndpoint: "https://sei-rpc.polkachu.com",
    prefix: "sei",
    gasPrice: "0.025usei",
  },
  [ChainId.NEUTRON]: {
    chainId: ChainId.NEUTRON,
    chainType: ChainType.COSMWASM,
    executorEndpoint: "https://rpc-kralum.neutron-1.neutron.org",
    querierEndpoint: "https://rpc-kralum.neutron-1.neutron.org",
    prefix: "neutron",
    gasPrice: "0.025untrn",
  },
};

/**
 * This method will return an executor for given chainConfig.
 */
export function createExecutorForChain(
  chainConfig: ChainNetworkConfig,
  mnemonic: string
): ChainExecutor {
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
