/**
 * Shared plumbing for the two halves of the SVM Wormhole guardian set migration: the script that
 * proposes it to the multisig, and the script that executes it once the multisig approves.
 *
 * The migration repoints every SVM price receiver at the Pyth Pro emitter and hands the core
 * bridge's guardian set over to the Pyth Pro multisig. Per chain that is three authority-gated
 * actions — `set_data_sources`, `set_fee`, and a program upgrade — followed by two permissionless
 * ones that only exist in the upgraded program: `close_guardian_set` for every set that is left,
 * and `initialize` to install the multisig at guardian set 0.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { DEFAULT_PUSH_ORACLE_PROGRAM_ID } from "@pythnetwork/pyth-solana-receiver";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  BPF_UPGRADABLE_LOADER,
  BUFFER_METADATA_SIZE,
  getProgramDataAddress,
  mapKey,
  PROGRAMDATA_METADATA_SIZE,
  REMOTE_EXECUTOR_ADDRESS,
} from "@pythnetwork/xc-admin-common";
import type { TransactionInstruction } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import type { DeploymentType } from "../src/core/base";
import { getDefaultDeploymentConfig } from "../src/core/base";
import { SvmChain } from "../src/core/chains";
import type {
  SvmPriceFeedContract,
  SvmWormholeContract,
} from "../src/core/contracts";
import { getUpgradeAuthority } from "../src/core/contracts";
import type { Vault } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

/** One entry per SVM chain the migration should cover. */
export type SvmMigrationConfig = {
  /** Path to the migrated core bridge ELF that every chain is upgraded to. */
  coreBridgeArtifact: string;
  chains: {
    chain: string;
    /** Buffer account the migrated ELF has been written to on that chain. */
    upgradeBuffer: string;
  }[];
};

/** A chain to migrate, with everything the migration needs resolved against the store. */
export type SvmMigrationTarget = {
  chain: SvmChain;
  receiver: SvmPriceFeedContract;
  wormhole: SvmWormholeContract;
  /**
   * The key the vault governs this chain with: its own authority PDA where the vault lives, and
   * the remote executor's stand-in for that PDA everywhere else.
   */
  signer: PublicKey;
  upgradeBuffer: PublicKey;
};

/** The state every chain is being migrated to. */
export type SvmMigrationTargetState = {
  dataSources: DataSource[];
  singleUpdateFeeInLamports: bigint;
  /** Guardians the upgraded program installs at guardian set 0. */
  guardianSet: string[];
  /** The migrated core bridge ELF, as staged in each chain's upgrade buffer. */
  coreBridgeElf: Buffer;
};

export const MIGRATION_OPTIONS = {
  chain: {
    desc: "Only migrate these chains, out of the ones the config lists. Defaults to all of them",
    string: true,
    type: "array",
  },
  "config-path": {
    demandOption: true,
    desc: "Path to the migration config file",
    type: "string",
  },
  "deployment-type": {
    choices: ["pro-compatible-production", "pro-compatible-staging"],
    default: "pro-compatible-production",
    desc: "Which Pyth Pro deployment the chains are being migrated onto. Must match the core bridge artifact: the staging guardians are what a core bridge built with the `beta` feature installs",
    type: "string",
  },
  "ops-key-path": {
    demandOption: true,
    desc: "Path to the ops key file. Signs the multisig transactions, and pays for everything the execute script sends",
    type: "string",
  },
  "rpc-url": {
    desc: "Solana RPC URL to reach the vault's cluster on. Defaults to the public RPC for that cluster",
    type: "string",
  },
  vault: {
    default: "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
    desc: "Vault ID of the multisig that governs the chains being migrated",
    type: "string",
  },
} as const;

export function loadMigrationConfig(configPath: string): SvmMigrationConfig {
  return JSON.parse(readFileSync(configPath, "utf8")) as SvmMigrationConfig;
}

export function getVaultOrThrow(vaultId: string): Vault {
  const vault = DefaultStore.vaults[vaultId];
  if (!vault) {
    throw new Error(`Vault with ID '${vaultId}' does not exist.`);
  }
  return vault;
}

export function readMigrationTargetState(
  config: SvmMigrationConfig,
  deploymentType: DeploymentType,
): SvmMigrationTargetState {
  const { dataSources, initialSingleUpdateFee, wormholeConfig } =
    getDefaultDeploymentConfig(deploymentType);
  return {
    coreBridgeElf: readFileSync(config.coreBridgeArtifact),
    dataSources,
    guardianSet: wormholeConfig.initialGuardianSet,
    singleUpdateFeeInLamports: BigInt(initialSingleUpdateFee),
  };
}

/**
 * Resolves the chains named in the config against the store, working out which key governs each
 * of them on behalf of `vaultAuthority`.
 */
export function resolveMigrationTargets(
  config: SvmMigrationConfig,
  chainFilter: readonly string[] | undefined,
  vaultAuthority: PublicKey,
): SvmMigrationTarget[] {
  const entries = chainFilter
    ? config.chains.filter((entry) => chainFilter.includes(entry.chain))
    : config.chains;
  if (chainFilter && entries.length !== chainFilter.length) {
    throw new Error(
      `The config does not cover every requested chain; it has ${config.chains
        .map((entry) => entry.chain)
        .join(", ")}`,
    );
  }
  return entries.map((entry) => {
    const chain = DefaultStore.getChainOrThrow(entry.chain, SvmChain);
    return {
      chain,
      receiver: findContract(DefaultStore.svm_price_feed_contracts, chain),
      signer: chain.isRemote ? mapKey(vaultAuthority) : vaultAuthority,
      upgradeBuffer: new PublicKey(entry.upgradeBuffer),
      wormhole: findContract(DefaultStore.svm_wormhole_contracts, chain),
    };
  });
}

function findContract<T extends { getChain(): SvmChain; getId(): string }>(
  contracts: Record<string, T>,
  chain: SvmChain,
): T {
  const matches = Object.values(contracts).filter(
    (contract) => contract.getChain().getId() === chain.getId(),
  );
  const [match] = matches;
  if (!match || matches.length > 1) {
    throw new Error(
      `Expected exactly one contract for ${chain.getId()}, found ${matches.length}`,
    );
  }
  return match;
}

/**
 * The three authority-gated instructions of the migration, in the order they have to run: repoint
 * the receiver at the Pyth Pro emitter, drop its update fee, and upgrade the core bridge.
 *
 * The buffer's rent is refunded to `signer`, which is also the account that paid for it.
 */
export function buildMigrationInstructions(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
): TransactionInstruction[] {
  return [
    target.receiver.generateSetDataSourcesInstruction(
      target.signer,
      state.dataSources,
    ),
    target.receiver.generateSetFeeInstruction(
      target.signer,
      state.singleUpdateFeeInLamports,
    ),
    target.wormhole.generateUpgradeInstruction(
      target.upgradeBuffer,
      target.signer,
      target.signer,
    ),
  ];
}

/**
 * The whole of the on-chain state the migration acts on, as a block of text for the operator to
 * read before approving anything: who can upgrade each of the programs involved, what the
 * receiver currently accepts price updates from, and what the core bridge's guardian sets are.
 */
export async function describeChainState(
  target: SvmMigrationTarget,
): Promise<string> {
  const { chain, receiver, wormhole } = target;
  const lines: string[] = [];

  if (chain.isRemote) {
    lines.push(
      `remote executor ${REMOTE_EXECUTOR_ADDRESS.toBase58()}`,
      `  upgrade authority: ${describeUpgradeAuthority(await getUpgradeAuthority(chain, REMOTE_EXECUTOR_ADDRESS))}`,
    );
  }

  const receiverConfig = await receiver.getConfig();
  lines.push(
    `price receiver ${receiver.getProgramId().toBase58()}`,
    `  upgrade authority: ${describeUpgradeAuthority(await receiver.getUpgradeAuthority())}`,
    `  config ${receiver.getConfigAddress().toBase58()}`,
    `    governance authority: ${receiverConfig.governanceAuthority.toBase58()}`,
    `    target governance authority: ${receiverConfig.targetGovernanceAuthority?.toBase58() ?? "none"}`,
    `    core bridge: ${receiverConfig.wormhole.toBase58()}`,
    `    minimum signatures: ${receiverConfig.minimumSignatures}`,
    `    single update fee: ${receiverConfig.singleUpdateFeeInLamports} lamports`,
    `    data sources: ${describeList(receiverConfig.validDataSources.map((source) => `${source.emitterChain}/${source.emitterAddress}`))}`,
  );

  lines.push(
    `push oracle ${DEFAULT_PUSH_ORACLE_PROGRAM_ID.toBase58()}`,
    `  upgrade authority: ${describeUpgradeAuthority(await getUpgradeAuthority(chain, DEFAULT_PUSH_ORACLE_PROGRAM_ID))}`,
  );

  const bridgeConfig = await wormhole.getConfig();
  const guardianSets = await wormhole.getGuardianSets();
  lines.push(
    `core bridge ${wormhole.getProgramId().toBase58()}`,
    `  upgrade authority: ${describeUpgradeAuthority(await wormhole.getUpgradeAuthority())}`,
    `  config ${wormhole.getConfigAddress().toBase58()}`,
    `    guardian set index: ${bridgeConfig.guardianSetIndex}`,
    `    guardian set ttl: ${bridgeConfig.guardianSetTtlSeconds} seconds`,
    `    message fee: ${bridgeConfig.feeLamports} lamports`,
    `  guardian sets still present: ${describeList(guardianSets.map((set) => String(set.index)))}`,
  );

  const currentSet = guardianSets.find(
    (set) => set.index === bridgeConfig.guardianSetIndex,
  );
  if (currentSet) {
    lines.push(
      `  guardian set ${currentSet.index} ${wormhole.getGuardianSetAddress(currentSet.index).toBase58()}`,
      `    created: ${describeTimestamp(currentSet.creationTime)}`,
      `    expires: ${currentSet.expirationTime === 0 ? "never" : describeTimestamp(currentSet.expirationTime)}`,
      `    guardians: ${currentSet.keys.length}`,
      ...currentSet.keys.map((key) => `      ${key}`),
    );
  } else {
    lines.push(
      `  guardian set ${bridgeConfig.guardianSetIndex} is the current one but has already been closed`,
    );
  }

  return lines.join("\n");
}

function describeUpgradeAuthority(authority: PublicKey | undefined): string {
  return authority?.toBase58() ?? "none (the program is immutable)";
}

function describeList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function describeTimestamp(unixSeconds: number): string {
  return `${unixSeconds} (${new Date(unixSeconds * 1000).toISOString()})`;
}

/**
 * Checks that the vault can actually carry out the migration on `target`, so that a chain whose
 * authorities have not been handed over yet fails here rather than as an unexecutable proposal.
 */
export async function checkAuthorities(
  target: SvmMigrationTarget,
): Promise<void> {
  const { governanceAuthority } = await target.receiver.getConfig();
  if (!governanceAuthority.equals(target.signer)) {
    throw new Error(
      `${target.chain.getId()}: receiver governance authority is ${governanceAuthority.toBase58()}, expected ${target.signer.toBase58()}`,
    );
  }
  const upgradeAuthority = await target.wormhole.getUpgradeAuthority();
  if (!upgradeAuthority?.equals(target.signer)) {
    throw new Error(
      `${target.chain.getId()}: core bridge upgrade authority is ${
        upgradeAuthority?.toBase58() ?? "none (the program is immutable)"
      }, expected ${target.signer.toBase58()}`,
    );
  }
}

/**
 * Checks that the upgrade buffer really holds the migrated core bridge, so that the proposal
 * commits to an ELF that has been read rather than to an address that has been trusted.
 */
export async function checkUpgradeBuffer(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
): Promise<void> {
  const account = await target.chain
    .getConnection()
    .getAccountInfo(target.upgradeBuffer);
  if (!account?.owner.equals(BPF_UPGRADABLE_LOADER)) {
    throw new Error(
      `${target.chain.getId()}: ${target.upgradeBuffer.toBase58()} is not a BPF loader account`,
    );
  }
  // A `Buffer` is the loader state at discriminant 1, followed by its `Option<Pubkey>` authority.
  if (account.data.readUInt32LE(0) !== 1) {
    throw new Error(
      `${target.chain.getId()}: ${target.upgradeBuffer.toBase58()} is not an upgrade buffer`,
    );
  }
  const authority = new PublicKey(account.data.subarray(5, 37));
  if (!authority.equals(target.signer)) {
    throw new Error(
      `${target.chain.getId()}: buffer authority is ${authority.toBase58()}, expected ${target.signer.toBase58()}; the loader will not let the vault upgrade from it`,
    );
  }
  checkElf(
    `${target.chain.getId()}: buffer ${target.upgradeBuffer.toBase58()}`,
    account.data.subarray(BUFFER_METADATA_SIZE),
    state.coreBridgeElf,
  );
}

/**
 * Whether `target` is already running the migrated core bridge. This is what makes it safe to
 * close the guardian sets: `close_guardian_set` and the new `initialize` only exist in the
 * migrated program, and on a remote chain the governance message that installs it can only be
 * relayed while the Wormhole guardian sets are still there to verify it.
 */
export async function isCoreBridgeMigrated(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
): Promise<boolean> {
  const account = await target.chain
    .getConnection()
    .getAccountInfo(getProgramDataAddress(target.wormhole.getProgramId()));
  if (!account) {
    throw new Error(
      `${target.chain.getId()}: core bridge has no program data account`,
    );
  }
  return account.data
    .subarray(
      PROGRAMDATA_METADATA_SIZE,
      PROGRAMDATA_METADATA_SIZE + state.coreBridgeElf.length,
    )
    .equals(state.coreBridgeElf);
}

/** Whether the receiver on `target` already accepts exactly the Pyth Pro data sources, for free. */
export async function isReceiverMigrated(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
): Promise<boolean> {
  const config = await target.receiver.getConfig();
  return (
    config.singleUpdateFeeInLamports === state.singleUpdateFeeInLamports &&
    config.validDataSources.length === state.dataSources.length &&
    config.validDataSources.every((source, index) => {
      const expected = state.dataSources[index];
      return (
        source.emitterChain === expected?.emitterChain &&
        source.emitterAddress === expected.emitterAddress
      );
    })
  );
}

/**
 * An account holding a program ELF is allocated at least as large as the ELF and zero-padded, so
 * comparing the leading bytes and requiring the rest to be zero identifies it exactly.
 */
function checkElf(label: string, actual: Buffer, expected: Buffer): void {
  const head = actual.subarray(0, expected.length);
  if (
    !head.equals(expected) ||
    actual.subarray(expected.length).some(Boolean)
  ) {
    throw new Error(
      `${label} holds a different program: sha256 ${sha256(head)} over ${actual.length} bytes, expected ${sha256(expected)} over ${expected.length} bytes`,
    );
  }
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
