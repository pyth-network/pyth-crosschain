import { arbitrum, avalanche, mainnet, sepolia } from "@wagmi/core/chains";

export const NETWORKS = [mainnet, avalanche, arbitrum, sepolia] as const;

export type Network = (typeof NETWORKS)[number];

export const NETWORK_TO_CONTRACT_ADDRESS: Record<Network["id"], `0x${string}`> =
  {
    [mainnet.id]: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
    [avalanche.id]: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
    [arbitrum.id]: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
    [sepolia.id]: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21",
  };
