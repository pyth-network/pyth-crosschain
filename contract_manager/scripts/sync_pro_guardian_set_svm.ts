/** biome-ignore-all lint/style/noProcessEnv: CLI script */
/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Rotates the guardian set on the Pyth Pro SVM receivers.
 *
 * Applies one upgrade VAA (--vaa / --vaa-file), or with --from-store every rotation the store
 * knows about in `src/store/guardian_sets/`, replayed in order up to --expect-index. --from-store
 * is what a freshly initialized receiver needs: it is created on set 0 and has to climb the whole
 * ladder before it can verify anything the routers sign.
 *
 * The SVM receiver is Pyth's fork of the Wormhole core bridge
 * (`target_chains/solana/programs/core-bridge`), whose guardian set is the list of Pro router
 * signing keys. Two program ids exist:
 *   - `HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ` — the legacy program, upgraded in place
 *   - `HDw2E7P8X1SkCyjvoGsfBGAVUutKcj874bXjHrpVYrVL` — the side-by-side pro-compatible program
 *
 * A cluster is any SVM chain id in `src/store/chains/SvmChains.json`, so the same VAA reaches
 * Solana and Fogo through one run. `--cluster` defaults to the two Solana clusters; the other
 * chains have to be named. Not every chain carries both programs — Fogo has only the legacy one —
 * so when `--program` is left at its default an absent program is reported `skipped-not-deployed`
 * rather than failing the run; a program named explicitly must be there.
 *
 * This is the SVM sibling of `sync_pro_guardian_set.ts` (EVM/Sui) and keeps its CLI conventions:
 * the VAA is parsed and checked locally before any RPC happens, the new set index it carries must
 * equal --expect-index, a target is only submitted to when its current index is exactly one below
 * the VAA's new index, and after submitting the index and key list are read back and compared
 * against the VAA. One target failing never aborts the run; the exit code is 0 only when every row
 * was skipped or submitted-and-verified.
 *
 * Rotating a target takes three legacy instructions, in order:
 *   1. `verify_signatures` (selector 7), one per batch of at most 7 signatures, each preceded by a
 *      secp256k1 precompile instruction that recovers the signer addresses. This writes a
 *      `SignatureSet` account owned by a fresh throwaway keypair.
 *   2. `post_vaa` (selector 2), which creates the `PostedVAA` PDA once the signature set has
 *      quorum. The fork declares this account `init` (not `init_if_needed`), so posting twice
 *      fails; the run skips straight to step 3 when the PDA already exists.
 *   3. `guardian_set_update` (selector 6), which creates the set-(index+1) `GuardianSet` PDA,
 *      bumps `Config.guardian_set_index`, and expires the outgoing set after the config's TTL.
 *
 * Usage: $0 --expect-index 1 --from-store --dry-run
 *        $0 --expect-index 1 --vaa-file upgrade.json --dry-run
 *        $0 --expect-index 1 --vaa-file upgrade.json --dry-run --cluster fogo_mainnet
 *        $0 --expect-index 1 --vaa-file upgrade.json --simulate --cluster devnet
 *        $0 --expect-index 1 --vaa-file upgrade.json --payer-keypair ~/pro-rotation.json
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ParsedVaa } from "@certusone/wormhole-sdk";
import { parseVaa, solana as wormholeSolana } from "@certusone/wormhole-sdk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { ProDeploymentType } from "../src/core/base";
import { isProDeploymentType, toDeploymentType } from "../src/core/base";
import { getProGuardianSetUpgrades } from "../src/core/pro_guardian_sets";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SVM_CHAINS_PATH = path.join(
  SCRIPT_DIR,
  "../src/store/chains/SvmChains.json",
);

/** The Wormhole "Core" governance module, right-aligned in 32 bytes. */
const CORE_MODULE = Buffer.concat([
  Buffer.alloc(28),
  Buffer.from("Core", "utf8"),
]);
/** The `GuardianSetUpgrade` action within the Core module. */
const GUARDIAN_SET_UPGRADE_ACTION = 2;
/**
 * The core bridge hard-codes its governance emitter in `constants.rs` (`GOVERNANCE_CHAIN` /
 * `GOVERNANCE_EMITTER`) rather than storing it in the `Config` account, so these are the values
 * every target checks the VAA against.
 */
const GOVERNANCE_EMITTER_CHAIN = 1;
const GOVERNANCE_EMITTER_ADDRESS = `0x${"00".repeat(31)}04`;
/** Byte offsets within a `GuardianSetUpgrade` payload. */
const PAYLOAD_HEADER_LENGTH = 40;
const GUARDIAN_KEY_LENGTH = 20;

/** `LegacyInstruction` selectors, from `src/legacy/instruction/mod.rs`. */
const LEGACY_IX_POST_VAA = 2;
const LEGACY_IX_GUARDIAN_SET_UPDATE = 6;
const LEGACY_IX_VERIFY_SIGNATURES = 7;

/** PDA seed prefixes, from `src/legacy/state/`. */
const CONFIG_SEED = Buffer.from("Bridge", "utf8");
const GUARDIAN_SET_SEED = Buffer.from("GuardianSet", "utf8");
const POSTED_VAA_SEED = Buffer.from("PostedVAA", "utf8");

/** `VerifySignaturesArgs.signer_indices` is a fixed `[i8; 19]`. */
const MAX_VERIFIED_SIGNATURES = 19;
/** The legacy instruction verifies at most 7 signatures per transaction (data size limit). */
const SIGNATURE_BATCH_SIZE = 7;

/** `Config` is a `LegacyAnchorized` account: no discriminator, borsh little-endian, 24 bytes. */
const CONFIG_SIZE = 24;
/**
 * `GuardianSet` is an `AccountVariant`: it is either Anchor-serialized (8-byte discriminator) or
 * legacy (no discriminator). Sets written by the pre-fork program are legacy; a set created by
 * this fork's `guardian_set_update` is Anchor-serialized, so both layouts must be readable.
 */
const GUARDIAN_SET_DISCRIMINATOR = createHash("sha256")
  .update("account:GuardianSet")
  .digest()
  .subarray(0, 8);

const READ_TIMEOUT_MS = 30_000;
const SUBMIT_TIMEOUT_MS = 3 * 60 * 1000;

type ProgramTarget = {
  id: string;
  label: string;
};

const PROGRAMS: ProgramTarget[] = [
  { id: "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ", label: "legacy" },
  {
    id: "HDw2E7P8X1SkCyjvoGsfBGAVUutKcj874bXjHrpVYrVL",
    label: "pro-compatible",
  },
];

/**
 * Fogo's public RPCs sit behind Cloudflare, which answers 403 to the default node-fetch
 * User-Agent. A browser-like one gets through and is harmless everywhere else, so every
 * connection this script opens carries it.
 */
const RPC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function svmConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, {
    commitment: "confirmed",
    httpHeaders: { "User-Agent": RPC_USER_AGENT },
  });
}

/** A cluster is any SVM chain id in the store; these two keep their original short names. */
const CLUSTER_ALIASES: Record<string, string> = {
  devnet: "solana_devnet",
  mainnet: "solana_mainnet",
};

/** What a bare run covers. Every other SVM chain has to be asked for by id. */
const DEFAULT_CLUSTERS = ["solana_mainnet", "solana_devnet"];

/** Public endpoints to fall back on when the store URL needs an env var that is not set. */
const FALLBACK_RPC: Record<string, string> = {
  solana_devnet: "https://api.devnet.solana.com",
  solana_mainnet: "https://api.mainnet-beta.solana.com",
};

type SvmChainConfig = {
  id: string;
  mainnet: boolean;
  rpcUrl?: string;
};

let svmChainsCache: SvmChainConfig[] | undefined;

function svmChains(): SvmChainConfig[] {
  svmChainsCache ??= JSON.parse(
    readFileSync(SVM_CHAINS_PATH, "utf8"),
  ) as SvmChainConfig[];
  return svmChainsCache;
}

function svmChain(chainId: string): SvmChainConfig {
  const chain = svmChains().find((entry) => entry.id === chainId);
  if (chain === undefined) {
    throw new Error(
      `Unknown cluster ${chainId}; SvmChains.json has ` +
        `${svmChains()
          .map((entry) => entry.id)
          .join(", ")} ` +
        `(aliases: ${Object.keys(CLUSTER_ALIASES).join(", ")})`,
    );
  }
  return chain;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // Handle the original promise so a later rejection does not become unhandled once the race
  // below has already reported the timeout.
  promise.catch(() => {
    // Ignored: the race reports the timeout instead.
  });
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// VAA parsing (shared shape with the EVM/Sui sibling)
// ─────────────────────────────────────────────────────────────────────────────

type GuardianSetUpgrade = {
  /** The emitter address, 0x-prefixed hex, as a 32-byte Wormhole address. */
  emitterAddress: string;
  emitterChain: number;
  /** The new guardian set, 0x-prefixed lowercase 20-byte ETH addresses, in order. */
  keys: string[];
  newIndex: number;
  /** The guardian set that signed the VAA; the set being replaced. */
  signingSetIndex: number;
  /** The chain the payload names, where 0 means every chain. */
  targetChain: number;
};

function parseGuardianSetUpgradeVaa(vaa: Buffer): {
  parsed: ParsedVaa;
  upgrade: GuardianSetUpgrade;
} {
  let parsed: ParsedVaa;
  try {
    parsed = parseVaa(vaa);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `the ${vaa.length}-byte input is not a well-formed VAA: ${detail}`,
    );
  }
  const { payload } = parsed;
  if (payload.length < PAYLOAD_HEADER_LENGTH) {
    throw new Error(
      `governance payload is ${payload.length} bytes, too short to be a guardian set upgrade`,
    );
  }

  const module = payload.subarray(0, 32);
  if (!module.equals(CORE_MODULE)) {
    throw new Error(
      `governance module is 0x${module.toString("hex")}, expected "Core" (0x${CORE_MODULE.toString("hex")})`,
    );
  }

  const action = payload.readUInt8(32);
  if (action !== GUARDIAN_SET_UPGRADE_ACTION) {
    throw new Error(
      `governance action is ${action}, expected ${GUARDIAN_SET_UPGRADE_ACTION} (GuardianSetUpgrade)`,
    );
  }

  const keyCount = payload.readUInt8(39);
  if (keyCount === 0) {
    throw new Error("guardian set upgrade carries no keys");
  }
  const expectedLength = PAYLOAD_HEADER_LENGTH + keyCount * GUARDIAN_KEY_LENGTH;
  if (payload.length !== expectedLength) {
    throw new Error(
      `guardian set upgrade payload is ${payload.length} bytes, expected ${expectedLength} for ${keyCount} keys`,
    );
  }

  const keys: string[] = [];
  for (let index = 0; index < keyCount; index++) {
    const offset = PAYLOAD_HEADER_LENGTH + index * GUARDIAN_KEY_LENGTH;
    const key = payload.subarray(offset, offset + GUARDIAN_KEY_LENGTH);
    keys.push(`0x${key.toString("hex")}`);
  }

  return {
    parsed,
    upgrade: {
      emitterAddress: `0x${parsed.emitterAddress.toString("hex")}`,
      emitterChain: parsed.emitterChain,
      keys,
      newIndex: payload.readUInt32BE(35),
      signingSetIndex: parsed.guardianSetIndex,
      targetChain: payload.readUInt16BE(33),
    },
  };
}

function describeUpgrade(
  upgrade: GuardianSetUpgrade,
  parsed: ParsedVaa,
  log: (line: string) => void,
): void {
  log(
    `VAA: guardian set ${upgrade.signingSetIndex} signs an upgrade to set ${upgrade.newIndex}`,
  );
  log(
    `  emitter: chain ${upgrade.emitterChain} address ${upgrade.emitterAddress}`,
  );
  log(
    `  target chain: ${upgrade.targetChain === 0 ? "0 (all chains)" : String(upgrade.targetChain)}`,
  );
  log(
    `  sequence ${parsed.sequence}, ${parsed.guardianSignatures.length} signature(s) from guardian indices ` +
      `[${parsed.guardianSignatures.map((signature) => signature.index).join(", ")}]`,
  );
  log(`  body hash: 0x${parsed.hash.toString("hex")}`);
  log(`  new guardian set (${upgrade.keys.length} keys):`);
  for (const [index, key] of upgrade.keys.entries()) {
    const base64 = Buffer.from(key.slice(2), "hex").toString("base64");
    log(`    [${index}] ${key}  ${base64}`);
  }
  if (
    upgrade.emitterChain !== GOVERNANCE_EMITTER_CHAIN ||
    upgrade.emitterAddress !== GOVERNANCE_EMITTER_ADDRESS
  ) {
    log(
      `  ! unexpected emitter: the core bridge hard-codes governance as chain ` +
        `${GOVERNANCE_EMITTER_CHAIN} address ${GOVERNANCE_EMITTER_ADDRESS}; every target will ` +
        `reject this VAA with InvalidGovernanceEmitter`,
    );
  }
}

function decodeVaaHex(source: string, origin: string): Buffer {
  const hex = source.trim().replace(/^0x/i, "");
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(`${origin} does not contain a hex-encoded VAA`);
  }
  return Buffer.from(hex, "hex");
}

/** Reads a VAA from a file holding either raw hex or JSON of the shape `{"vaa": "<hex>"}`. */
function loadVaaFile(filePath: string): Buffer {
  const contents = readFileSync(filePath, "utf8").trim();
  if (!contents.startsWith("{")) return decodeVaaHex(contents, filePath);
  const parsed: unknown = JSON.parse(contents);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("vaa" in parsed) ||
    typeof parsed.vaa !== "string"
  ) {
    throw new Error(`${filePath} is JSON but has no string "vaa" field`);
  }
  return decodeVaaHex(parsed.vaa, filePath);
}

/** One rotation to apply: the parsed upgrade and the VAA bytes that carry it. */
type UpgradeStep = {
  parsed: ParsedVaa;
  upgrade: GuardianSetUpgrade;
  vaa: Buffer;
};

/**
 * Resolves the rotations to apply, in the order they have to be applied.
 *
 * `--from-store` takes every rotation the store knows about up to `--expect-index`, which is what
 * a receiver still on an older set needs. A single `--vaa` / `--vaa-file` is the one-rotation
 * case, used while a rotation is being performed and before its VAA is committed to the store.
 * @throws {Error} if the sources conflict, or the store has no rotation installing `expectIndex`.
 */
function loadSteps(options: {
  deploymentType: ProDeploymentType;
  expectIndex: number;
  fromStore: boolean;
  vaa: string | undefined;
  vaaFile: string | undefined;
}): UpgradeStep[] {
  const { deploymentType, expectIndex, fromStore, vaa, vaaFile } = options;
  const sources = [vaa, vaaFile, fromStore ? "--from-store" : undefined].filter(
    (source) => source !== undefined,
  );
  if (sources.length > 1) {
    throw new Error("Pass exactly one of --vaa, --vaa-file or --from-store");
  }

  if (fromStore) {
    const upgrades = getProGuardianSetUpgrades(deploymentType);
    const selected = upgrades.filter(
      (upgrade) => upgrade.guardianSetIndex <= expectIndex,
    );
    if (selected.at(-1)?.guardianSetIndex !== expectIndex) {
      throw new Error(
        `the store has no ${deploymentType} rotation installing guardian set ${expectIndex}; ` +
          `it knows ${upgrades.length} rotation(s), up to index ${upgrades.at(-1)?.guardianSetIndex ?? 0}`,
      );
    }
    return selected.map((upgrade) => ({
      ...parseGuardianSetUpgradeVaa(upgrade.vaa),
      vaa: upgrade.vaa,
    }));
  }

  let bytes: Buffer;
  if (vaa !== undefined) bytes = decodeVaaHex(vaa, "--vaa");
  else if (vaaFile !== undefined) bytes = loadVaaFile(vaaFile);
  else throw new Error("Pass one of --vaa, --vaa-file or --from-store");
  return [{ ...parseGuardianSetUpgradeVaa(bytes), vaa: bytes }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Account addresses and decoding
// ─────────────────────────────────────────────────────────────────────────────

function derivePda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function guardianSetIndexSeed(index: number): Buffer {
  const seed = Buffer.alloc(4);
  seed.writeUInt32BE(index);
  return seed;
}

function deriveConfigKey(programId: PublicKey): PublicKey {
  return derivePda([CONFIG_SEED], programId);
}

function deriveGuardianSetKey(programId: PublicKey, index: number): PublicKey {
  return derivePda([GUARDIAN_SET_SEED, guardianSetIndexSeed(index)], programId);
}

function derivePostedVaaKey(programId: PublicKey, hash: Buffer): PublicKey {
  return derivePda([POSTED_VAA_SEED, hash], programId);
}

function deriveClaimKey(programId: PublicKey, parsed: ParsedVaa): PublicKey {
  const chain = Buffer.alloc(2);
  chain.writeUInt16BE(parsed.emitterChain);
  const sequence = Buffer.alloc(8);
  sequence.writeBigUInt64BE(parsed.sequence);
  return derivePda([parsed.emitterAddress, chain, sequence], programId);
}

type BridgeConfig = {
  feeLamports: bigint;
  guardianSetIndex: number;
  guardianSetTtlSeconds: number;
};

/** Decodes the `Config` account: `guardian_set_index`, an 8-byte gap, the TTL, and the fee. */
function decodeConfig(data: Buffer): BridgeConfig {
  if (data.length < CONFIG_SIZE) {
    throw new Error(
      `Config account is ${data.length} bytes, expected at least ${CONFIG_SIZE}`,
    );
  }
  return {
    feeLamports: data.readBigUInt64LE(16),
    guardianSetIndex: data.readUInt32LE(0),
    guardianSetTtlSeconds: data.readUInt32LE(12),
  };
}

type GuardianSetAccount = {
  creationTime: number;
  expirationTime: number;
  index: number;
  /** 0x-prefixed lowercase 20-byte ETH addresses, in order. */
  keys: string[];
};

function decodeGuardianSetAt(data: Buffer, offset: number): GuardianSetAccount {
  if (data.length < offset + 16) {
    throw new Error(
      `GuardianSet account is ${data.length} bytes, too short to decode at offset ${offset}`,
    );
  }
  const keyCount = data.readUInt32LE(offset + 4);
  const keysEnd = offset + 8 + keyCount * GUARDIAN_KEY_LENGTH;
  if (keyCount > MAX_VERIFIED_SIGNATURES || keysEnd + 8 > data.length) {
    throw new Error(
      `GuardianSet account at offset ${offset} claims ${keyCount} keys, which does not fit in ${data.length} bytes`,
    );
  }
  const keys: string[] = [];
  for (let index = 0; index < keyCount; index++) {
    const start = offset + 8 + index * GUARDIAN_KEY_LENGTH;
    keys.push(
      `0x${data.subarray(start, start + GUARDIAN_KEY_LENGTH).toString("hex")}`,
    );
  }
  return {
    creationTime: data.readUInt32LE(keysEnd),
    expirationTime: data.readUInt32LE(keysEnd + 4),
    index: data.readUInt32LE(offset),
    keys,
  };
}

/**
 * Decodes a `GuardianSet` account written either by the pre-fork program (no discriminator) or by
 * this fork's `guardian_set_update` (8-byte Anchor discriminator).
 */
function decodeGuardianSet(data: Buffer): GuardianSetAccount {
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(GUARDIAN_SET_DISCRIMINATOR)
  ) {
    return decodeGuardianSetAt(data, 8);
  }
  return decodeGuardianSetAt(data, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy instruction builders
//
// The fork keeps the original one-byte `LegacyInstruction` selector followed by borsh args, and
// the original account order. Each builder below is a transcription of the matching `#[derive
// (Accounts)]` struct in `target_chains/solana/programs/core-bridge/src/legacy/processor/`, and
// agrees with the account order in `@certusone/wormhole-sdk`'s wormhole IDL.
// ─────────────────────────────────────────────────────────────────────────────

function accountMeta(pubkey: PublicKey, isWritable: boolean, isSigner = false) {
  return { isSigner, isWritable, pubkey };
}

/** `VerifySignatures` — payer, guardian_set, signature_set, instructions, _rent, system_program. */
function createVerifySignaturesInstruction(
  programId: PublicKey,
  payer: PublicKey,
  guardianSetIndex: number,
  signatureSet: PublicKey,
  signerIndices: number[],
): TransactionInstruction {
  const data = Buffer.alloc(1 + MAX_VERIFIED_SIGNATURES);
  data.writeUInt8(LEGACY_IX_VERIFY_SIGNATURES, 0);
  for (const [offset, value] of signerIndices.entries()) {
    data.writeInt8(value, 1 + offset);
  }
  return new TransactionInstruction({
    data,
    keys: [
      accountMeta(payer, true, true),
      accountMeta(deriveGuardianSetKey(programId, guardianSetIndex), false),
      accountMeta(signatureSet, true, true),
      accountMeta(SYSVAR_INSTRUCTIONS_PUBKEY, false),
      accountMeta(SYSVAR_RENT_PUBKEY, false),
      accountMeta(SystemProgram.programId, false),
    ],
    programId,
  });
}

/**
 * `PostVaa` — guardian_set, _config, signature_set, posted_vaa, payer, _clock, _rent,
 * system_program. The `version` and `guardian_set_index` args land in the fork's `_gap_0: [u8; 5]`.
 */
function createPostVaaInstruction(
  programId: PublicKey,
  payer: PublicKey,
  parsed: ParsedVaa,
  signatureSet: PublicKey,
): TransactionInstruction {
  // selector(1) version(1) guardian_set_index(4) timestamp(4) nonce(4) emitter_chain(2) emitter_address(32)
  const header = Buffer.alloc(48);
  header.writeUInt8(LEGACY_IX_POST_VAA, 0);
  header.writeUInt8(parsed.version, 1);
  header.writeUInt32LE(parsed.guardianSetIndex, 2);
  header.writeUInt32LE(parsed.timestamp, 6);
  header.writeUInt32LE(parsed.nonce, 10);
  header.writeUInt16LE(parsed.emitterChain, 14);
  parsed.emitterAddress.copy(header, 16);
  const tail = Buffer.alloc(13);
  tail.writeBigUInt64LE(parsed.sequence, 0);
  tail.writeUInt8(parsed.consistencyLevel, 8);
  tail.writeUInt32LE(parsed.payload.length, 9);

  return new TransactionInstruction({
    data: Buffer.concat([header, tail, parsed.payload]),
    keys: [
      accountMeta(
        deriveGuardianSetKey(programId, parsed.guardianSetIndex),
        false,
      ),
      accountMeta(deriveConfigKey(programId), false),
      accountMeta(signatureSet, false),
      accountMeta(derivePostedVaaKey(programId, parsed.hash), true),
      accountMeta(payer, true, true),
      accountMeta(SYSVAR_CLOCK_PUBKEY, false),
      accountMeta(SYSVAR_RENT_PUBKEY, false),
      accountMeta(SystemProgram.programId, false),
    ],
    programId,
  });
}

/**
 * `GuardianSetUpdate` — payer, config, vaa, claim, curr_guardian_set, new_guardian_set,
 * system_program. `EmptyArgs` serializes to zero bytes, so the data is just the selector.
 */
function createGuardianSetUpdateInstruction(
  programId: PublicKey,
  payer: PublicKey,
  parsed: ParsedVaa,
): TransactionInstruction {
  return new TransactionInstruction({
    data: Buffer.from([LEGACY_IX_GUARDIAN_SET_UPDATE]),
    keys: [
      accountMeta(payer, true, true),
      accountMeta(deriveConfigKey(programId), true),
      accountMeta(derivePostedVaaKey(programId, parsed.hash), false),
      accountMeta(deriveClaimKey(programId, parsed), true),
      accountMeta(
        deriveGuardianSetKey(programId, parsed.guardianSetIndex),
        true,
      ),
      accountMeta(
        deriveGuardianSetKey(programId, parsed.guardianSetIndex + 1),
        true,
      ),
      accountMeta(SystemProgram.programId, false),
    ],
    programId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────────────

type RowStatus =
  | "skipped-already-at-target"
  | "skipped-not-deployed"
  | "would-submit"
  | "submitted"
  | "error";

type Row = {
  cluster: string;
  endIndex: string;
  error?: string;
  mainnet: boolean;
  postVaaTx: string;
  program: string;
  startIndex: string;
  status: RowStatus;
  txId: string;
};

type RowIdentity = {
  cluster: string;
  mainnet: boolean;
  program: string;
};

const UNKNOWN = "—";

function normalizeKeys(keys: string[]): string[] {
  return keys.map((key) => {
    const lower = key.toLowerCase();
    return lower.startsWith("0x") ? lower : `0x${lower}`;
  });
}

/** Describes how the on-chain keys differ from the VAA's, or undefined when they match. */
function diffKeys(onChain: string[], expected: string[]): string | undefined {
  const wanted = normalizeKeys(expected);
  const actual = normalizeKeys(onChain);
  if (actual.length !== wanted.length) {
    return `on-chain set has ${actual.length} keys, the VAA has ${wanted.length}`;
  }
  const mismatch = actual.findIndex((key, index) => key !== wanted[index]);
  if (mismatch === -1) return undefined;
  return `key ${mismatch} is ${actual[mismatch]} on chain, ${wanted[mismatch]} in the VAA`;
}

function shortErrorMessage(error: unknown, verbose: boolean): string {
  let message = "An error occurred";
  if (error instanceof Error) {
    message = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    message = String(error.message);
  }
  const logs =
    typeof error === "object" &&
    error !== null &&
    "logs" in error &&
    Array.isArray(error.logs)
      ? `\n${error.logs.join("\n")}`
      : "";
  return verbose ? `${message}${logs}` : message.slice(0, 200);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotation
// ─────────────────────────────────────────────────────────────────────────────

type Target = RowIdentity & {
  /** True when --program named this program, which makes a missing deployment an error. */
  programExplicit: boolean;
  programId: PublicKey;
  rpcUrl: string;
};

type RotateOptions = {
  computeUnitLimit: number | undefined;
  dryRun: boolean;
  payer: Keypair | undefined;
  priorityFeeMicroLamports: number | undefined;
  simulate: boolean;
  verbose: boolean;
};

function budgetInstructions(options: RotateOptions): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  if (options.computeUnitLimit !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: options.computeUnitLimit,
      }),
    );
  }
  if (options.priorityFeeMicroLamports !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: options.priorityFeeMicroLamports,
      }),
    );
  }
  return instructions;
}

/**
 * Builds the secp256k1 / verify_signatures instruction pairs. The precompile instruction must sit
 * immediately before its `verify_signatures` instruction, which reads it back out of the
 * instructions sysvar at `current_index - 1`; any compute-budget instructions go in front of both.
 */
function buildVerifyTransactions(
  target: Target,
  parsed: ParsedVaa,
  guardianKeys: string[],
  signatureSet: PublicKey,
  payer: PublicKey,
  options: RotateOptions,
): Transaction[] {
  const transactions: Transaction[] = [];
  for (
    let start = 0;
    start < parsed.guardianSignatures.length;
    start += SIGNATURE_BATCH_SIZE
  ) {
    const batch = parsed.guardianSignatures.slice(
      start,
      start + SIGNATURE_BATCH_SIZE,
    );
    const signerIndices = new Array<number>(MAX_VERIFIED_SIGNATURES).fill(-1);
    const signatures: Buffer[] = [];
    const keys: Buffer[] = [];
    for (const [position, signature] of batch.entries()) {
      const key = guardianKeys[signature.index];
      if (key === undefined) {
        throw new Error(
          `the VAA carries a signature from guardian index ${signature.index}, but the on-chain ` +
            `set has only ${guardianKeys.length} keys`,
        );
      }
      if (signature.index >= MAX_VERIFIED_SIGNATURES) {
        throw new Error(
          `guardian index ${signature.index} is past the ${MAX_VERIFIED_SIGNATURES}-signer limit of the legacy verify_signatures instruction`,
        );
      }
      signatures.push(signature.signature);
      keys.push(Buffer.from(key.slice(2), "hex"));
      signerIndices[signature.index] = position;
    }
    const transaction = new Transaction().add(
      ...budgetInstructions(options),
      // `parsed.hash` is keccak256(body); the precompile hashes it again, so what the guardians
      // signed — the double-keccak digest — is what gets recovered.
      wormholeSolana.createSecp256k1Instruction(signatures, keys, parsed.hash),
      createVerifySignaturesInstruction(
        target.programId,
        payer,
        parsed.guardianSetIndex,
        signatureSet,
        signerIndices,
      ),
    );
    transactions.push(transaction);
  }
  return transactions;
}

async function simulateTarget(
  connection: Connection,
  target: Target,
  parsed: ParsedVaa,
  guardianKeys: string[],
  options: RotateOptions,
): Promise<void> {
  const payer = options.payer ?? Keypair.generate();
  const signatureSet = Keypair.generate();
  const transactions = buildVerifyTransactions(
    target,
    parsed,
    guardianKeys,
    signatureSet.publicKey,
    payer.publicKey,
    options,
  );
  for (const [index, transaction] of transactions.entries()) {
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = (
      await withTimeout(connection.getLatestBlockhash(), READ_TIMEOUT_MS)
    ).blockhash;
    const result = await withTimeout(
      connection.simulateTransaction(transaction, [payer, signatureSet]),
      READ_TIMEOUT_MS,
    );
    if (result.value.err !== null) {
      const logs = (result.value.logs ?? []).join("\n");
      throw new Error(
        `verify_signatures batch ${index} simulation failed: ${JSON.stringify(result.value.err)}\n${logs}`,
      );
    }
    if (options.verbose) {
      console.error(
        `[${target.cluster}/${target.program}] verify_signatures batch ${index} simulated OK ` +
          `(${result.value.unitsConsumed ?? "?"} CU)`,
      );
    }
  }
}

/** Sends `verify_signatures` and `post_vaa`, returning the post_vaa signature. */
async function postVaa(
  connection: Connection,
  target: Target,
  parsed: ParsedVaa,
  guardianKeys: string[],
  payer: Keypair,
  options: RotateOptions,
): Promise<string> {
  const signatureSet = Keypair.generate();
  const transactions = buildVerifyTransactions(
    target,
    parsed,
    guardianKeys,
    signatureSet.publicKey,
    payer.publicKey,
    options,
  );
  for (const transaction of transactions) {
    await withTimeout(
      sendAndConfirmTransaction(connection, transaction, [payer, signatureSet]),
      SUBMIT_TIMEOUT_MS,
    );
  }
  const postTransaction = new Transaction().add(
    ...budgetInstructions(options),
    createPostVaaInstruction(
      target.programId,
      payer.publicKey,
      parsed,
      signatureSet.publicKey,
    ),
  );
  // The signature set does not have to sign post_vaa — it is only read.
  return withTimeout(
    sendAndConfirmTransaction(connection, postTransaction, [payer]),
    SUBMIT_TIMEOUT_MS,
  );
}

async function readAccount(
  connection: Connection,
  key: PublicKey,
): Promise<Buffer | undefined> {
  const info = await withTimeout(
    connection.getAccountInfo(key),
    READ_TIMEOUT_MS,
  );
  return info === null ? undefined : info.data;
}

async function rotateTarget(
  target: Target,
  upgrade: GuardianSetUpgrade,
  parsed: ParsedVaa,
  options: RotateOptions,
  log: (line: string) => void,
): Promise<Row> {
  const identity: RowIdentity = {
    cluster: target.cluster,
    mainnet: target.mainnet,
    program: target.program,
  };
  const fail = (error: string, extra: Partial<Row> = {}): Row => ({
    ...identity,
    endIndex: UNKNOWN,
    error,
    postVaaTx: "",
    startIndex: UNKNOWN,
    status: "error",
    txId: "",
    ...extra,
  });

  try {
    const connection = svmConnection(target.rpcUrl);

    // Not every SVM chain carries both programs — Fogo has only the legacy one — so a default
    // run reports an absent program as skipped rather than failing the whole run. A program the
    // operator named explicitly still has to be there.
    const programInfo = await withTimeout(
      connection.getAccountInfo(target.programId),
      READ_TIMEOUT_MS,
    );
    if (programInfo === null || !programInfo.executable) {
      const detail = `${target.programId.toBase58()} is not an executable account on ${target.cluster}`;
      if (target.programExplicit) return fail(detail);
      log(`[${target.cluster}/${target.program}] ${detail}; skipping`);
      return {
        ...identity,
        endIndex: UNKNOWN,
        postVaaTx: "",
        startIndex: UNKNOWN,
        status: "skipped-not-deployed",
        txId: "",
      };
    }

    const configData = await readAccount(
      connection,
      deriveConfigKey(target.programId),
    );
    if (configData === undefined) {
      return fail(
        `no Config account at ${deriveConfigKey(target.programId).toBase58()}; is ${target.programId.toBase58()} deployed and initialized on ${target.cluster}?`,
      );
    }
    const config = decodeConfig(configData);
    const currentSetKey = deriveGuardianSetKey(
      target.programId,
      config.guardianSetIndex,
    );
    const currentSetData = await readAccount(connection, currentSetKey);
    if (currentSetData === undefined) {
      return fail(
        `Config says guardian set ${config.guardianSetIndex}, but ${currentSetKey.toBase58()} does not exist`,
        { startIndex: String(config.guardianSetIndex) },
      );
    }
    const currentSet = decodeGuardianSet(currentSetData);
    const startIndex = String(config.guardianSetIndex);

    log(
      `[${target.cluster}/${target.program}] ${target.programId.toBase58()}: guardian set ` +
        `${currentSet.index}, ${currentSet.keys.length} keys, TTL ${config.guardianSetTtlSeconds}s, ` +
        `created ${currentSet.creationTime}, expiration ${currentSet.expirationTime === 0 ? "0 (active)" : currentSet.expirationTime}`,
    );
    for (const [index, key] of currentSet.keys.entries()) {
      const base64 = Buffer.from(key.slice(2), "hex").toString("base64");
      log(`    [${index}] ${key}  ${base64}`);
    }

    if (currentSet.index !== config.guardianSetIndex) {
      return fail(
        `Config says index ${config.guardianSetIndex} but the account at that PDA says ${currentSet.index}`,
        { startIndex },
      );
    }

    if (config.guardianSetIndex >= upgrade.newIndex) {
      // Already at or past the target. If it is exactly the target, the keys had better be the
      // ones this VAA installs, or something else rotated this receiver.
      const drift =
        config.guardianSetIndex === upgrade.newIndex
          ? diffKeys(currentSet.keys, upgrade.keys)
          : undefined;
      if (drift !== undefined) {
        return fail(
          `already at index ${config.guardianSetIndex} but the on-chain keys are not the VAA's: ${drift}`,
          { endIndex: startIndex, startIndex },
        );
      }
      return {
        ...identity,
        endIndex: startIndex,
        postVaaTx: "",
        startIndex,
        status: "skipped-already-at-target",
        txId: "",
      };
    }

    if (config.guardianSetIndex + 1 !== upgrade.newIndex) {
      return fail(
        `at index ${config.guardianSetIndex}, but the VAA upgrades ${upgrade.newIndex - 1} to ${upgrade.newIndex}; the core bridge only accepts the next set in sequence`,
        { startIndex },
      );
    }

    if (
      upgrade.emitterChain !== GOVERNANCE_EMITTER_CHAIN ||
      upgrade.emitterAddress !== GOVERNANCE_EMITTER_ADDRESS
    ) {
      return fail(
        `the VAA's emitter is chain ${upgrade.emitterChain} address ${upgrade.emitterAddress}, but the core bridge hard-codes governance as chain ${GOVERNANCE_EMITTER_CHAIN} address ${GOVERNANCE_EMITTER_ADDRESS}`,
        { startIndex },
      );
    }

    if (upgrade.signingSetIndex !== config.guardianSetIndex) {
      return fail(
        `the VAA was signed by guardian set ${upgrade.signingSetIndex}, but governance requires the current set ${config.guardianSetIndex} (LatestGuardianSetRequired)`,
        { startIndex },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (currentSet.expirationTime !== 0 && currentSet.expirationTime < now) {
      return fail(
        `guardian set ${currentSet.index} expired at ${currentSet.expirationTime}; it can no longer attest for a VAA`,
        { startIndex },
      );
    }

    if (options.dryRun) {
      return {
        ...identity,
        endIndex: UNKNOWN,
        postVaaTx: "",
        startIndex,
        status: "would-submit",
        txId: "",
      };
    }

    if (options.simulate) {
      await simulateTarget(
        connection,
        target,
        parsed,
        currentSet.keys,
        options,
      );
      return {
        ...identity,
        endIndex: UNKNOWN,
        postVaaTx: "simulated",
        startIndex,
        status: "would-submit",
        txId: "",
      };
    }

    const payer = options.payer;
    if (payer === undefined) {
      throw new Error("no payer available; --payer-keypair is required");
    }

    // post_vaa declares the PostedVAA account `init`, so a second post fails outright. Skip the
    // whole verify/post leg when a previous (partial) run already created it.
    const postedVaaKey = derivePostedVaaKey(target.programId, parsed.hash);
    const alreadyPosted =
      (await readAccount(connection, postedVaaKey)) !== undefined;
    let postVaaTx = "already-posted";
    if (alreadyPosted) {
      log(
        `[${target.cluster}/${target.program}] ${postedVaaKey.toBase58()} already exists; skipping verify_signatures/post_vaa`,
      );
    } else {
      postVaaTx = await postVaa(
        connection,
        target,
        parsed,
        currentSet.keys,
        payer,
        options,
      );
    }

    const upgradeTransaction = new Transaction().add(
      ...budgetInstructions(options),
      createGuardianSetUpdateInstruction(
        target.programId,
        payer.publicKey,
        parsed,
      ),
    );
    const txId = await withTimeout(
      sendAndConfirmTransaction(connection, upgradeTransaction, [payer]),
      SUBMIT_TIMEOUT_MS,
    );

    const endConfigData = await readAccount(
      connection,
      deriveConfigKey(target.programId),
    );
    if (endConfigData === undefined) {
      return fail("Config account disappeared after the upgrade", {
        postVaaTx,
        startIndex,
        txId,
      });
    }
    const endConfig = decodeConfig(endConfigData);
    if (endConfig.guardianSetIndex !== upgrade.newIndex) {
      return fail(
        `submitted but the guardian set index is ${endConfig.guardianSetIndex}, expected ${upgrade.newIndex}`,
        {
          endIndex: String(endConfig.guardianSetIndex),
          postVaaTx,
          startIndex,
          txId,
        },
      );
    }
    const newSetData = await readAccount(
      connection,
      deriveGuardianSetKey(target.programId, upgrade.newIndex),
    );
    if (newSetData === undefined) {
      return fail(
        `submitted and the index advanced, but the set-${upgrade.newIndex} account does not exist`,
        {
          endIndex: String(endConfig.guardianSetIndex),
          postVaaTx,
          startIndex,
          txId,
        },
      );
    }
    const newSet = decodeGuardianSet(newSetData);
    const drift = diffKeys(newSet.keys, upgrade.keys);
    if (drift !== undefined || newSet.index !== upgrade.newIndex) {
      return fail(
        drift ??
          `the new account reports index ${newSet.index}, expected ${upgrade.newIndex}`,
        {
          endIndex: String(endConfig.guardianSetIndex),
          postVaaTx,
          startIndex,
          txId,
        },
      );
    }
    return {
      ...identity,
      endIndex: String(endConfig.guardianSetIndex),
      postVaaTx,
      startIndex,
      status: "submitted",
      txId,
    };
  } catch (error) {
    if (options.verbose) {
      console.error(`[${target.cluster}/${target.program}]`, error);
    }
    return fail(shortErrorMessage(error, options.verbose));
  }
}

/**
 * Applies every rotation to one target, in order, and folds the per-step results into one row.
 *
 * Each step re-reads the target's `Config`, which is what makes the sequence safe to resume: a
 * rotation already applied comes back `skipped-already-at-target` and the next one is attempted
 * against the index actually on chain. The sequence stops at the first step that does not move the
 * target forward, because nothing after it could be accepted anyway.
 * @param {Target} target The program on a cluster to rotate.
 * @param {UpgradeStep[]} steps The rotations to apply, in order.
 * @param {RotateOptions} options How to submit, or whether to submit at all.
 * @param {Function} log Where to write progress lines.
 * @returns One row describing where the target started, where it ended, and every tx it took.
 */
async function rotateTargetSteps(
  target: Target,
  steps: UpgradeStep[],
  options: RotateOptions,
  log: (line: string) => void,
): Promise<Row> {
  const applied: Row[] = [];
  for (const step of steps) {
    const row = await rotateTarget(
      target,
      step.upgrade,
      step.parsed,
      options,
      log,
    );
    applied.push(row);
    if (
      row.status !== "submitted" &&
      row.status !== "skipped-already-at-target"
    ) {
      break;
    }
  }

  const first = applied[0];
  const last = applied.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error("no guardian set upgrade to apply");
  }
  if (applied.length === 1) return first;
  const join = (values: string[]) =>
    values.filter((value) => value.length > 0).join(" ");
  return {
    ...last,
    postVaaTx: join(applied.map((row) => row.postVaaTx)),
    startIndex: first.startIndex,
    txId: join(applied.map((row) => row.txId)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a cluster's RPC URL: an explicit override wins, then the store entry (with any
 * `$ENV_*` placeholder substituted), then a public fallback where one exists. The public Solana
 * mainnet RPC is heavily rate limited, so a real mainnet rotation should pass an override or set
 * the store's env var.
 */
function resolveRpcUrl(
  chainId: string,
  override: string | undefined,
  log: (line: string) => void,
): string {
  if (override !== undefined) return override;
  const storeUrl = svmChain(chainId).rpcUrl;
  const fallback = FALLBACK_RPC[chainId];
  if (storeUrl === undefined) {
    if (fallback === undefined) {
      throw new Error(
        `${chainId} has no rpcUrl in SvmChains.json; pass --rpc-url ${chainId}=<url>`,
      );
    }
    return fallback;
  }

  let resolved = storeUrl;
  for (const match of storeUrl.match(/\$ENV_\w+/g) ?? []) {
    const value = process.env[match.replace("$ENV_", "")];
    if (value === undefined || value === "") {
      if (fallback === undefined) {
        throw new Error(
          `${chainId}: ${match} is unset and there is no public fallback; pass --rpc-url ${chainId}=<url>`,
        );
      }
      log(
        `! ${chainId}: ${match} is unset, falling back to ${fallback} ` +
          `(rate limited; pass --rpc-url ${chainId}=<url> for a real run)`,
      );
      return fallback;
    }
    resolved = resolved.replace(match, value);
  }
  return resolved;
}

/** Parses `--rpc-url <cluster>=<url>` entries, with --mainnet-rpc / --devnet-rpc folded in. */
function resolveRpcOverrides(
  entries: string[] | undefined,
  mainnetRpc: string | undefined,
  devnetRpc: string | undefined,
): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (mainnetRpc !== undefined) overrides.solana_mainnet = mainnetRpc;
  if (devnetRpc !== undefined) overrides.solana_devnet = devnetRpc;
  for (const entry of entries ?? []) {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      throw new Error(`--rpc-url expects <cluster>=<url>, got ${entry}`);
    }
    const cluster = entry.slice(0, separator);
    overrides[CLUSTER_ALIASES[cluster] ?? cluster] = entry.slice(separator + 1);
  }
  return overrides;
}

function loadKeypair(keypairPath: string): Keypair {
  const secret = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function resolvePrograms(requested: string[] | undefined): ProgramTarget[] {
  if (requested === undefined) return PROGRAMS;
  return requested.map((value) => {
    const known = PROGRAMS.find(
      (program) => program.id === value || program.label === value,
    );
    if (known !== undefined) return known;
    // Allow an arbitrary program id so a throwaway devnet deployment can be targeted too.
    return { id: new PublicKey(value).toBase58(), label: "custom" };
  });
}

/** Maps the short aliases onto store chain ids and checks every one exists in the store. */
function resolveClusters(requested: string[] | undefined): string[] {
  const clusters = (requested ?? DEFAULT_CLUSTERS).map(
    (cluster) => CLUSTER_ALIASES[cluster] ?? cluster,
  );
  for (const cluster of clusters) svmChain(cluster);
  return clusters;
}

/** Mainnet first, then by cluster and program, so the riskiest rows are read first. */
function compareRows(a: Row, b: Row): number {
  if (a.mainnet !== b.mainnet) return a.mainnet ? -1 : 1;
  const byCluster = a.cluster.localeCompare(b.cluster);
  return byCluster === 0 ? a.program.localeCompare(b.program) : byCluster;
}

const parser = yargs(hideBin(process.argv))
  .scriptName("sync_pro_guardian_set_svm.ts")
  .usage(
    "Rotates the guardian set on the Pyth Pro SVM receivers.\n" +
      "Applies one upgrade VAA, or with --from-store every rotation the store knows about.\n" +
      "Exits 0 only when every target was skipped or submitted-and-verified, so a --dry-run\n" +
      "with work left to do exits 1.\n" +
      "Usage: $0 --expect-index <n> (--vaa <hex> | --vaa-file <path> | --from-store) [--dry-run | --simulate | --payer-keypair <path>]",
  )
  .options({
    cluster: {
      array: true,
      desc: "SVM chain ids from SvmChains.json (solana_mainnet, solana_devnet, fogo_mainnet, fogo_testnet, …); mainnet / devnet alias the two solana ids; defaults to both solana clusters",
      type: "string",
    },
    "compute-unit-limit": {
      desc: "Explicit compute unit limit for every transaction; omitted by default",
      type: "number",
    },
    "deployment-type": {
      default: "pro-compatible-production",
      desc: "Which Pro deployment's rotations --from-store reads: pro-compatible-production or pro-compatible-staging",
      type: "string",
    },
    "devnet-rpc": {
      desc: "RPC URL override for solana_devnet; shorthand for --rpc-url solana_devnet=<url>",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Read and report only; build and send nothing",
      type: "boolean",
    },
    "expect-index": {
      demandOption: true,
      desc: "The guardian set index the last VAA must install; the run aborts if the VAA says otherwise",
      type: "number",
    },
    "from-store": {
      default: false,
      desc: "Replay every rotation in src/store/guardian_sets/ for this deployment type, in order, up to --expect-index. What a freshly initialized receiver needs",
      type: "boolean",
    },
    json: {
      default: false,
      desc: "Print the rows as JSON on the last line of stdout instead of as a table",
      type: "boolean",
    },
    "mainnet-rpc": {
      desc: "RPC URL override for solana_mainnet; shorthand for --rpc-url solana_mainnet=<url> (the public endpoint is heavily rate limited)",
      type: "string",
    },
    "payer-keypair": {
      desc: "Path to a JSON keypair file that pays for and signs the transactions; required unless --dry-run or --simulate",
      type: "string",
    },
    "priority-fee-micro-lamports": {
      desc: "Compute unit price in micro-lamports; omitted by default",
      type: "number",
    },
    program: {
      array: true,
      desc: "Program ids (or the labels legacy / pro-compatible) to act on; defaults to both, in which case a program that is not deployed on a cluster is skipped rather than failed",
      type: "string",
    },
    "rpc-url": {
      array: true,
      desc: "Per-cluster RPC override, as <cluster>=<url>; repeatable",
      type: "string",
    },
    simulate: {
      default: false,
      desc: "Build the real transactions but only simulate the verify_signatures leg; sends nothing",
      type: "boolean",
    },
    vaa: {
      desc: "The guardian set upgrade VAA, hex encoded",
      type: "string",
    },
    "vaa-file": {
      desc: 'A file holding the VAA, either raw hex or JSON of the shape {"vaa": "<hex>"}',
      type: "string",
    },
    verbose: {
      default: false,
      desc: "Print full error messages, program logs and stack traces",
      type: "boolean",
    },
  });

async function main() {
  const argv = await parser.argv;
  // In --json mode everything but the JSON goes to stderr. It is still only the *last* line of
  // stdout: an imported library prints a secp256k1 warning there before main() runs.
  const log = argv.json
    ? (line: string) => {
        console.error(line);
      }
    : (line: string) => {
        console.log(line);
      };

  if (argv.dryRun && argv.simulate) {
    throw new Error("Pass either --dry-run or --simulate, not both");
  }

  const deploymentType = toDeploymentType(argv.deploymentType);
  if (!isProDeploymentType(deploymentType)) {
    throw new Error(
      `--deployment-type must be pro-compatible-production or pro-compatible-staging, got ${deploymentType}`,
    );
  }

  // Everything up to here and through the --expect-index guard is local: no RPC is made until we
  // are sure these are the VAAs the operator meant to send.
  const steps = loadSteps({
    deploymentType,
    expectIndex: argv.expectIndex,
    fromStore: argv.fromStore,
    vaa: argv.vaa,
    vaaFile: argv.vaaFile,
  });
  for (const step of steps) describeUpgrade(step.upgrade, step.parsed, log);
  const target = steps.at(-1)?.upgrade;
  if (target === undefined) throw new Error("no guardian set upgrade to apply");
  if (argv.expectIndex !== target.newIndex) {
    throw new Error(
      `--expect-index ${argv.expectIndex} does not match the VAA's new guardian set index ${target.newIndex}; refusing to run`,
    );
  }

  let payer: Keypair | undefined;
  if (argv.payerKeypair !== undefined) {
    payer = loadKeypair(argv.payerKeypair);
  } else if (!argv.dryRun && !argv.simulate) {
    throw new Error(
      "--payer-keypair is required unless --dry-run or --simulate",
    );
  }

  const clusters = resolveClusters(argv.cluster);
  const programsExplicit = argv.program !== undefined;
  const programs = resolvePrograms(argv.program);
  const rpcOverrides = resolveRpcOverrides(
    argv.rpcUrl,
    argv.mainnetRpc,
    argv.devnetRpc,
  );
  const targets: Target[] = [];
  for (const cluster of clusters) {
    const rpcUrl = resolveRpcUrl(cluster, rpcOverrides[cluster], log);
    for (const program of programs) {
      targets.push({
        cluster,
        mainnet: svmChain(cluster).mainnet,
        program: program.label,
        programExplicit: programsExplicit,
        programId: new PublicKey(program.id),
        rpcUrl,
      });
    }
  }

  let mode = "";
  if (argv.dryRun) mode = " (dry run)";
  if (argv.simulate) mode = " (simulate)";
  log(
    `\nRotating ${targets.length} SVM receiver(s) to guardian set ${target.newIndex}${mode}` +
      `${steps.length > 1 ? ` by replaying ${steps.length} rotation(s)` : ""}...`,
  );
  if (payer !== undefined) {
    log(`Payer: ${payer.publicKey.toBase58()}`);
  }

  const options: RotateOptions = {
    computeUnitLimit: argv.computeUnitLimit,
    dryRun: argv.dryRun,
    payer,
    priorityFeeMicroLamports: argv.priorityFeeMicroLamports,
    simulate: argv.simulate,
    verbose: argv.verbose,
  };
  const rows: Row[] = [];
  // Sequential: the two programs on one cluster share an RPC endpoint, and a rotation is rare
  // enough that being gentle with a rate-limited endpoint beats finishing a second sooner.
  for (const svmTarget of targets) {
    rows.push(await rotateTargetSteps(svmTarget, steps, options, log));
  }
  rows.sort(compareRows);

  const count = (status: RowStatus) =>
    rows.filter((row) => row.status === status).length;
  const ok = rows.every(
    (row) =>
      row.status === "skipped-already-at-target" ||
      row.status === "skipped-not-deployed" ||
      row.status === "submitted",
  );

  if (argv.json) {
    console.log(
      JSON.stringify({
        keys: target.keys,
        newIndex: target.newIndex,
        ok,
        rows,
      }),
    );
  } else {
    console.table(rows);
  }
  log(
    `Summary: ${rows.length} target(s) — ${count("submitted")} submitted, ` +
      `${count("skipped-already-at-target")} already at index ${target.newIndex}, ` +
      `${count("skipped-not-deployed")} not deployed, ` +
      `${count("would-submit")} would submit, ${count("error")} error(s)`,
  );
  process.exit(ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
