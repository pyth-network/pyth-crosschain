#!/usr/bin/env bash
set -euo pipefail

# Start a Yaci devnet, fund the test wallet, and run integration tests.
# Prerequisites: Docker running, devkit installed (https://devkit.yaci.xyz)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Installing dependencies..."
cd "$REPO_ROOT/typescript"
npm install --silent

echo ""
echo "==> Setting up devnet..."
"$SCRIPT_DIR/setup-devnet.sh"

echo ""
echo "==> Running integration tests..."
npm run test:integration
