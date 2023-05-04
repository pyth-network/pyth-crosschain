import { readFileSync } from "fs";

export const WORMHOLE_CONTRACT_VERSION = "2.14.9";

export function getWormholeFileName(
  chainId: string,
  version: string,
  mainnet: boolean
): string {
  const WORMHOLE_STORAGE_DIR = mainnet
    ? "../wormhole-stub/mainnet"
    : "../wormhole-stub/testnet";

  return `${WORMHOLE_STORAGE_DIR}/${chainId}-${version}.json`;
}

export function getWormholeContractAddress(
  chainId: string,
  version: string,
  mainnet: boolean
): string {
  let deployedFilePath = getWormholeFileName(chainId, version, mainnet);
  const wormholeContractAddress = JSON.parse(
    readFileSync(deployedFilePath).toString()
  )["instantiate-contract"].result.contractAddr;

  if (wormholeContractAddress === undefined)
    throw new Error(
      "Wormhole contract address should be present in the file" +
        deployedFilePath
    );

  return wormholeContractAddress;
}
