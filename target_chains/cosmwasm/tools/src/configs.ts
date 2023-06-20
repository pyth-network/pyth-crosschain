import { CHAINS } from "@pythnetwork/xc-governance-sdk";
import { ChainId } from "./chains-manager/chains";
import { DeploymentType } from "./helper";

type ChainContractConfig = {
  feeDenom: string;
  pythArtifactZipName: string;
  wormholeChainId: number;
};

export const CHAINS_CONTRACT_CONFIG: Record<ChainId, ChainContractConfig> = {
  [ChainId.INJECTIVE_TESTNET]: {
    feeDenom: "inj",
    pythArtifactZipName: "injective",
    wormholeChainId: CHAINS.injective_testnet,
  },
  [ChainId.OSMOSIS_TESTNET_4]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis_testnet_4,
  },
  [ChainId.OSMOSIS_TESTNET_5]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis_testnet_5,
  },
  [ChainId.SEI_TESTNET_ATLANTIC_2]: {
    feeDenom: "usei",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.sei_testnet_atlantic_2,
  },
  [ChainId.NEUTRON_TESTNET_PION_1]: {
    feeDenom: "untrn",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.neutron_testnet_pion_1,
  },
  [ChainId.JUNO_TESTNET]: {
    feeDenom: "ujunox",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.juno_testnet,
  },

  // mainnet
  [ChainId.INJECTIVE]: {
    feeDenom: "inj",
    pythArtifactZipName: "injective",
    wormholeChainId: CHAINS.injective,
  },
  [ChainId.OSMOSIS]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis,
  },
  [ChainId.SEI_PACIFIC_1]: {
    feeDenom: "usei",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.sei_pacific_1,
  },
};

function getPythSources(deploymentType: DeploymentType) {
  if (deploymentType === "stable") {
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
  deploymentType,
}: {
  feeDenom: string;
  wormholeContract: string;
  wormholeChainId: number;
  deploymentType: DeploymentType;
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
    ...getPythSources(deploymentType),
  };
}

interface ReqWormholeConfig {
  feeDenom: string;
  wormholeChainId: number;
  deploymentType: DeploymentType;
}

export function getWormholeConfig({
  feeDenom,
  wormholeChainId,
  deploymentType,
}: ReqWormholeConfig) {
  if (deploymentType === "stable") {
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
  }

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
