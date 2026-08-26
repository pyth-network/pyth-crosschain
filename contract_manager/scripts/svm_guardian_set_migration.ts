/**
 * Shared plumbing for the propose and execute halves of the SVM Wormhole guardian set migration.
 *
 * Per chain the migration is three authority-gated actions — `set_data_sources`, `set_fee` and a
 * core bridge upgrade — then two permissionless ones that only exist in the upgraded program:
 * `close_guardian_set` for every set that is left, and `initialize` to install the Pyth multisig
 * at guardian set 0.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { Wallet } from "@coral-xyz/anchor";
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  DEFAULT_PUSH_ORACLE_PROGRAM_ID,
  PythSolanaReceiver,
} from "@pythnetwork/pyth-solana-receiver";
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
import {
  ComputeBudgetProgram,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

import type { DeploymentType, PrivateKey } from "../src/core/base";
import { getDefaultDeploymentConfig } from "../src/core/base";
import { SvmChain } from "../src/core/chains";
import {
  getUpgradeAuthority,
  SvmPriceFeedContract,
  SvmWormholeContract,
} from "../src/core/contracts";
import type { Vault } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";

export type SvmMigrationConfig = {
  coreBridgeArtifact: string;
  chains: {
    chain: string;
    upgradeBuffer?: string;
  }[];
};

export type SvmMigrationTarget = {
  chain: SvmChain;
  receiver: SvmPriceFeedContract;
  wormhole: SvmWormholeContract;
  upgradeBuffer: PublicKey | undefined;
};

export type SvmMigrationTargetForProposing = SvmMigrationTarget & {
  upgradeBuffer: PublicKey;
  // The vault's own authority PDA where the vault lives, the remote executor's stand-in for it
  // everywhere else.
  signer: PublicKey;
};

export type SvmMigrationTargetState = {
  dataSources: DataSource[];
  singleUpdateFeeInLamports: bigint;
  guardianSet: string[];
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

// Proposing commits to a core bridge upgrade, so it cannot accept a chain without a buffer to
// upgrade from; the execute and direct scripts never touch the buffers.
export function makeSvmMigrationTargetForProposing(
  targets: SvmMigrationTarget[],
  vaultAuthority: PublicKey,
): SvmMigrationTargetForProposing[] {
  return targets.map((target) => {
    if (target.upgradeBuffer === undefined) {
      throw new Error(`The target ${target.chain.getId()} has no upgrade buffer`);
    }
    return {
      ...target,
      signer: target.chain.isRemote ? mapKey(vaultAuthority) : vaultAuthority,
    } as SvmMigrationTargetForProposing;
  });
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

export function resolveMigrationTargets(
  config: SvmMigrationConfig,
  chainFilter: readonly string[] | undefined,
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
      receiver: findContract(
        DefaultStore.contracts,
        SvmPriceFeedContract,
        chain,
      ),
      upgradeBuffer:
        entry.upgradeBuffer === undefined
          ? undefined
          : new PublicKey(entry.upgradeBuffer),
      wormhole: findContract(
        DefaultStore.wormhole_contracts,
        SvmWormholeContract,
        chain,
      ),
    };
  });
}

function findContract<T extends SvmPriceFeedContract | SvmWormholeContract>(
  contracts: Record<string, unknown>,
  type: abstract new (...args: never[]) => T,
  chain: SvmChain,
): T {
  const matches = Object.values(contracts).filter(
    (contract): contract is T =>
      contract instanceof type && contract.getChain().getId() === chain.getId(),
  );
  const [match] = matches;
  if (!match || matches.length > 1) {
    throw new Error(
      `Expected exactly one contract for ${chain.getId()}, found ${matches.length}`,
    );
  }
  return match;
}

export async function buildMigrationInstructions(
  target: SvmMigrationTargetForProposing,
  state: SvmMigrationTargetState,
): Promise<TransactionInstruction[]> {
  return [
    await target.receiver.generateSetDataSourcesInstruction(
      target.signer,
      state.dataSources,
    ),
    await target.receiver.generateSetFeeInstruction(
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

export async function describeChainState(
  target: SvmMigrationTarget,
): Promise<string> {
  const { chain, receiver, wormhole } = target;
  const lines: string[] = [];

  if (chain.isRemote) {
    lines.push(
      `remote executor ${REMOTE_EXECUTOR_ADDRESS.toBase58()}`,
      `  upgrade authority: ${await describeUpgradeAuthority(chain, REMOTE_EXECUTOR_ADDRESS)}`,
    );
  }

  const receiverConfig = await receiver.getConfig();
  lines.push(
    `price receiver ${receiver.getProgramId().toBase58()}`,
    `  upgrade authority: ${await describeUpgradeAuthority(chain, receiver.getProgramId())}`,
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
    `  upgrade authority: ${await describeUpgradeAuthority(chain, DEFAULT_PUSH_ORACLE_PROGRAM_ID)}`,
  );

  const bridgeConfig = await wormhole.getConfig();
  const guardianSets = await wormhole.getGuardianSets();
  lines.push(
    `core bridge ${wormhole.getProgramId().toBase58()}`,
    `  upgrade authority: ${await describeUpgradeAuthority(chain, wormhole.getProgramId())}`,
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

// Nothing in the state dump is worth failing a run over.
async function describeUpgradeAuthority(
  chain: SvmChain,
  programId: PublicKey,
): Promise<string> {
  try {
    const authority = await getUpgradeAuthority(chain, programId);
    return authority?.toBase58() ?? "none (the program is immutable)";
  } catch (error) {
    return `unavailable: ${error instanceof Error ? error.message : error}`;
  }
}

function describeList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function describeTimestamp(unixSeconds: number): string {
  return `${unixSeconds} (${new Date(unixSeconds * 1000).toISOString()})`;
}

const MAX_PRICE_AGE_SECONDS = 120;

/**
 * Relays one price update from `hermes` through `target`'s receiver and reads the resulting
 * `PriceUpdateV2` back. The only check that exercises the guardians' signatures, the core bridge's
 * quorum and the receiver's data source at once.
 */
export async function relayPriceUpdate(
  target: SvmMigrationTarget,
  wallet: Wallet,
  hermes: { url: string; token: string | undefined; feedId: string },
): Promise<string> {
  const chainId = target.chain.getId();
  const client = new HermesClient(hermes.url, {
    ...(hermes.token === undefined ? {} : { accessToken: hermes.token }),
  });
  const [updateData] = (
    await client.getLatestPriceUpdates([hermes.feedId], { encoding: "base64" })
  ).binary.data;
  if (!updateData) {
    throw new Error(`Hermes returned no update for ${hermes.feedId}`);
  }

  const receiver = new PythSolanaReceiver({
    connection: target.chain.getConnection(),
    receiverProgramId: target.receiver.getProgramId(),
    wallet,
    wormholeProgramId: target.wormhole.getProgramId(),
  });
  // The update account is read back after the fact, so it cannot be closed in the same batch.
  const builder = receiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });
  await builder.addPostPriceUpdates([updateData]);
  const priceUpdateAccount = builder.getPriceUpdateAccount(hermes.feedId);
  await receiver.provider.sendAll(await builder.buildVersionedTransactions({}));

  const update = await receiver.fetchPriceUpdateAccount(priceUpdateAccount);
  if (!update) {
    throw new Error(
      `${chainId}: ${priceUpdateAccount.toBase58()} was not written`,
    );
  }
  const feedId = "0x" + Buffer.from(update.priceMessage.feedId).toString("hex");
  if (feedId !== hermes.feedId) {
    throw new Error(
      `${chainId}: relayed update is for ${feedId}, expected ${hermes.feedId}`,
    );
  }
  const publishTime = update.priceMessage.publishTime.toNumber();
  const age = Math.floor(Date.now() / 1000) - publishTime;
  if (age > MAX_PRICE_AGE_SECONDS) {
    throw new Error(
      `${chainId}: relayed update was published ${age}s ago, which is not a fresh price`,
    );
  }

  const closeBuilder = receiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });
  closeBuilder.addInstructions(builder.closeInstructions);
  await receiver.provider.sendAll(
    await closeBuilder.buildVersionedTransactions({}),
  );

  return `relayed ${feedId} published at ${publishTime} (${age}s ago), verification ${Object.keys(update.verificationLevel).join()}`;
}

// A chain whose authorities have not been handed over yet should fail here rather than as an
// unexecutable proposal.
export async function checkAuthorities(
  target: SvmMigrationTargetForProposing,
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

// Commits the proposal to an ELF that has been read rather than to an address that is trusted.
export async function checkUpgradeBuffer(
  target: SvmMigrationTargetForProposing,
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

// Gates closing the guardian sets: `close_guardian_set` and the new `initialize` only exist in
// the migrated program, and on a remote chain the message installing it can only be relayed while
// the Wormhole guardian sets are still there to verify it.
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

// A program ELF is allocated at least as large as the ELF and zero-padded, so the leading bytes
// plus an all-zero tail identify it exactly.
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

// Both instructions go in one transaction: until the close lands, the receiver trusts the Pyth
// Pro emitter while the Wormhole guardians still control the bridge.
export async function closeGuardianSets(
  target: SvmMigrationTarget,
  state: SvmMigrationTargetState,
  senderPrivateKey: PrivateKey,
) {
  const chainId = target.chain.getId();
  if (!(await isReceiverMigrated(target, state))) {
    throw new Error(
      `${chainId}: the receiver does not accept the Pyth Pro data sources yet; the governance message has not been executed there`,
    );
  }
  // On a chain the vault reaches over wormhole, the governance message is verified against the
  // very sets being closed.
  if (!(await isCoreBridgeMigrated(target, state))) {
    throw new Error(
      `${chainId}: the core bridge is still running the pre-migration build; it has to be upgraded before any guardian set is closed`,
    );
  }

  const guardianSets = await target.wormhole.getGuardianSets();
  const migrated = guardianSets.find(
    (set) =>
      set.index === 0 &&
      set.keys.length === state.guardianSet.length &&
      set.keys.every((key, index) => key === state.guardianSet[index]),
  );
  const toClose = guardianSets
    .filter((set) => set !== migrated)
    .sort((a, b) => b.index - a.index);
  if (migrated && toClose.length === 0) {
    console.log(`${chainId}: guardian set already migrated`);
    return;
  }

  const payer = target.chain.getKeypair(senderPrivateKey);
  const transaction = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  );
  for (const set of toClose) {
    transaction.add(
      target.wormhole.generateCloseGuardianSetInstruction(
        payer.publicKey,
        set.index,
      ),
    );
  }
  if (!migrated) {
    transaction.add(
      target.wormhole.generateInitializeInstruction(payer.publicKey),
    );
  }

  const signature = await sendAndConfirmTransaction(
    target.chain.getConnection(),
    transaction,
    [payer],
  );
  console.log(
    `${chainId}: closed guardian sets ${toClose
      .map((set) => set.index)
      .join(", ")}${migrated ? "" : " and re-initialized"} in ${signature}`,
  );
}
