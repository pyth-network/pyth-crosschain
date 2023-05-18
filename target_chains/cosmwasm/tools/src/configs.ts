import { CHAINS, ChainId } from "@pythnetwork/xc-governance-sdk";
import {
  ChainIdMainnet,
  ChainIdTestnet,
  ChainsConfigMainnet,
  ChainsConfigTestnet,
} from "./chains-manager/chains";
import { DeploymentType } from "./helper";

type ContractConfig = {
  feeDenom: string;
  pythArtifactZipName: string;
  wormholeChainId: number;
};

const MainnetContractConfig: Record<ChainIdMainnet, ContractConfig> = {
  [ChainIdMainnet.INJECTIVE]: {
    feeDenom: "inj",
    pythArtifactZipName: "injective",
    wormholeChainId: CHAINS.injective,
  },
  [ChainIdMainnet.OSMOSIS]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis,
  },
};

const TestnetEdgeContractConfig: Record<ChainIdTestnet, ContractConfig> = {
  [ChainIdTestnet.INJECTIVE]: {
    feeDenom: "inj",
    pythArtifactZipName: "injective",
    wormholeChainId: CHAINS.injective,
  },
  [ChainIdTestnet.OSMOSIS_4]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis,
  },
  [ChainIdTestnet.OSMOSIS_5]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis,
  },
  [ChainIdTestnet.SEI_ATLANTIC_2]: {
    feeDenom: "usei",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.sei,
  },
  [ChainIdTestnet.NEUTRON_PION_1]: {
    feeDenom: "untrn",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.neutron,
  },
  [ChainIdTestnet.JUNO]: {
    feeDenom: "ujunox",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.juno,
  },
};

const TestnetStableContractConfig: Record<ChainIdTestnet, ContractConfig> = {
  [ChainIdTestnet.INJECTIVE]: {
    feeDenom: "inj",
    pythArtifactZipName: "injective",
    wormholeChainId: CHAINS.injective_stable,
  },
  [ChainIdTestnet.OSMOSIS_4]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis_stable,
  },
  [ChainIdTestnet.OSMOSIS_5]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis_stable,
  },
  [ChainIdTestnet.SEI_ATLANTIC_2]: {
    feeDenom: "usei",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.sei_stable,
  },
  [ChainIdTestnet.NEUTRON_PION_1]: {
    feeDenom: "untrn",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.neutron_stable,
  },
  [ChainIdTestnet.JUNO]: {
    feeDenom: "ujunox",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.juno_stable,
  },
};

export function getContractConfig(
  chainId: ChainIdMainnet | ChainIdTestnet,
  deploymentType: DeploymentType
): ContractConfig {
  if (deploymentType === "mainnet")
    return MainnetContractConfig[chainId as ChainIdMainnet];
  else if (deploymentType === "testnet-stable")
    return TestnetStableContractConfig[chainId as ChainIdTestnet];

  // testnet-edge
  return TestnetEdgeContractConfig[chainId as ChainIdTestnet];
}

export function getChainConfig(
  chainId: ChainIdTestnet | ChainIdMainnet,
  deploymentType: DeploymentType
) {
  if (deploymentType === "mainnet")
    return ChainsConfigMainnet[chainId as ChainIdMainnet];
  return ChainsConfigTestnet[chainId as ChainIdTestnet];
}

function getPythSources(mainnet: boolean) {
  if (mainnet) {
    return {
      data_sources: [
        {
          emitter: Buffer.from(
            "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
            "hex"
          ).toString("base64"),
          chain_id: 1,
        },
        {
          emitter: Buffer.from(
            "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
            "hex"
          ).toString("base64"),
          chain_id: 26,
        },
      ],
      governance_source: {
        emitter: Buffer.from(
          "5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
    };
  }

  return {
    data_sources: [
      {
        emitter: Buffer.from(
          "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
      {
        emitter: Buffer.from(
          "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6",
          "hex"
        ).toString("base64"),
        chain_id: 26,
      },
    ],
    governance_source: {
      emitter: Buffer.from(
        "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
        "hex"
      ).toString("base64"),
      chain_id: 1,
    },
  };
}

export function getPythConfig({
  feeDenom,
  wormholeContract,
  wormholeChainId,
  mainnet,
}: {
  feeDenom: string;
  wormholeContract: string;
  wormholeChainId: number;
  mainnet: boolean;
}) {
  return {
    wormhole_contract: wormholeContract,
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: wormholeChainId,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: feeDenom,
    },
    ...getPythSources(mainnet),
  };
}

interface ReqWormholeConfig {
  feeDenom: string;
  wormholeChainId: number;
  mainnet: boolean;
}

export function getWormholeConfig({
  feeDenom,
  wormholeChainId,
  mainnet,
}: ReqWormholeConfig) {
  if (mainnet)
    return {
      chain_id: wormholeChainId,
      fee_denom: feeDenom,
      gov_chain: 1,
      gov_address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ=",
      guardian_set_expirity: 86400,
      initial_guardian_set: {
        addresses: [{ bytes: "WMw65cCXshPOPIGXnhuflXB0aqU=" }],
        expiration_time: 0,
      },
    };

  return {
    chain_id: wormholeChainId,
    fee_denom: feeDenom,
    gov_chain: 1,
    gov_address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ=",
    guardian_set_expirity: 86400,
    initial_guardian_set: {
      addresses: [{ bytes: "E5R71IsY5T/a7ud/NHM5Gscnxjg=" }],
      expiration_time: 0,
    },
  };
}
