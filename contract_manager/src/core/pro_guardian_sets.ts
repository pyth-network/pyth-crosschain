/**
 * The Pyth Pro guardian set rotations, as data.
 *
 * A Pro receiver is deployed with the set-0 keys from `getDefaultDeploymentConfig`, but the Pro
 * routers sign price VAAs with the *latest* set, so a freshly deployed receiver verifies nothing
 * until every rotation since set 0 has been replayed onto it. The signed upgrade VAAs are kept in
 * the store, one file per Pro deployment type, and this module is the single place that loads and
 * validates them:
 *
 * - `src/store/guardian_sets/ProCompatibleStagingGuardianSetVaas.json`
 * - `src/store/guardian_sets/ProCompatibleProductionGuardianSetVaas.json`
 *
 * Each file is a JSON array ordered by target index, `[{ "guardianSetIndex": 1, "vaa": "<hex>" }]`.
 * A future rotation appends an entry. The file is the source of truth, so it is validated rather
 * than trusted: indices have to be contiguous from 1, and every VAA's governance payload really
 * has to install the index its entry claims.
 */

import { readFileSync } from "node:fs";

import { parseVaa } from "@certusone/wormhole-sdk";

import type { ProDeploymentType } from "./base";
import { getDefaultDeploymentConfig } from "./base";

/** One rotation: the signed VAA that installs `guardianSetIndex`, and the set it installs. */
export type ProGuardianSetUpgrade = {
  /** The guardian set index this VAA installs. The first rotation is 1; set 0 is the deploy-time set. */
  guardianSetIndex: number;
  /** The set the VAA installs: 20-byte addresses as 40-char lowercase hex without `0x`, in order. */
  keys: string[];
  /** The signed guardian set upgrade VAA, ready to submit to a receiver. */
  vaa: Buffer;
};

/** The Wormhole "Core" governance module, right-aligned in 32 bytes. */
const CORE_MODULE = Buffer.concat([
  Buffer.alloc(28),
  Buffer.from("Core", "utf8"),
]);
/** The `GuardianSetUpgrade` action within the Core module. */
const GUARDIAN_SET_UPGRADE_ACTION = 2;
/** Bytes before the first key: 32 module + 1 action + 2 chain + 4 new index + 1 key count. */
const PAYLOAD_HEADER_LENGTH = 40;
const GUARDIAN_KEY_LENGTH = 20;

const STORE_FILE: Record<ProDeploymentType, string> = {
  "pro-compatible-production": "ProCompatibleProductionGuardianSetVaas.json",
  "pro-compatible-staging": "ProCompatibleStagingGuardianSetVaas.json",
};

// Resolve the store the way DefaultStore does, so this works from both the ESM and the CJS build.
// `__dirname` exists in one and `import.meta.dirname` in the other, and reading the missing one
// throws rather than returning undefined.
const getDirname = () => {
  let out = "";
  try {
    out = __dirname;
  } catch (error) {
    void error;
  }
  try {
    out = import.meta.dirname;
  } catch (error) {
    void error;
  }
  return out;
};

const GUARDIAN_SETS_DIR = `${getDirname()}/../store/guardian_sets`;

type StoreEntry = {
  guardianSetIndex: number;
  vaa: string;
};

function readStoreFile(deploymentType: ProDeploymentType): StoreEntry[] {
  const path = `${GUARDIAN_SETS_DIR}/${STORE_FILE[deploymentType]}`;
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read the ${deploymentType} guardian set rotations from ${path}: ${detail}`,
    );
  }
  const parsed: unknown = JSON.parse(contents);
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} is not a JSON array of guardian set upgrades`);
  }
  return parsed.map((entry: unknown, position: number) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("guardianSetIndex" in entry) ||
      typeof entry.guardianSetIndex !== "number" ||
      !("vaa" in entry) ||
      typeof entry.vaa !== "string"
    ) {
      throw new Error(
        `${path} entry ${position} is not { "guardianSetIndex": <number>, "vaa": "<hex>" }`,
      );
    }
    return { guardianSetIndex: entry.guardianSetIndex, vaa: entry.vaa };
  });
}

function decodeVaaHex(source: string, origin: string): Buffer {
  const hex = source.trim().replace(/^0x/i, "");
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(`${origin} does not hold a hex-encoded VAA`);
  }
  return Buffer.from(hex, "hex");
}

/**
 * Checks that a VAA really is a guardian set upgrade installing `expectedIndex`, and returns the
 * keys it installs.
 * @param {Buffer} vaa The VAA to check.
 * @param {number} expectedIndex The guardian set index the store entry claims it installs.
 * @param {string} origin How to name this VAA in an error message.
 * @returns The new guardian set, as 40-char lowercase hex addresses without `0x`, in order.
 * @throws {Error} if the VAA is malformed, is not a `Core`/`GuardianSetUpgrade` governance
 * message, installs a different index, or was not signed by the set it replaces.
 */
function parseUpgradeKeys(
  vaa: Buffer,
  expectedIndex: number,
  origin: string,
): string[] {
  let parsed: ReturnType<typeof parseVaa>;
  try {
    parsed = parseVaa(vaa);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${origin} is not a well-formed VAA: ${detail}`);
  }

  const { payload } = parsed;
  if (payload.length < PAYLOAD_HEADER_LENGTH) {
    throw new Error(
      `${origin} has a ${payload.length}-byte payload, too short to be a guardian set upgrade`,
    );
  }
  const module = payload.subarray(0, 32);
  if (!module.equals(CORE_MODULE)) {
    throw new Error(
      `${origin} names governance module 0x${module.toString("hex")}, expected "Core"`,
    );
  }
  const action = payload.readUInt8(32);
  if (action !== GUARDIAN_SET_UPGRADE_ACTION) {
    throw new Error(
      `${origin} carries governance action ${action}, expected ${GUARDIAN_SET_UPGRADE_ACTION} (GuardianSetUpgrade)`,
    );
  }

  const newIndex = payload.readUInt32BE(35);
  if (newIndex !== expectedIndex) {
    throw new Error(
      `${origin} installs guardian set ${newIndex}, but its store entry says ${expectedIndex}`,
    );
  }
  // Wormhole governance only accepts an upgrade signed by the set being replaced, so a VAA whose
  // signing set is not exactly one below is one no receiver on this ladder will ever apply.
  if (parsed.guardianSetIndex !== expectedIndex - 1) {
    throw new Error(
      `${origin} was signed by guardian set ${parsed.guardianSetIndex}, but installing set ` +
        `${expectedIndex} requires a signature from set ${expectedIndex - 1}`,
    );
  }

  const keyCount = payload.readUInt8(39);
  if (keyCount === 0) {
    throw new Error(`${origin} installs an empty guardian set`);
  }
  const expectedLength = PAYLOAD_HEADER_LENGTH + keyCount * GUARDIAN_KEY_LENGTH;
  if (payload.length !== expectedLength) {
    throw new Error(
      `${origin} has a ${payload.length}-byte payload, expected ${expectedLength} for ${keyCount} keys`,
    );
  }

  const keys: string[] = [];
  for (let index = 0; index < keyCount; index++) {
    const offset = PAYLOAD_HEADER_LENGTH + index * GUARDIAN_KEY_LENGTH;
    keys.push(
      payload.subarray(offset, offset + GUARDIAN_KEY_LENGTH).toString("hex"),
    );
  }
  return keys;
}

const cache = new Map<ProDeploymentType, ProGuardianSetUpgrade[]>();

/**
 * Loads the guardian set rotations a Pro receiver of this deployment type has to replay, in the
 * order they have to be applied.
 *
 * The result is validated and memoized: the store file is read and every VAA parsed once per
 * process, so a deploy sweep over many chains pays for it once.
 * @param {ProDeploymentType} deploymentType The Pro deployment whose rotations to load.
 * @returns The rotations, ordered by guardian set index starting at 1. Empty when no rotation has
 * happened yet, in which case the deploy-time set is still current.
 * @throws {Error} if the store file is missing, malformed, has non-contiguous indices, or holds a
 * VAA that does not install the index its entry claims.
 */
export function getProGuardianSetUpgrades(
  deploymentType: ProDeploymentType,
): ProGuardianSetUpgrade[] {
  const cached = cache.get(deploymentType);
  if (cached !== undefined) return cached;

  const path = `${GUARDIAN_SETS_DIR}/${STORE_FILE[deploymentType]}`;
  const upgrades = readStoreFile(deploymentType).map((entry, position) => {
    // Guardian sets are a ladder: a receiver only ever accepts the set one above its current one,
    // so a gap or a repeat in the file is a rotation nobody could apply.
    const expectedIndex = position + 1;
    if (entry.guardianSetIndex !== expectedIndex) {
      throw new Error(
        `${path} entry ${position} says guardian set index ${entry.guardianSetIndex}, expected ` +
          `${expectedIndex}: the entries must be contiguous and start at 1`,
      );
    }
    const origin = `${path} entry for guardian set ${expectedIndex}`;
    const vaa = decodeVaaHex(entry.vaa, origin);
    return {
      guardianSetIndex: expectedIndex,
      keys: parseUpgradeKeys(vaa, expectedIndex, origin),
      vaa,
    };
  });

  cache.set(deploymentType, upgrades);
  return upgrades;
}

/**
 * The guardian set a fully synced Pro receiver of this deployment type should be on.
 *
 * This is what a post-deploy check compares against: a receiver that has replayed every rotation
 * sits at the last rotation's index, *not* at the set 0 it was deployed with.
 * @param {ProDeploymentType} deploymentType The Pro deployment to describe.
 * @returns The expected index and its keys, as 40-char lowercase hex addresses without `0x`. Falls
 * back to the deploy-time set at index 0 when no rotation has happened yet.
 */
export function getExpectedProGuardianSet(deploymentType: ProDeploymentType): {
  index: number;
  keys: string[];
} {
  const last = getProGuardianSetUpgrades(deploymentType).at(-1);
  if (last !== undefined) {
    return { index: last.guardianSetIndex, keys: last.keys };
  }
  const { wormholeConfig } = getDefaultDeploymentConfig(deploymentType);
  return {
    index: 0,
    keys: wormholeConfig.initialGuardianSet.map((key) =>
      key.replace(/^0x/i, "").toLowerCase(),
    ),
  };
}
