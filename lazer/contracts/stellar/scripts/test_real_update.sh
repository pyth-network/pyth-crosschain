#!/usr/bin/env bash
set -euo pipefail

# End-to-end test: real Pyth Lazer price update verification on Stellar testnet.
#
# This script:
#   1. Fetches a real signed price update from the Pyth Lazer service
#   2. Recovers the signer's compressed secp256k1 public key
#   3. Builds and deploys the Lazer contract to Stellar testnet
#   4. Initializes the contract and adds the recovered signer as trusted
#   5. Calls verify_update with the real payload and prints the result
#
# Prerequisites:
#   - stellar CLI (https://developers.stellar.org/docs/tools/cli/install-cli)
#   - Node.js 20+
#   - Rust with wasm32-unknown-unknown target: rustup target add wasm32-unknown-unknown
#   - PYTH_LAZER_TOKEN environment variable
#
# Usage:
#   PYTH_LAZER_TOKEN=<token> ./scripts/test_real_update.sh [--secret <STELLAR_SECRET>] [--skip-build]
#
# Options:
#   --secret      Stellar secret key (S...). If not provided, a new keypair is generated.
#   --skip-build  Skip WASM build step (use if already built).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check prerequisites
: "${PYTH_LAZER_TOKEN:?Error: PYTH_LAZER_TOKEN environment variable is required}"
command -v stellar >/dev/null 2>&1 || { echo "Error: stellar CLI not found. Install from https://developers.stellar.org/docs/tools/cli/install-cli"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: Node.js not found"; exit 1; }

# Parse arguments
SECRET=""
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --secret) SECRET="$2"; shift 2 ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Step 1: Build WASM contracts
if [[ "$SKIP_BUILD" == "false" ]]; then
    echo "=== Step 1: Building contracts ==="
    cd "$WORKSPACE_DIR"
    cargo build --release --target wasm32-unknown-unknown
    echo ""
fi

LAZER_WASM="$WORKSPACE_DIR/target/wasm32-unknown-unknown/release/pyth_lazer_stellar.wasm"

# Optimize with wasm-opt if available
if command -v wasm-opt &> /dev/null; then
    echo "=== Optimizing WASM with wasm-opt ==="
    OPT_WASM="${LAZER_WASM%.wasm}.optimized.wasm"
    wasm-opt -Oz --disable-reference-types "$LAZER_WASM" -o "$OPT_WASM"
    LAZER_WASM="$OPT_WASM"
    echo "Optimized: $(wc -c < "$LAZER_WASM") bytes"
    echo ""
fi

if [[ ! -f "$LAZER_WASM" ]]; then
    echo "Error: WASM not found at $LAZER_WASM"
    echo "Run without --skip-build to build first."
    exit 1
fi

# Step 2: Set up Node.js environment in a temp directory
echo "=== Step 2: Setting up Node.js dependencies ==="
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cat > "$WORK_DIR/package.json" << 'PKGJSON'
{
  "type": "module",
  "private": true,
  "dependencies": {
    "@pythnetwork/pyth-lazer-sdk": "^5.2.0",
    "@noble/curves": "^1.4.0",
    "@noble/hashes": "^1.4.0",
    "@stellar/stellar-sdk": "^13.0.0"
  }
}
PKGJSON

(cd "$WORK_DIR" && npm install --silent 2>&1 | tail -3)
echo "Dependencies installed."
echo ""

# Step 3: Write the Node.js test script
cat > "$WORK_DIR/test.mjs" << 'NODESCRIPT'
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { Keypair } from "@stellar/stellar-sdk";

const NETWORK = "testnet";
const FAR_FUTURE_EXPIRY = "9999999999"; // ~year 2286

function stellarCmd(args) {
  const cmd = `stellar ${args}`;
  console.log(`  $ ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: "utf-8", timeout: 120_000 }).trim();
    if (out) console.log(`  ${out}`);
    return out;
  } catch (err) {
    console.error(`  Command failed: ${err.stderr || err.message}`);
    throw err;
  }
}

async function main() {
  const token = process.env.PYTH_LAZER_TOKEN;
  const wasmPath = process.env.LAZER_WASM;

  if (!token) throw new Error("PYTH_LAZER_TOKEN required");
  if (!wasmPath) throw new Error("LAZER_WASM required");

  // --- Step 1: Stellar keypair ---
  let secret = process.env.STELLAR_SECRET;
  let accountId;

  if (secret) {
    const kp = Keypair.fromSecret(secret);
    accountId = kp.publicKey();
    console.log(`=== Using provided keypair: ${accountId} ===`);
  } else {
    console.log("=== Generating Stellar test keypair ===");
    const kp = Keypair.random();
    secret = kp.secret();
    accountId = kp.publicKey();
    console.log(`  Account:    ${accountId}`);
    console.log(`  Secret:     ${secret}`);
  }

  // Fund via friendbot
  console.log("\n=== Funding account via Stellar friendbot ===");
  const fundResp = await fetch(
    `https://friendbot.stellar.org?addr=${accountId}`
  );
  if (fundResp.ok) {
    console.log("  Account funded.");
  } else {
    console.log(`  Friendbot returned ${fundResp.status} (account may already be funded).`);
  }

  // --- Step 2: Fetch real price update ---
  console.log("\n=== Fetching real price update from Pyth Lazer ===");
  const lazer = await PythLazerClient.create({ token });
  let updateHex, signerPubkeyHex;

  try {
    const response = await lazer.getLatestPrice({
      channel: "fixed_rate@200ms",
      formats: ["leEcdsa"],
      jsonBinaryEncoding: "hex",
      priceFeedIds: [1],
      properties: ["price"],
    });

    updateHex = response.leEcdsa?.data;
    if (!updateHex) {
      console.error("  Response:", JSON.stringify(response, null, 2));
      throw new Error("No leEcdsa data in response");
    }

    const update = Buffer.from(updateHex, "hex");
    console.log(`  Update size: ${update.length} bytes`);

    // Parse LE-ECDSA envelope
    if (update.length < 71) throw new Error(`Update too short: ${update.length}`);

    const magic = update.readUInt32LE(0);
    if (magic !== 0x4d47bde4) throw new Error(`Invalid magic: 0x${magic.toString(16)}`);

    const sig = update.subarray(4, 68);
    const recoveryId = update[68];
    const payloadLen = update.readUInt16LE(69);
    const payload = update.subarray(71, 71 + payloadLen);

    if (71 + payloadLen !== update.length) throw new Error("Payload length mismatch");

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

  // --- Step 3: Deploy Lazer contract ---
  console.log("\n=== Deploying Lazer contract to testnet ===");
  const deployOutput = stellarCmd(
    `contract deploy --wasm "${wasmPath}" --network ${NETWORK} --source ${secret}`
  );
  // The contract ID is the last line of output
  const lazerId = deployOutput.split("\n").pop().trim();
  console.log(`  Lazer contract ID: ${lazerId}`);

  // --- Step 4: Initialize with our account as executor ---
  // This allows us to call update_trusted_signer directly without needing
  // a Wormhole governance VAA, since require_auth() will succeed for our account.
  console.log("\n=== Initializing Lazer contract ===");
  stellarCmd(
    `contract invoke --id ${lazerId} --network ${NETWORK} --source ${secret} -- initialize --executor ${accountId}`
  );
  console.log("  Initialized with executor = our account.");

  // --- Step 5: Add recovered signer as trusted ---
  console.log("\n=== Adding trusted signer ===");
  stellarCmd(
    `contract invoke --id ${lazerId} --network ${NETWORK} --source ${secret} -- update_trusted_signer --pubkey ${signerPubkeyHex} --expires_at ${FAR_FUTURE_EXPIRY}`
  );
  console.log("  Signer added with far-future expiry.");

  // --- Step 6: Verify the real update on-chain ---
  console.log("\n=== Calling verify_update with real Lazer payload ===");
  const result = stellarCmd(
    `contract invoke --id ${lazerId} --network ${NETWORK} --source ${secret} -- verify_update --data ${updateHex}`
  );

  console.log("\n=========================================");
  console.log("=== END-TO-END TEST PASSED ===");
  console.log("=========================================");
  console.log(`\nLazer contract: ${lazerId}`);
  console.log(`Signer pubkey:  ${signerPubkeyHex}`);
  console.log(`Verified payload (hex): ${result}`);
  console.log(
    "\nThe real Pyth Lazer price update was successfully verified on Stellar testnet!"
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n=== TEST FAILED ===");
    console.error(err.message || err);
    process.exit(1);
  });
NODESCRIPT

# Step 4: Run the test
echo "=== Step 3: Running end-to-end test ==="
echo ""

cd "$WORK_DIR"
LAZER_WASM="$LAZER_WASM" STELLAR_SECRET="$SECRET" node test.mjs

echo ""
echo "Done."
