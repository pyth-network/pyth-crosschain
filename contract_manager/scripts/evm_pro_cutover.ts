import type { DataSource } from "@pythnetwork/xc-admin-common";

import type { DeploymentType } from "../src/core/base";
import type { EvmChain } from "../src/core/chains";
import {
  EvmPriceFeedContract,
  EvmWormholeContract,
} from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

export const MAINNET_OPS_VAULT_ID =
  "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj";
export const DEVNET_OPS_VAULT_ID =
  "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3";

export function getOpsVault(vault: "mainnet" | "devnet") {
  const id = vault === "mainnet" ? MAINNET_OPS_VAULT_ID : DEVNET_OPS_VAULT_ID;
  const found = DefaultStore.vaults[id];
  if (!found) {
    throw new Error(`Vault ${id} not found in DefaultStore`);
  }
  return found;
}

export function normalizeHex(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}

export function dataSourcesEqual(a: DataSource[], b: DataSource[]): boolean {
  if (a.length !== b.length) return false;
  const keys = (sources: DataSource[]) =>
    sources
      .map((ds) => `${ds.emitterChain}:${normalizeHex(ds.emitterAddress)}`)
      .sort();
  const left = keys(a);
  const right = keys(b);
  return left.every((key, i) => key === right[i]);
}

export function governanceDataSourcesEqual(
  a: DataSource,
  b: DataSource,
): boolean {
  return (
    a.emitterChain === b.emitterChain &&
    normalizeHex(a.emitterAddress) === normalizeHex(b.emitterAddress)
  );
}

export function isLegacyPriceFeedDeployment(
  deploymentType: DeploymentType | undefined,
): boolean {
  return (
    deploymentType === undefined ||
    deploymentType === "stable" ||
    deploymentType === "beta"
  );
}

export function requireProCompatibleDeploymentType(
  type: DeploymentType,
): asserts type is "pro-compatible-staging" | "pro-compatible-production" {
  if (
    type !== "pro-compatible-staging" &&
    type !== "pro-compatible-production"
  ) {
    throw new Error(
      `deployment-type must be pro-compatible-production or pro-compatible-staging, got ${type}`,
    );
  }
}

/**
 * Finds the legacy (stable / beta / unlabeled) Pyth proxy on an EVM chain.
 * Side-by-side pro-compatible proxies are ignored so in-place cutover never
 * targets a newly deployed address.
 */
export function findLegacyEvmPriceFeedContract(
  chain: EvmChain,
): EvmPriceFeedContract | undefined {
  const matches: EvmPriceFeedContract[] = [];
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (!(contract instanceof EvmPriceFeedContract)) continue;
    if (contract.getChain().getId() !== chain.getId()) continue;
    if (isLegacyPriceFeedDeployment(contract.deploymentType)) {
      matches.push(contract);
    }
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple legacy EvmPriceFeedContract entries on ${chain.getId()}: ${matches
        .map((contract) => contract.address)
        .join(", ")}`,
    );
  }
  return matches[0];
}

export function findStoredWormhole(chain: EvmChain, address: string) {
  const normalized = normalizeHex(address);
  for (const contract of Object.values(DefaultStore.wormhole_contracts)) {
    if (!(contract instanceof EvmWormholeContract)) continue;
    if (contract.getChain().getId() !== chain.getId()) continue;
    if (normalizeHex(contract.address) === normalized) {
      return contract;
    }
  }
  return undefined;
}
