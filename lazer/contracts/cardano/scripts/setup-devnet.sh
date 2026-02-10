#!/usr/bin/env bash
set -euo pipefail

# Setup a local Yaci devnet for integration testing.
# Prerequisites: Docker running, devkit installed (https://devkit.yaci.xyz),
#                npm dependencies installed (npm install in typescript/)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_DIR="$(cd "$SCRIPT_DIR/../typescript" && pwd)"

YACI_ADMIN="http://localhost:10000/local-cluster/api"
YACI_STORE="http://localhost:8080/api/v1"
TOPUP_ADA=10000

echo "==> Deriving test wallet address..."
WALLET_ADDR=$(npx tsx -e "
  import { getWalletForYaci } from '$TS_DIR/integration_test/yaci-provider.ts';
  (async () => {
    const w = getWalletForYaci();
    console.log(await w.getChangeAddress());
  })();
")

if [ -z "$WALLET_ADDR" ]; then
    echo "    ERROR: Could not derive wallet address"
    exit 1
fi
echo "    $WALLET_ADDR"

echo "==> Checking if devkit containers are running..."
if ! curl -sf "$YACI_ADMIN/admin/devnet/status" > /dev/null 2>&1; then
    echo "    Devkit is not running. Starting..."
    devkit start &
    DEVKIT_PID=$!

    # Wait for the admin API to come up
    for i in $(seq 1 30); do
        if curl -sf "$YACI_ADMIN/admin/devnet/status" > /dev/null 2>&1; then
            break
        fi
        sleep 2
    done

    if ! curl -sf "$YACI_ADMIN/admin/devnet/status" > /dev/null 2>&1; then
        echo "    ERROR: Devkit admin API did not start within 60s"
        exit 1
    fi
fi

echo "==> Creating devnet node..."
curl -sf -X POST "$YACI_ADMIN/admin/devnet/create" \
    -H "Content-Type: application/json" \
    -d '{}' > /dev/null

echo "==> Waiting for Yaci Store API..."
for i in $(seq 1 30); do
    if curl -sf "$YACI_STORE/blocks/latest" > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

if ! curl -sf "$YACI_STORE/blocks/latest" > /dev/null 2>&1; then
    echo "    ERROR: Yaci Store API did not become ready within 60s"
    exit 1
fi

echo "==> Funding test wallet with ${TOPUP_ADA} ADA..."
RESULT=$(curl -sf -X POST "$YACI_ADMIN/addresses/topup" \
    -H "Content-Type: application/json" \
    -d "{\"address\":\"${WALLET_ADDR}\",\"adaAmount\":${TOPUP_ADA}}")

STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', False))")
if [ "$STATUS" != "True" ]; then
    echo "    ERROR: Topup failed: $RESULT"
    exit 1
fi

echo "==> Waiting for funds to appear on-chain..."
for i in $(seq 1 15); do
    UTXOS=$(curl -sf "$YACI_STORE/addresses/${WALLET_ADDR}/utxos" 2>/dev/null || echo "[]")
    COUNT=$(echo "$UTXOS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    if [ "$COUNT" -gt 0 ]; then
        break
    fi
    sleep 2
done

echo ""
echo "Devnet is ready."
