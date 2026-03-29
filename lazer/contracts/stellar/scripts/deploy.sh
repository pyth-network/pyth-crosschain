#!/usr/bin/env bash
set -euo pipefail

# Deploy and initialize Pyth Lazer Stellar contracts to the Stellar network.
#
# Prerequisites:
#   - stellar CLI v25+ (https://developers.stellar.org/docs/tools/cli/install-cli)
#   - wasm32-unknown-unknown target: rustup target add wasm32-unknown-unknown
#   - wasm-opt (optional, for WASM optimization): cargo install wasm-opt
#
# Usage:
#   ./scripts/deploy.sh --secret <SECRET_KEY> [--network <NETWORK>] [--chain-id <CHAIN_ID>]
#
# Options:
#   --secret          Stellar secret key (S...) or CLI identity alias
#   --network         Stellar network: "testnet" (default) or "mainnet"
#   --chain-id        Wormhole chain ID for this Stellar deployment (default: 28)
#   --guardian-set    Comma-separated guardian addresses (hex, no 0x prefix)
#   --guardian-index  Guardian set index (default: 0)
#   --emitter-chain   Governance emitter chain ID (default: 1 = Solana)
#   --emitter-address Governance emitter address (32-byte hex, no 0x prefix)
#   --fund            Fund the account via friendbot (testnet only)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Defaults
NETWORK="testnet"
CHAIN_ID=28
GUARDIAN_INDEX=0
EMITTER_CHAIN=1
FUND=false

# Testnet defaults
TESTNET_GUARDIAN="13947bd48b18e53fdaeee77f3473391ac727c638"
TESTNET_EMITTER_ADDRESS="63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385"

# Pyth Lazer trusted signer public key (compressed secp256k1, hex)
LAZER_SIGNER_PUBKEY="03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b"
FAR_FUTURE_EXPIRY=9999999999

SECRET=""
GUARDIAN_SET=""
EMITTER_ADDRESS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --secret)
            SECRET="$2"; shift 2 ;;
        --network)
            NETWORK="$2"; shift 2 ;;
        --chain-id)
            CHAIN_ID="$2"; shift 2 ;;
        --guardian-set)
            GUARDIAN_SET="$2"; shift 2 ;;
        --guardian-index)
            GUARDIAN_INDEX="$2"; shift 2 ;;
        --emitter-chain)
            EMITTER_CHAIN="$2"; shift 2 ;;
        --emitter-address)
            EMITTER_ADDRESS="$2"; shift 2 ;;
        --fund)
            FUND=true; shift ;;
        *)
            echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "$SECRET" ]]; then
    echo "Error: --secret is required"
    exit 1
fi

# Apply testnet defaults if not overridden
if [[ "$NETWORK" == "testnet" ]]; then
    if [[ -z "$GUARDIAN_SET" ]]; then
        GUARDIAN_SET="$TESTNET_GUARDIAN"
    fi
    if [[ -z "$EMITTER_ADDRESS" ]]; then
        EMITTER_ADDRESS="$TESTNET_EMITTER_ADDRESS"
    fi
fi

if [[ -z "$GUARDIAN_SET" ]]; then
    echo "Error: --guardian-set is required for non-testnet deployments"
    exit 1
fi
if [[ -z "$EMITTER_ADDRESS" ]]; then
    echo "Error: --emitter-address is required for non-testnet deployments"
    exit 1
fi

COMMON_ARGS="--network $NETWORK --source $SECRET"

echo "=== Pyth Lazer Stellar Deployment ==="
echo "Network:          $NETWORK"
echo "Chain ID:         $CHAIN_ID"
echo "Guardian Index:   $GUARDIAN_INDEX"
echo "Emitter Chain:    $EMITTER_CHAIN"
echo ""

# Step 0: Fund account via friendbot (testnet only)
if [[ "$FUND" == "true" && "$NETWORK" == "testnet" ]]; then
    echo "Funding account via friendbot..."
    stellar keys fund "$SECRET" --network testnet 2>/dev/null || \
        echo "Warning: could not fund account (may already be funded)"
    echo ""
fi

# Step 1: Build contracts
echo "=== Building contracts ==="
cd "$WORKSPACE_DIR"
cargo build --release --target wasm32-unknown-unknown -p wormhole-executor-stellar -p pyth-lazer-stellar
echo "Build complete."
echo ""

WASM_DIR="$WORKSPACE_DIR/target/wasm32-unknown-unknown/release"
EXECUTOR_WASM="$WASM_DIR/wormhole_executor_stellar.wasm"
LAZER_WASM="$WASM_DIR/pyth_lazer_stellar.wasm"

# Optimize WASM files using wasm-opt if available
# This strips reference-types (required for Soroban VM) and reduces size
if command -v wasm-opt &> /dev/null; then
    echo "=== Optimizing WASM files with wasm-opt ==="
    wasm-opt -Oz --disable-reference-types \
        "$EXECUTOR_WASM" -o "${EXECUTOR_WASM%.wasm}.optimized.wasm"
    EXECUTOR_WASM="${EXECUTOR_WASM%.wasm}.optimized.wasm"

    wasm-opt -Oz --disable-reference-types \
        "$LAZER_WASM" -o "${LAZER_WASM%.wasm}.optimized.wasm"
    LAZER_WASM="${LAZER_WASM%.wasm}.optimized.wasm"
else
    echo "Warning: wasm-opt not found. Install with: cargo install wasm-opt"
    echo "Deploying unoptimized WASM (may fail if reference-types are present)."
fi

echo "Executor WASM: $EXECUTOR_WASM ($(wc -c < "$EXECUTOR_WASM") bytes)"
echo "Lazer WASM:    $LAZER_WASM ($(wc -c < "$LAZER_WASM") bytes)"
echo ""

# Step 2: Deploy wormhole-executor-stellar
echo "=== Deploying wormhole-executor-stellar ==="
EXECUTOR_ID=$(stellar contract deploy \
    --wasm "$EXECUTOR_WASM" \
    $COMMON_ARGS \
    2>&1 | tail -1)
echo "Executor contract ID: $EXECUTOR_ID"
echo ""

# Step 3: Deploy pyth-lazer-stellar
echo "=== Deploying pyth-lazer-stellar ==="
LAZER_ID=$(stellar contract deploy \
    --wasm "$LAZER_WASM" \
    $COMMON_ARGS \
    2>&1 | tail -1)
echo "Lazer contract ID: $LAZER_ID"
echo ""

# Step 4: Initialize wormhole-executor-stellar
echo "=== Initializing wormhole-executor-stellar ==="

# Build guardian set JSON array
IFS=',' read -ra GUARDIANS <<< "$GUARDIAN_SET"
GUARDIAN_JSON="["
for i in "${!GUARDIANS[@]}"; do
    addr="${GUARDIANS[$i]}"
    addr=$(echo "$addr" | tr '[:upper:]' '[:lower:]' | sed 's/^0x//')
    if [[ $i -gt 0 ]]; then
        GUARDIAN_JSON+=","
    fi
    GUARDIAN_JSON+="\"$addr\""
done
GUARDIAN_JSON+="]"

# Pad emitter address to 64 hex chars (32 bytes)
PADDED_EMITTER=$(printf '%064s' "$EMITTER_ADDRESS" | tr ' ' '0')

stellar contract invoke \
    --id "$EXECUTOR_ID" \
    $COMMON_ARGS \
    -- \
    initialize \
    --chain_id "$CHAIN_ID" \
    --owner_emitter_chain "$EMITTER_CHAIN" \
    --owner_emitter_address "$PADDED_EMITTER" \
    --initial_guardian_set "$GUARDIAN_JSON" \
    --guardian_set_index "$GUARDIAN_INDEX"

echo "Executor initialized."
echo ""

# Step 5: Initialize pyth-lazer-stellar with initial trusted signer
echo "=== Initializing pyth-lazer-stellar ==="
stellar contract invoke \
    --id "$LAZER_ID" \
    $COMMON_ARGS \
    -- \
    initialize \
    --executor "$EXECUTOR_ID" \
    --initial_signer "\"$LAZER_SIGNER_PUBKEY\"" \
    --initial_signer_expires_at "$FAR_FUTURE_EXPIRY"

echo "Lazer contract initialized with trusted signer."
echo "Trusted signer: $LAZER_SIGNER_PUBKEY (expires: $FAR_FUTURE_EXPIRY)"
echo ""

# Output summary
echo "========================================="
echo "=== Deployment Complete ==="
echo "========================================="
echo ""
echo "Network:                $NETWORK"
echo "Wormhole Chain ID:      $CHAIN_ID"
echo "Guardian Set Index:     $GUARDIAN_INDEX"
echo "Emitter Chain:          $EMITTER_CHAIN"
echo ""
echo "Executor Contract ID:   $EXECUTOR_ID"
echo "Lazer Contract ID:      $LAZER_ID"
echo ""
echo "Lazer Signer Pubkey: $LAZER_SIGNER_PUBKEY"
echo "Signer Expiry:      $FAR_FUTURE_EXPIRY"
echo ""
echo "Next steps:"
echo "  1. Call verify_update on the Lazer contract with a signed price update"
echo ""
echo "Example - verify update:"
echo "  stellar contract invoke --id $LAZER_ID --network $NETWORK --source <SECRET> -- \\"
echo "    verify_update --data <SIGNED_UPDATE_HEX>"
