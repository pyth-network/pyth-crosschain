import { CHAINS } from "@pythnetwork/xc-governance-sdk";
import {
  ChainConfig,
  ChainIdTestnet,
  ChainsConfigTestnet,
} from "./chains-manager/chains";

export type ExtendedChainConfig = ChainConfig & {
  feeDenom: string;
  pythArtifactZipName: string;
  wormholeChainId: number;
};

export const ExtendedChainsConfigTestnet: Record<
  ChainIdTestnet,
  ExtendedChainConfig
> = {
  [ChainIdTestnet.INJECTIVE]: {
    feeDenom: "inj",
    pythArtifactZipName: "injective",
    wormholeChainId: CHAINS.injective,
    ...ChainsConfigTestnet[ChainIdTestnet.INJECTIVE],
  },
  [ChainIdTestnet.OSMOSIS_4]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis,
    ...ChainsConfigTestnet[ChainIdTestnet.OSMOSIS_4],
  },
  [ChainIdTestnet.OSMOSIS_5]: {
    feeDenom: "uosmo",
    pythArtifactZipName: "osmosis",
    wormholeChainId: CHAINS.osmosis,
    ...ChainsConfigTestnet[ChainIdTestnet.OSMOSIS_5],
  },
  [ChainIdTestnet.SEI_ATLANTIC_2]: {
    feeDenom: "usei",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.sei,
    ...ChainsConfigTestnet[ChainIdTestnet.SEI_ATLANTIC_2],
  },
  [ChainIdTestnet.NEUTRON_PION_1]: {
    feeDenom: "untrn",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.neutron,
    ...ChainsConfigTestnet[ChainIdTestnet.NEUTRON_PION_1],
  },
  [ChainIdTestnet.JUNO]: {
    feeDenom: "ujunox",
    pythArtifactZipName: "cosmwasm",
    wormholeChainId: CHAINS.juno,
    ...ChainsConfigTestnet[ChainIdTestnet.JUNO],
  },
};
