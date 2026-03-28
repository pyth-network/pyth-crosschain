/** biome-ignore-all lint/suspicious/noConsole: e2e test script */

import { execSync } from "node:child_process";
import process from "node:process";

import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { Keypair } from "@stellar/stellar-sdk";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const NETWORK = "testnet";
const FAR_FUTURE_EXPIRY = "9999999999";

const { secret, skipBuild, wasmPath: wasmPathArg } = await yargs(
  hideBin(process.argv),
)
  .option("secret", {
    description: "Stellar secret key (S...). If omitted, a new keypair is generated.",
    type: "string",
  })
  .option("skip-build", {
    default: false,
    description: "Skip WASM build step (use if already built)",
    type: "boolean",
  })
  .option("wasm-path", {
    description: "Path to the Lazer WASM file. If omitted, builds from source.",
    type: "string",
  })
  .help()
  .parseAsync();

const { PYTH_LAZER_TOKEN } = process.env;
if (!PYTH_LAZER_TOKEN) {
  throw new Error(
    "'PYTH_LAZER_TOKEN' environment variable must be set to your Lazer auth token.",
  );
}

function stellarCmd(args: string): string {
  const cmd = `stellar ${args}`;
  console.log(`  $ ${cmd}`);
  const out = execSync(cmd, { encoding: "utf-8", timeout: 120_000 }).trim();
  if (out) console.log(`  ${out}`);
  return out;
}

// Resolve workspace root (four levels up from scripts/e2e/src/)
const workspaceDir = new URL("../../../../", import.meta.url).pathname.replace(
  /\/$/,
  "",
);

// --- Step 1: Build WASM contracts ---
let wasmPath: string;
if (wasmPathArg) {
  wasmPath = wasmPathArg;
} else if (skipBuild) {
  wasmPath = `${workspaceDir}/target/wasm32-unknown-unknown/release/pyth_lazer_stellar.wasm`;
} else {
  console.log("=== Building contracts ===");
  execSync("cargo build --release --target wasm32-unknown-unknown", {
    cwd: workspaceDir,
    encoding: "utf-8",
    stdio: "inherit",
    timeout: 300_000,
  });
  wasmPath = `${workspaceDir}/target/wasm32-unknown-unknown/release/pyth_lazer_stellar.wasm`;
}

console.log(`WASM: ${wasmPath}`);

// --- Step 2: Set up Stellar keypair ---
let stellarSecret: string;
let accountId: string;
if (secret) {
  const kp = Keypair.fromSecret(secret);
  stellarSecret = secret;
  accountId = kp.publicKey();
  console.log(`\n=== Using provided keypair: ${accountId} ===`);
} else {
  console.log("\n=== Generating Stellar test keypair ===");
  const kp = Keypair.random();
  stellarSecret = kp.secret();
  accountId = kp.publicKey();
  console.log(`  Account: ${accountId}`);
}

// Fund via friendbot
console.log("\n=== Funding account via Stellar friendbot ===");
const fundResp = await fetch(
  `https://friendbot.stellar.org?addr=${accountId}`,
);
if (fundResp.ok) {
  console.log("  Account funded.");
} else {
  console.log(
    `  Friendbot returned ${fundResp.status} (account may already be funded).`,
  );
}

// --- Step 3: Fetch real price update from Pyth Lazer ---
console.log("\n=== Fetching real price update from Pyth Lazer ===");
const lazer = await PythLazerClient.create({ token: PYTH_LAZER_TOKEN });
let updateHex: string;
let signerPubkeyHex: string;

try {
  const response = await lazer.getLatestPrice({
    channel: "fixed_rate@200ms",
    formats: ["leEcdsa"],
    jsonBinaryEncoding: "hex",
    priceFeedIds: [1],
    properties: ["price"],
  });

  const hex = response.leEcdsa?.data;
  if (!hex) {
    console.error("  Response:", JSON.stringify(response, null, 2));
    throw new Error("No leEcdsa data in response");
  }
  updateHex = hex;

  const update = Buffer.from(updateHex, "hex");
  console.log(`  Update size: ${update.length} bytes`);

  // Parse LE-ECDSA envelope:
  //   4 bytes  magic (LE u32, 0x4D47BDE4)
  //  64 bytes  ECDSA signature (r || s)
  //   1 byte   recovery_id
  //   2 bytes  payload_length (LE u16)
  //   N bytes  payload
  if (update.length < 71)
    throw new Error(`Update too short: ${update.length}`);

  const magic = update.readUInt32LE(0);
  if (magic !== 0x4d47bde4)
    throw new Error(`Invalid magic: 0x${magic.toString(16)}`);

  const sig = update.subarray(4, 68);
  const recoveryId = update[68];
  const payloadLen = update.readUInt16LE(69);
  const payload = update.subarray(71, 71 + payloadLen);

  if (71 + payloadLen !== update.length)
    throw new Error("Payload length mismatch");

  console.log(`  Recovery ID: ${recoveryId}`);
  console.log(`  Payload size: ${payloadLen} bytes`);

  // Recover signer's compressed secp256k1 public key
  const hash = keccak_256(payload);
  const r = BigInt("0x" + Buffer.from(sig.subarray(0, 32)).toString("hex"));
  const s = BigInt("0x" + Buffer.from(sig.subarray(32, 64)).toString("hex"));
  const ecSig = new secp256k1.Signature(r, s).addRecoveryBit(recoveryId);
  const pubkey = ecSig.recoverPublicKey(hash);
  const compressed = Buffer.from(pubkey.toRawBytes(true));
  signerPubkeyHex = compressed.toString("hex");

  console.log(`  Signer pubkey (compressed): ${signerPubkeyHex}`);
} finally {
  lazer.close?.();
}

// --- Step 4: Deploy Lazer contract ---
console.log("\n=== Deploying Lazer contract to testnet ===");
const deployOutput = stellarCmd(
  `contract deploy --wasm "${wasmPath}" --network ${NETWORK} --source ${stellarSecret}`,
);
const lazerId = deployOutput.split("\n").pop()!.trim();
console.log(`  Lazer contract ID: ${lazerId}`);

// --- Step 5: Initialize with our account as executor ---
console.log("\n=== Initializing Lazer contract ===");
stellarCmd(
  `contract invoke --id ${lazerId} --network ${NETWORK} --source ${stellarSecret} -- initialize --executor ${accountId}`,
);
console.log("  Initialized with executor = our account.");

// --- Step 6: Add recovered signer as trusted ---
console.log("\n=== Adding trusted signer ===");
stellarCmd(
  `contract invoke --id ${lazerId} --network ${NETWORK} --source ${stellarSecret} -- update_trusted_signer --pubkey ${signerPubkeyHex} --expires_at ${FAR_FUTURE_EXPIRY}`,
);
console.log("  Signer added with far-future expiry.");

// --- Step 7: Verify the real update on-chain ---
console.log("\n=== Calling verify_update with real Lazer payload ===");
const result = stellarCmd(
  `contract invoke --id ${lazerId} --network ${NETWORK} --source ${stellarSecret} -- verify_update --data ${updateHex}`,
);

console.log("\n=========================================");
console.log("=== END-TO-END TEST PASSED ===");
console.log("=========================================");
console.log(`\nLazer contract: ${lazerId}`);
console.log(`Signer pubkey:  ${signerPubkeyHex}`);
console.log(`Verified payload (hex): ${result}`);
console.log(
  "\nThe real Pyth Lazer price update was successfully verified on Stellar testnet!",
);
