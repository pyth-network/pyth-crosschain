#!/usr/bin/env bash
# This script configures the devnet for test transfers with hardcoded addresses.
set -x

# Configure CLI (works the same as upstream Solana CLI)
mkdir -p ~/.config/solana/cli
cat <<EOF > ~/.config/solana/cli/config.yml
json_rpc_url: "http://127.0.0.1:8899"
websocket_url: ""
keypair_path: /solana-secrets/solana-devnet.json
EOF

# Constants
bridge_address=Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o
initial_guardian=befa429d57cd18b7f8a4d91a2da9ab4af05d0fbe

retry () {
  while ! $@; do
    sleep 1
  done
}

# Fund our account (as defined in solana/keys/solana-devnet.json).
retry solana airdrop 1000

# Create the bridge contract at a known address
# OK to fail on subsequent attempts (already created).
retry bridge_client create-bridge "$bridge_address" "$initial_guardian" 86400 100

# Let k8s startup probe succeed
nc -k -l -p 2000
