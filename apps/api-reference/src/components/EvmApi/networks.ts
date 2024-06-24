import { arbitrum, avalanche, mainnet, sepolia } from "wagmi/chains";

export const getContractAddress = (networkId: number) =>
  isSupportedNetwork(networkId)
    ? NETWORK_TO_CONTRACT_ADDRESS[networkId]
    : undefined;

const NETWORK_TO_CONTRACT_ADDRESS = {
  [mainnet.id]: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  [avalanche.id]: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  [arbitrum.id]: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  [sepolia.id]: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21",
} as const;

const isSupportedNetwork = (
  networkId: number,
): networkId is keyof typeof NETWORK_TO_CONTRACT_ADDRESS =>
  networkId in NETWORK_TO_CONTRACT_ADDRESS;
