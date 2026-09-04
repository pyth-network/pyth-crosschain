/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Rotates the guardian set on every Pyth Pro receiver in the store.
 *
 * A Pro receiver is a Wormhole-style contract whose guardian set is the list of Pro router
 * signing keys. The routers produce one standard Wormhole guardian-set-upgrade governance VAA
 * (module "Core", action 2) signed by a quorum of the current set; every receiver accepts the
 * same VAA through its normal upgrade path, so this script broadcasts the same VAA everywhere.
 *
 * Two ways to say which rotation(s) to apply:
 *   --vaa / --vaa-file  one VAA, for the rotation being performed right now
 *   --from-store        every rotation the store knows about, from
 *                       `src/store/guardian_sets/`, replayed in order up to --expect-index
 *
 * --from-store is what a freshly deployed receiver needs: it is created on set 0 and has to climb
 * the whole ladder before it can verify anything the routers sign.
 *
 * The VAAs are parsed and checked locally before any chain is touched: the last one's new set
 * index must equal --expect-index, which is the guard against submitting a VAA meant for a
 * different rotation. Every EVM receiver is then chain-id checked against the store before it is
 * read, because a store entry aimed at the wrong network reads a different contract at the same
 * address and a healthy-looking answer from it means nothing. A receiver is only submitted to when
 * the next VAA to apply is exactly one above its current index — an index at or beyond the target
 * is reported, never quietly treated as done — and after submitting, the index and the key list
 * are read back and compared against the VAA.
 *
 * One chain failing never aborts the run — every contract gets a row and the exit code is 0 only
 * when every row was skipped or submitted-and-verified. Chains that cannot be reached at all, such
 * as a dead chain with no working RPC, are named with --skip-chain: they get a `skipped-excluded`
 * row, no RPC call is made for them, and they do not count against the exit code.
 *
 * Usage: $0 --expect-index 1 --from-store --dry-run
 *        $0 --expect-index 1 --vaa-file upgrade.json --dry-run
 *        $0 --expect-index 1 --vaa-file upgrade.json --private-key <key>
 *        $0 --expect-index 1 --vaa-file upgrade.json --dry-run --skip-chain injective_inevm
 */

// Must come first: pins native fetch before the contract imports below transitively load
// near-api-js, which clobbers globalThis.fetch with node-fetch (whose Response.body lacks
// getReader(), breaking fuels). See the module docs.
import "../src/node/utils/preserve-native-fetch";

import { readFileSync } from "node:fs";

import { parseVaa } from "@certusone/wormhole-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type {
  DeploymentType,
  PrivateKey,
  ProDeploymentType,
} from "../src/core/base";
import { toDeploymentType, toPrivateKey } from "../src/core/base";
import {
  EvmWormholeContract,
  SuiWormholeContract,
} from "../src/core/contracts";
import type { WormholeContract } from "../src/core/contracts/wormhole";
import { getProGuardianSetUpgrades } from "../src/core/pro_guardian_sets";
import { DefaultStore } from "../src/node/utils/store";
import { isProDeploymentType } from "./pro_cutover";

const CHAIN_ID_TIMEOUT_MS = 20_000;
const GUARDIAN_SET_READ_TIMEOUT_MS = 20_000;
const UPGRADE_TIMEOUT_MS = 3 * 60 * 1000;

/** Suppress got/p-cancelable race when our timeout fires before the request settles. */
function isPancelableRaceError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("onCancel") &&
    err.message.includes("attached after the promise settled")
  );
}

process.on("unhandledRejection", (reason: unknown) => {
  if (isPancelableRaceError(reason)) return;
});
process.on("uncaughtException", (err: Error) => {
  if (isPancelableRaceError(err)) return;
  throw err;
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // Handle the original promise so that if we time out and return first, any
  // later rejection (e.g. from got/p-cancelable) does not become unhandled.
  promise.catch(() => {
    // Ignored: the race below reports the timeout instead.
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

/** The Wormhole "Core" governance module, right-aligned in 32 bytes. */
const CORE_MODULE = Buffer.concat([
  Buffer.alloc(28),
  Buffer.from("Core", "utf8"),
]);
/** The `GuardianSetUpgrade` action within the Core module. */
const GUARDIAN_SET_UPGRADE_ACTION = 2;
/** Wormhole governance is emitted by the solana-side governance emitter, chain 1 address 0x…04. */
const GOVERNANCE_EMITTER_CHAIN = 1;
const GOVERNANCE_EMITTER_ADDRESS = `0x${"00".repeat(31)}04`;
/** Byte offsets within a `GuardianSetUpgrade` payload. */
const PAYLOAD_HEADER_LENGTH = 40;
const GUARDIAN_KEY_LENGTH = 20;

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

function parseGuardianSetUpgradeVaa(vaa: Buffer): GuardianSetUpgrade {
  let parsed: ReturnType<typeof parseVaa>;
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
    emitterAddress: `0x${parsed.emitterAddress.toString("hex")}`,
    emitterChain: parsed.emitterChain,
    keys,
    newIndex: payload.readUInt32BE(35),
    signingSetIndex: parsed.guardianSetIndex,
    targetChain: payload.readUInt16BE(33),
  };
}

function describeUpgrade(
  upgrade: GuardianSetUpgrade,
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
      `  ! unexpected emitter: Wormhole governance is chain ${GOVERNANCE_EMITTER_CHAIN} ` +
        `address ${GOVERNANCE_EMITTER_ADDRESS}; receivers will reject this VAA unless they were ` +
        `configured with this emitter`,
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
function loadVaaFile(path: string): Buffer {
  const contents = readFileSync(path, "utf8").trim();
  if (!contents.startsWith("{")) return decodeVaaHex(contents, path);
  const parsed: unknown = JSON.parse(contents);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("vaa" in parsed) ||
    typeof parsed.vaa !== "string"
  ) {
    throw new Error(`${path} is JSON but has no string "vaa" field`);
  }
  return decodeVaaHex(parsed.vaa, path);
}

/** One rotation to apply: the parsed upgrade and the VAA bytes that carry it. */
type UpgradeStep = {
  upgrade: GuardianSetUpgrade;
  vaa: Buffer;
};

type RowStatus =
  | "skipped-already-at-target"
  | "skipped-excluded"
  | "would-submit"
  | "submitted"
  | "error";

/** The statuses that leave nothing to do, so a run made only of these exits 0. */
const SETTLED_STATUSES: RowStatus[] = [
  "skipped-already-at-target",
  "skipped-excluded",
  "submitted",
];

type Row = {
  chain: string;
  endIndex: string;
  error?: string;
  mainnet: boolean;
  startIndex: string;
  status: RowStatus;
  txId: string;
  type: string;
};

/** The identity of a contract, shared by every row we can build for it. */
type RowIdentity = {
  chain: string;
  mainnet: boolean;
  type: string;
};

const UNKNOWN = "—";

function identityOf(contract: WormholeContract): RowIdentity {
  const chain = contract.getChain();
  let type = contract.getType();
  if (contract instanceof EvmWormholeContract) type = "evm";
  if (contract instanceof SuiWormholeContract) type = "sui";
  return { chain: chain.getId(), mainnet: chain.isMainnet(), type };
}

function normalizeKeys(keys: string[]): string[] {
  return keys.map((key) => {
    const lower = key.toLowerCase();
    return lower.startsWith("0x") ? lower : `0x${lower}`;
  });
}

/**
 * Reads the on-chain guardian set, insisting on an array of addresses. Some receivers (Sui) can
 * return a differently shaped field, and a clear error beats a `keys.map is not a function`.
 */
async function readGuardianSet(contract: WormholeContract): Promise<string[]> {
  const keys: unknown = await withTimeout(
    contract.getGuardianSet(),
    GUARDIAN_SET_READ_TIMEOUT_MS,
  );
  if (!Array.isArray(keys)) {
    throw new Error(
      `getGuardianSet() returned ${typeof keys}, not an array of addresses`,
    );
  }
  return normalizeKeys(keys.map(String));
}

/**
 * Confirms the RPC behind a store entry really serves the chain the entry names, before anything
 * is read from the contract. A mainnet entry pointed at a testnet RPC reads whatever lives at the
 * receiver's address on that other chain, and a plausible answer from the wrong contract — a
 * guardian set index that happens to be at or past the target, say — is worse than no answer.
 *
 * Sui gets no equivalent check: @mysten/sui does expose a chain identifier cheaply
 * (`getChainIdentifier()`), but SuiChain carries no chain identifier in the store, so there is
 * nothing to compare it against without adding a store field.
 */
async function assertRpcServesStoreChain(
  contract: WormholeContract,
): Promise<void> {
  if (!(contract instanceof EvmWormholeContract)) return;
  const chain = contract.getChain();
  const rpcChainId = Number(
    await withTimeout(chain.getWeb3().eth.getChainId(), CHAIN_ID_TIMEOUT_MS),
  );
  if (rpcChainId !== chain.networkId) {
    throw new Error(
      `RPC chain id ${rpcChainId} does not match store networkId ${chain.networkId} for ${chain.getId()}`,
    );
  }
}

/** Describes how the on-chain keys differ from the VAA's, or undefined when they match. */
function diffKeys(onChain: string[], expected: string[]): string | undefined {
  const wanted = normalizeKeys(expected);
  if (onChain.length !== wanted.length) {
    return `on-chain set has ${onChain.length} keys, the VAA has ${wanted.length}`;
  }
  const mismatch = onChain.findIndex((key, index) => key !== wanted[index]);
  if (mismatch === -1) return undefined;
  return `key ${mismatch} is ${onChain[mismatch]} on chain, ${wanted[mismatch]} in the VAA`;
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
  return verbose ? message : message.slice(0, 120);
}

type RotateOptions = {
  dryRun: boolean;
  gasPriceMultiplier: number | undefined;
  privateKey: PrivateKey | undefined;
  verbose: boolean;
};

async function submitUpgrade(
  contract: WormholeContract,
  vaa: Buffer,
  options: RotateOptions,
): Promise<string> {
  if (options.privateKey === undefined) {
    throw new Error("no private key available; --private-key is required");
  }
  // gasPriceMultiplier is EVM-only; the other receivers take no such argument.
  const result = await withTimeout(
    contract instanceof EvmWormholeContract
      ? contract.upgradeGuardianSets(
          options.privateKey,
          vaa,
          options.gasPriceMultiplier,
        )
      : contract.upgradeGuardianSets(options.privateKey, vaa),
    UPGRADE_TIMEOUT_MS,
  );
  return String(result.id);
}

async function rotateContract(
  contract: WormholeContract,
  steps: UpgradeStep[],
  options: RotateOptions,
): Promise<Row> {
  const identity = identityOf(contract);
  // Guaranteed non-empty by loadSteps; the target is what the last rotation installs.
  const target = steps.at(-1)?.upgrade;
  if (target === undefined) {
    return {
      ...identity,
      endIndex: UNKNOWN,
      error: "no guardian set upgrade to apply",
      startIndex: UNKNOWN,
      status: "error",
      txId: "",
    };
  }
  try {
    await assertRpcServesStoreChain(contract);
    const startIndex = await withTimeout(
      contract.getCurrentGuardianSetIndex(),
      GUARDIAN_SET_READ_TIMEOUT_MS,
    );
    const startKeys = await readGuardianSet(contract);

    // Past the target is not "done": a Pro receiver only ever reaches the index the last known
    // rotation installs, so a higher one means we are reading something that is not this receiver.
    if (startIndex > target.newIndex) {
      return {
        ...identity,
        endIndex: String(startIndex),
        error: `index ${startIndex} is beyond target ${target.newIndex}; wrong contract or wrong chain?`,
        startIndex: String(startIndex),
        status: "error",
        txId: "",
      };
    }

    if (startIndex === target.newIndex) {
      // Already at the target, so the keys had better be the ones the last VAA installs, or
      // something else rotated this receiver.
      const drift = diffKeys(startKeys, target.keys);
      if (drift !== undefined) {
        return {
          ...identity,
          endIndex: String(startIndex),
          error: `already at index ${startIndex} but the on-chain keys are not the VAA's: ${drift}`,
          startIndex: String(startIndex),
          status: "error",
          txId: "",
        };
      }
      return {
        ...identity,
        endIndex: String(startIndex),
        startIndex: String(startIndex),
        status: "skipped-already-at-target",
        txId: "",
      };
    }

    // Rotations already applied are skipped; what is left has to continue the ladder from here.
    const pending = steps.filter((step) => step.upgrade.newIndex > startIndex);
    const first = pending[0];
    if (first === undefined || first.upgrade.newIndex !== startIndex + 1) {
      return {
        ...identity,
        endIndex: UNKNOWN,
        error: `at index ${startIndex}, but the next available upgrade installs ${first?.upgrade.newIndex ?? target.newIndex}; a receiver only accepts the next set in sequence`,
        startIndex: String(startIndex),
        status: "error",
        txId: "",
      };
    }

    if (options.dryRun) {
      return {
        ...identity,
        endIndex: UNKNOWN,
        startIndex: String(startIndex),
        status: "would-submit",
        txId: "",
      };
    }

    const txIds: string[] = [];
    for (const step of pending) {
      txIds.push(await submitUpgrade(contract, step.vaa, options));
      const index = await withTimeout(
        contract.getCurrentGuardianSetIndex(),
        GUARDIAN_SET_READ_TIMEOUT_MS,
      );
      if (index !== step.upgrade.newIndex) {
        return {
          ...identity,
          endIndex: String(index),
          error: `submitted but the guardian set index is ${index}, expected ${step.upgrade.newIndex}`,
          startIndex: String(startIndex),
          status: "error",
          txId: txIds.join(" "),
        };
      }
    }

    const drift = diffKeys(await readGuardianSet(contract), target.keys);
    if (drift !== undefined) {
      return {
        ...identity,
        endIndex: String(target.newIndex),
        error: `submitted and index advanced, but the on-chain keys differ: ${drift}`,
        startIndex: String(startIndex),
        status: "error",
        txId: txIds.join(" "),
      };
    }
    return {
      ...identity,
      endIndex: String(target.newIndex),
      startIndex: String(startIndex),
      status: "submitted",
      txId: txIds.join(" "),
    };
  } catch (error) {
    if (options.verbose) console.error(`[${identity.chain}]`, error);
    return {
      ...identity,
      endIndex: UNKNOWN,
      error: shortErrorMessage(error, options.verbose),
      startIndex: UNKNOWN,
      status: "error",
      txId: "",
    };
  }
}

function isTargetContract(
  contract: WormholeContract,
  deploymentType: DeploymentType,
  chains: string[] | undefined,
): boolean {
  if (chains !== undefined && !chains.includes(contract.getChain().getId())) {
    return false;
  }
  if (
    contract instanceof EvmWormholeContract ||
    contract instanceof SuiWormholeContract
  ) {
    return contract.deploymentType === deploymentType;
  }
  return false;
}

/** Mainnet first, then by chain name, so the riskiest rows are read first. */
function compareRows(a: Row, b: Row): number {
  if (a.mainnet !== b.mainnet) return a.mainnet ? -1 : 1;
  return a.chain.localeCompare(b.chain);
}

const parser = yargs(hideBin(process.argv))
  .scriptName("sync_pro_guardian_set.ts")
  .usage(
    "Rotates the guardian set on every Pyth Pro receiver in the store.\n" +
      "Applies one upgrade VAA, or with --from-store every rotation the store knows about.\n" +
      "Exits 0 only when every receiver was skipped or submitted-and-verified, so a --dry-run\n" +
      "with work left to do exits 1.\n" +
      "Usage: $0 --expect-index <n> (--vaa <hex> | --vaa-file <path> | --from-store) [--dry-run | --private-key <key>]",
  )
  .options({
    chain: {
      array: true,
      desc: "Only act on these chain ids; defaults to every chain in the store",
      type: "string",
    },
    "deployment-type": {
      default: "pro-compatible-production",
      desc: "Which Pro receivers to rotate: pro-compatible-production or pro-compatible-staging",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Read and report only; send no transactions",
      type: "boolean",
    },
    "expect-index": {
      demandOption: true,
      desc: "The guardian set index the last VAA must install; the run aborts if the VAA says otherwise",
      type: "number",
    },
    "from-store": {
      default: false,
      desc: "Replay every rotation in src/store/guardian_sets/ for this deployment type, in order, up to --expect-index. What a freshly deployed receiver needs",
      type: "boolean",
    },
    "gas-price-multiplier": {
      desc: "Multiplier applied to the fetched gas price (EVM receivers only)",
      type: "number",
    },
    json: {
      default: false,
      desc: "Print the rows as JSON on the last line of stdout instead of as a table",
      type: "boolean",
    },
    "private-key": {
      desc: "Private key to sign the upgrade transactions with; required unless --dry-run",
      type: "string",
    },
    "skip-chain": {
      array: true,
      desc: "Chain ids to leave alone entirely, e.g. a chain with no working RPC; they are reported as skipped-excluded, are never called, and do not fail the run",
      type: "string",
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
      desc: "Print full error messages and stack traces",
      type: "boolean",
    },
  });

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
      upgrade: parseGuardianSetUpgradeVaa(upgrade.vaa),
      vaa: upgrade.vaa,
    }));
  }

  let bytes: Buffer;
  if (vaa !== undefined) bytes = decodeVaaHex(vaa, "--vaa");
  else if (vaaFile !== undefined) bytes = loadVaaFile(vaaFile);
  else throw new Error("Pass one of --vaa, --vaa-file or --from-store");
  return [{ upgrade: parseGuardianSetUpgradeVaa(bytes), vaa: bytes }];
}

/** Rejects chain ids the store does not know, so a typo cannot silently change what a run covers. */
function validateChainIds(option: string, chains: string[] | undefined): void {
  if (chains === undefined) return;
  const unknown = chains.filter((chain) => !(chain in DefaultStore.chains));
  if (unknown.length > 0) {
    throw new Error(
      `${option} names chains that are not in the store: ${unknown.join(", ")}`,
    );
  }
}

function requirePrivateKey(
  privateKey: string | undefined,
  dryRun: boolean,
): PrivateKey | undefined {
  if (dryRun) return undefined;
  if (privateKey === undefined) {
    throw new Error("--private-key is required unless --dry-run");
  }
  return toPrivateKey(privateKey);
}

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

  const deploymentType = toDeploymentType(argv.deploymentType);
  if (!isProDeploymentType(deploymentType)) {
    throw new Error(
      `--deployment-type must be pro-compatible-production or pro-compatible-staging, got ${deploymentType}`,
    );
  }

  // Everything up to here and through the --expect-index guard is local: no chain is touched
  // until we are sure these are the VAAs the operator meant to send.
  const steps = loadSteps({
    deploymentType,
    expectIndex: argv.expectIndex,
    fromStore: argv.fromStore,
    vaa: argv.vaa,
    vaaFile: argv.vaaFile,
  });
  for (const step of steps) describeUpgrade(step.upgrade, log);
  const target = steps.at(-1)?.upgrade;
  if (target === undefined) throw new Error("no guardian set upgrade to apply");
  if (argv.expectIndex !== target.newIndex) {
    throw new Error(
      `--expect-index ${argv.expectIndex} does not match the VAA's new guardian set index ${target.newIndex}; refusing to run`,
    );
  }

  const privateKey = requirePrivateKey(argv.privateKey, argv.dryRun);

  validateChainIds("--chain", argv.chain);
  validateChainIds("--skip-chain", argv.skipChain);
  const skipChains = argv.skipChain ?? [];
  const overlap = (argv.chain ?? []).filter((chain) =>
    skipChains.includes(chain),
  );
  if (overlap.length > 0) {
    throw new Error(
      `--chain and --skip-chain both name ${overlap.join(", ")}; a chain is either in scope or excluded`,
    );
  }

  const targeted = Object.values(DefaultStore.wormhole_contracts).filter(
    (contract) => isTargetContract(contract, deploymentType, argv.chain),
  );
  if (targeted.length === 0) {
    throw new Error(
      `No ${deploymentType} wormhole contracts in the store match the chain filter`,
    );
  }
  const isExcluded = (contract: WormholeContract) =>
    skipChains.includes(contract.getChain().getId());
  const contracts = targeted.filter((contract) => !isExcluded(contract));

  log(
    `\nRotating ${contracts.length} ${deploymentType} receiver(s) to guardian set ${target.newIndex}` +
      `${steps.length > 1 ? ` by replaying ${steps.length} rotation(s)` : ""}` +
      `${argv.dryRun ? " (dry run)" : ""}` +
      `${targeted.length > contracts.length ? `, excluding ${targeted.length - contracts.length}` : ""}...`,
  );

  // Excluded receivers are never called, so their rows are built without touching a chain.
  const excludedRows: Row[] = targeted.filter(isExcluded).map((contract) => ({
    ...identityOf(contract),
    endIndex: UNKNOWN,
    startIndex: UNKNOWN,
    status: "skipped-excluded",
    txId: "",
  }));
  const rows = [
    ...excludedRows,
    ...(await Promise.all(
      contracts.map((contract) =>
        rotateContract(contract, steps, {
          dryRun: argv.dryRun,
          gasPriceMultiplier: argv.gasPriceMultiplier,
          privateKey,
          verbose: argv.verbose,
        }),
      ),
    )),
  ];
  rows.sort(compareRows);

  const count = (status: RowStatus) =>
    rows.filter((row) => row.status === status).length;
  const ok = rows.every((row) => SETTLED_STATUSES.includes(row.status));

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
    `Summary: ${rows.length} receiver(s) — ${count("submitted")} submitted, ` +
      `${count("skipped-already-at-target")} already at index ${target.newIndex}, ` +
      `${count("would-submit")} would submit, ${count("skipped-excluded")} excluded, ` +
      `${count("error")} error(s)`,
  );
  process.exit(ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
