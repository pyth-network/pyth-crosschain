/**
 * Shared logic for cutting legacy EVM price feed contracts over to Pyth Pro verification.
 *
 * The cutover keeps the consumer-facing proxy address and replaces what it verifies against:
 * `UpgradeContract` to an implementation without the `SetWormholeAddress` dual-verify, then
 * `SetDataSources` to the Pro price emitter, then `SetWormholeAddress` to the Pro receiver.
 *
 * Governance payloads name a target chain but never a target address, so a proposal is
 * chain-scoped while execution, verification and store updates are address-scoped. Everything
 * here therefore works on the full set of legacy proxies for a chain.
 */

import { existsSync, readFileSync } from "node:fs";

import type { DataSource } from "@pythnetwork/xc-admin-common";

import type { DeploymentType } from "../src/core/base";
import { getDefaultDeploymentConfig } from "../src/core/base";
import type { EvmChain } from "../src/core/chains";
import type {
  EvmPriceFeedContract,
  EvmWormholeContract,
} from "../src/core/contracts";
import { findPriceFeedContracts, findWormholeContract } from "./common";

/**
 * The deployment types this cutover targets. The legacy proxies being migrated are `stable` or
 * `beta` (or have no deployment type at all, for entries predating the field).
 */
export type ProDeploymentType =
  | "pro-compatible-production"
  | "pro-compatible-staging";

export function isProDeploymentType(
  deploymentType: DeploymentType,
): deploymentType is ProDeploymentType {
  return (
    deploymentType === "pro-compatible-production" ||
    deploymentType === "pro-compatible-staging"
  );
}

/** The on-chain state of a single legacy proxy, as far as the cutover cares about it. */
export type LegacyProxyState = {
  contract: EvmPriceFeedContract;
  /** The wormhole this proxy currently verifies against. */
  wormholeAddress: string;
  /** True once this proxy verifies against the Pro receiver, i.e. VAA3 has been applied. */
  usesProWormhole: boolean;
  /** True once the proxy's data sources match the Pro config, i.e. VAA2 has been applied. */
  usesProDataSources: boolean;
  governanceDataSource: DataSource;
  singleUpdateFeeInWei: string;
};

export type CutoverPreflight = {
  chain: EvmChain;
  /** Every legacy proxy the store knows about on this chain, readable or not. */
  legacyContracts: EvmPriceFeedContract[];
  /**
   * The state of each legacy proxy that could be read. Shorter than `legacyContracts` when a read
   * failed, in which case a blocker says so.
   */
  legacyProxies: LegacyProxyState[];
  /** The Pro receiver from the store, or undefined when one still has to be deployed. */
  proWormhole: EvmWormholeContract | undefined;
  /** Conditions that make a cutover proposal unsafe. A non-empty list means skip this chain. */
  blockers: string[];
  /** Conditions worth surfacing that do not make the proposal unsafe. */
  warnings: string[];
  /** True when every legacy proxy already verifies against the Pro receiver. */
  alreadyMigrated: boolean;
};

function normalizeAddress(address: string): string {
  return address.replace("0x", "").toLowerCase();
}

function sameDataSource(a: DataSource, b: DataSource): boolean {
  return (
    a.emitterChain === b.emitterChain &&
    normalizeAddress(a.emitterAddress) === normalizeAddress(b.emitterAddress)
  );
}

/**
 * Compares two data source sets ignoring order and address casing.
 * @param {DataSource[]} a One set.
 * @param {DataSource[]} b The other set.
 * @returns True when both sets contain the same data sources.
 */
export function sameDataSourceSet(a: DataSource[], b: DataSource[]): boolean {
  return (
    a.length === b.length &&
    a.every((source) => b.some((other) => sameDataSource(source, other)))
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Collects every legacy price feed proxy for a chain. Entries with no deployment type are treated
 * as legacy, which is what the `stable` and `beta` lookups already do.
 */
export function findLegacyPriceFeedContracts(
  chain: EvmChain,
): EvmPriceFeedContract[] {
  const byId = new Map<string, EvmPriceFeedContract>();
  for (const contract of [
    ...findPriceFeedContracts(chain, "stable"),
    ...findPriceFeedContracts(chain, "beta"),
  ]) {
    byId.set(contract.getId(), contract);
  }
  return [...byId.values()];
}

/**
 * Reads the on-chain state of one legacy proxy.
 * @throws {Error} if any of the reads fail, so the caller can turn an unreachable RPC into a
 * blocker for the chain rather than letting it abort a whole batch.
 */
async function readLegacyProxyState(
  contract: EvmPriceFeedContract,
  proWormholeAddress: string | undefined,
  proDataSources: DataSource[],
): Promise<LegacyProxyState> {
  // Read sequentially rather than with Promise.all. Several public RPCs rate limit a burst of
  // concurrent eth_calls from one client, which would surface as a spurious blocker.
  const wormholeContract = await contract.getWormholeContract();
  const governanceDataSource = await contract.getGovernanceDataSource();
  const fee = await contract.getBaseUpdateFee();
  const dataSources = await contract.getDataSources();

  const wormholeAddress = wormholeContract.address;
  return {
    contract,
    governanceDataSource,
    singleUpdateFeeInWei: String(fee.amount),
    usesProDataSources: sameDataSourceSet(dataSources, proDataSources),
    usesProWormhole:
      proWormholeAddress !== undefined &&
      normalizeAddress(wormholeAddress) ===
        normalizeAddress(proWormholeAddress),
    wormholeAddress,
  };
}

/**
 * Checks whether a chain is ready for a Pro cutover proposal, without deploying, proposing or
 * writing anything.
 *
 * Blockers (skip the chain):
 * - no legacy proxy in the store
 * - a proxy whose governance data source differs from the Pro config, since this path keeps the
 *   governance emitter and cannot retarget it
 * - a Pro receiver in the store whose guardian set is not the configured Pro router set, which
 *   would point the proxy at a verifier nobody can produce VAAs for
 * - an unreadable proxy, so a dead RPC is reported rather than silently skipped
 *
 * Warnings (proposal is still safe):
 * - a non-zero update fee, which is set to zero by a separate `SetFee` proposal
 * - proxies on one chain that disagree about how far the cutover has progressed
 * - a proxy left between VAA2 and VAA3, which cannot verify any price update until VAA3 lands
 * - no Pro receiver yet, which the deploy phase creates
 * @param {EvmChain} chain The chain to check.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @returns The preflight result for this chain.
 */
export async function preflightChain(
  chain: EvmChain,
  deploymentType: ProDeploymentType,
): Promise<CutoverPreflight> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const expected = getDefaultDeploymentConfig(deploymentType);

  const proWormhole = findWormholeContract(chain, deploymentType);
  if (proWormhole === undefined) {
    warnings.push(
      `No ${deploymentType} wormhole receiver in the store. One has to be deployed before proposing.`,
    );
  } else {
    const mismatch = await checkProWormholeGuardianSet(
      proWormhole,
      deploymentType,
    );
    if (mismatch !== undefined) blockers.push(mismatch);
  }

  const contracts = findLegacyPriceFeedContracts(chain);
  if (contracts.length === 0) {
    blockers.push("No legacy price feed contract in the store for this chain.");
  }

  const legacyProxies: LegacyProxyState[] = [];
  for (const contract of contracts) {
    let state: LegacyProxyState;
    try {
      state = await readLegacyProxyState(
        contract,
        proWormhole?.address,
        expected.dataSources,
      );
    } catch (error) {
      blockers.push(
        `Could not read price feed contract ${contract.address}: ${describeError(error)}`,
      );
      continue;
    }
    legacyProxies.push(state);

    if (
      !sameDataSource(state.governanceDataSource, expected.governanceDataSource)
    ) {
      blockers.push(
        `Price feed contract ${contract.address} has governance data source ` +
          `${state.governanceDataSource.emitterChain}:${state.governanceDataSource.emitterAddress}, ` +
          `expected ${expected.governanceDataSource.emitterChain}:${expected.governanceDataSource.emitterAddress}. ` +
          `This cutover keeps the governance emitter and cannot retarget it.`,
      );
    }

    if (state.singleUpdateFeeInWei !== "0") {
      warnings.push(
        `Price feed contract ${contract.address} has a single update fee of ` +
          `${state.singleUpdateFeeInWei} wei. Set it to 0 with a separate SetFee proposal.`,
      );
    }

    if (state.usesProDataSources && !state.usesProWormhole) {
      warnings.push(
        `Price feed contract ${contract.address} has Pro data sources but still verifies against ` +
          `${state.wormholeAddress}. It cannot verify any price update until SetWormholeAddress lands.`,
      );
    }
  }

  const migrated = legacyProxies.filter((proxy) => proxy.usesProWormhole);
  if (migrated.length > 0 && migrated.length < legacyProxies.length) {
    warnings.push(
      `Price feed contracts on this chain disagree about the cutover: ` +
        `${migrated.map((proxy) => proxy.contract.address).join(", ")} already use the Pro receiver, ` +
        `${legacyProxies
          .filter((proxy) => !proxy.usesProWormhole)
          .map((proxy) => proxy.contract.address)
          .join(", ")} do not.`,
    );
  }

  return {
    alreadyMigrated:
      legacyProxies.length > 0 && migrated.length === legacyProxies.length,
    blockers,
    chain,
    legacyContracts: contracts,
    legacyProxies,
    proWormhole,
    warnings,
  };
}

/**
 * Checks that a Pro wormhole receiver verifies against the guardian set the deployment config
 * expects. A receiver with any other set points the proxy at a verifier nobody can produce VAAs
 * for, which would take the feed down with no way to govern it back.
 * @param {EvmWormholeContract} wormhole The receiver to check.
 * @param {ProDeploymentType} deploymentType The Pro deployment whose router set is expected.
 * @returns A description of the mismatch, or undefined when the set is correct.
 */
export async function checkProWormholeGuardianSet(
  wormhole: EvmWormholeContract,
  deploymentType: ProDeploymentType,
): Promise<string | undefined> {
  const expected = getDefaultDeploymentConfig(deploymentType);
  let actual: string[];
  try {
    actual = (await wormhole.getGuardianSet()).map(normalizeAddress).sort();
  } catch (error) {
    return `Could not read the guardian set of wormhole receiver ${wormhole.address}: ${describeError(error)}`;
  }
  const wanted = expected.wormholeConfig.initialGuardianSet
    .map(normalizeAddress)
    .sort();
  if (actual.join(",") === wanted.join(",")) return;
  return (
    `Wormhole receiver ${wormhole.address} has guardian set [${actual.join(", ")}], ` +
    `expected the ${deploymentType} router set [${wanted.join(", ")}].`
  );
}

/** How far along the cutover a chain is, as a single word for reporting and gating. */
export type ChainStatus = "READY" | "BLOCKED" | "MIGRATED" | "NEEDS RECEIVER";

/**
 * Summarises a preflight result.
 *
 * `READY` means the preconditions pass and a Pro receiver already exists. It does **not** mean
 * there is nothing to deploy: every chain still needs a fresh `PythUpgradable` implementation,
 * because the proposal embeds that address.
 * @param {CutoverPreflight} result The preflight result to summarise.
 * @returns The status of the chain.
 */
export function statusOf(result: CutoverPreflight): ChainStatus {
  if (result.blockers.length > 0) return "BLOCKED";
  if (result.alreadyMigrated) return "MIGRATED";
  if (result.proWormhole === undefined) return "NEEDS RECEIVER";
  return "READY";
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => T,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(onTimeout());
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Runs `worker` over `items`, keeping at most `limit` in flight, preserving input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = Array.from({ length: items.length }) as R[];
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

/** How many chains to preflight at once. Each chain is a handful of RPC round trips. */
export const PREFLIGHT_CONCURRENCY = 8;

/** Give up on a chain after this long so one unresponsive RPC cannot stall a whole sweep. */
export const PREFLIGHT_TIMEOUT_MS = 60_000;

/**
 * Preflights one chain without ever rejecting. A thrown error or an unresponsive RPC becomes a
 * blocker on that chain instead, so a single dead endpoint cannot abort a sweep.
 * @param {EvmChain} chain The chain to check.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @param {number} timeoutMs How long to wait before giving up on the chain.
 * @returns The preflight result for this chain.
 */
function preflightChainSafe(
  chain: EvmChain,
  deploymentType: ProDeploymentType,
  timeoutMs: number,
): Promise<CutoverPreflight> {
  // Store-only lookup, so it stays accurate even when every RPC read fails.
  const failed = (blocker: string): CutoverPreflight => ({
    alreadyMigrated: false,
    blockers: [blocker],
    chain,
    legacyContracts: findLegacyPriceFeedContracts(chain),
    legacyProxies: [],
    proWormhole: undefined,
    warnings: [],
  });

  return withTimeout(
    preflightChain(chain, deploymentType).catch((error: unknown) =>
      failed(`Preflight failed: ${describeError(error)}`),
    ),
    timeoutMs,
    () =>
      failed(
        `Timed out after ${timeoutMs / 1000}s. The RPC for this chain may be unreachable.`,
      ),
  );
}

/**
 * Preflights several chains concurrently. Never rejects: a chain that cannot be read comes back
 * with a blocker describing why.
 * @param {EvmChain[]} chains The chains to check.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @param {object} options Concurrency and per-chain timeout overrides.
 * @param {number} options.concurrency How many chains to check at once.
 * @param {number} options.timeoutMs How long to wait before giving up on a chain.
 * @returns One result per input chain, in input order.
 */
export function preflightChains(
  chains: EvmChain[],
  deploymentType: ProDeploymentType,
  options: { concurrency?: number; timeoutMs?: number } = {},
): Promise<CutoverPreflight[]> {
  const concurrency = options.concurrency ?? PREFLIGHT_CONCURRENCY;
  const timeoutMs = options.timeoutMs ?? PREFLIGHT_TIMEOUT_MS;
  return mapWithConcurrency(chains, concurrency, (chain) =>
    preflightChainSafe(chain, deploymentType, timeoutMs),
  );
}

/**
 * Cache file shared by the deploy and propose phases. Deliberately not `.cache-deploy-evm` or
 * `.cache-upgrade-evm`: those hold addresses for other deployment types, and a shared cache would
 * let a re-run resurrect an unrelated address.
 */
export const CUTOVER_CACHE_FILE = ".cache-migrate-evm-to-pro";

/** The implementation artifact the cutover deploys and then names in the `UpgradeContract` payload. */
export const IMPLEMENTATION_ARTIFACT = "PythUpgradable";

/**
 * `PythUpgradable.pythUpgradableMagic()`. `upgradeUpgradableContract` calls this on the new
 * implementation through the proxy and reverts if it disagrees, so checking it off-chain turns
 * "wrong artifact" into a local failure instead of a failed governance execution.
 */
export const PYTH_UPGRADABLE_MAGIC = 0x97_a6_f3_04;

/**
 * The cache key `deployIfNotCached` uses for the implementation. Reproduced here so the propose
 * phase can find what the deploy phase wrote.
 * @param {EvmChain} chain The chain the implementation was deployed on.
 * @param {ProDeploymentType} deploymentType The Pro deployment it was deployed for.
 * @returns The cache key.
 */
export function implementationCacheKey(
  chain: EvmChain,
  deploymentType: ProDeploymentType,
): string {
  return `${chain.getId()}-${IMPLEMENTATION_ARTIFACT}-${deploymentType}`;
}

/**
 * Looks up the implementation the deploy phase left in the cache.
 *
 * A missing entry is not an error: it means the deploy phase has not run for this chain, or did
 * not get that far. The caller reports it and skips the chain.
 * @param {string} cacheFile The cache file to read.
 * @param {EvmChain} chain The chain to look up.
 * @param {ProDeploymentType} deploymentType The Pro deployment being cut over to.
 * @returns The cached implementation address, or undefined if there is none.
 */
export function readCachedImplementation(
  cacheFile: string,
  chain: EvmChain,
  deploymentType: ProDeploymentType,
): string | undefined {
  if (!existsSync(cacheFile)) return undefined;
  const cache = JSON.parse(readFileSync(cacheFile, "utf8")) as Record<
    string,
    string | undefined
  >;
  return cache[implementationCacheKey(chain, deploymentType)];
}

/**
 * Reads back a deployed implementation to confirm it is the contract we meant to deploy.
 *
 * Uses raw `eth_call`s rather than the build artifact, so the propose phase can run on a machine
 * that never compiled the contracts.
 * @param {EvmChain} chain The chain the implementation lives on.
 * @param {string} address The implementation address.
 * @returns The implementation's `version()` string.
 * @throws {Error} if there is no code at the address, the call fails, or the magic does not match,
 * i.e. the `UpgradeContract` governance action would revert.
 */
export async function verifyImplementation(
  chain: EvmChain,
  address: string,
): Promise<string> {
  const web3 = chain.getWeb3();

  const code = await web3.eth.getCode(address);
  if (code === "0x" || code === "0x0") {
    throw new Error(
      `No contract code at ${address} on ${chain.getId()}. The cached address may be from another chain.`,
    );
  }

  let magicResult: string;
  try {
    magicResult = await web3.eth.call({
      data: web3.eth.abi.encodeFunctionSignature("pythUpgradableMagic()"),
      to: address,
    });
  } catch (error) {
    // A contract that is not a PythUpgradable has no such method, so the call reverts. Say what
    // was being asked, otherwise this surfaces as a bare "execution reverted".
    throw new Error(
      `Could not call pythUpgradableMagic() at ${address} on ${chain.getId()}, so it is not a ` +
        `${IMPLEMENTATION_ARTIFACT} implementation: ${describeError(error)}`,
    );
  }
  const magic = Number(BigInt(magicResult));
  if (magic !== PYTH_UPGRADABLE_MAGIC) {
    throw new Error(
      `Implementation at ${address} reports magic 0x${magic.toString(16)}, expected ` +
        `0x${PYTH_UPGRADABLE_MAGIC.toString(16)}. The UpgradeContract governance action would revert.`,
    );
  }

  const versionResult = await web3.eth.call({
    data: web3.eth.abi.encodeFunctionSignature("version()"),
    to: address,
  });
  return String(web3.eth.abi.decodeParameter("string", versionResult));
}

/**
 * Which vault owns each Pro deployment's governance emitter.
 *
 * Keyed by deployment type rather than by mainnet/testnet on purpose: sepolia is a testnet whose
 * Pro deployment uses the production governance emitter, so picking the vault by network would
 * target an emitter its proxies do not trust.
 */
export const VAULT_BY_DEPLOYMENT_TYPE: Record<ProDeploymentType, string> = {
  "pro-compatible-production":
    "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
  "pro-compatible-staging":
    "devnet_6baWtW1zTUVMSJHJQVxDUXWzqrQeYBr6mu31j3bTKwY3",
};

/**
 * Multicall3, deployed at the same address on most EVM chains.
 *
 * The cutover needs it to put `SetDataSources` and `SetWormholeAddress` in one transaction. A
 * chain without it cannot be cut over safely, because between those two actions the proxy holds
 * Pro data sources while still verifying against its old wormhole and can verify nothing at all.
 */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
