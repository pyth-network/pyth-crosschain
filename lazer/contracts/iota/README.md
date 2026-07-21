## Pyth Lazer IOTA Contract

`pyth_lazer` is an IOTA package that allows consumers to easily parse and
verify cryptographically signed price feed data from the Pyth Network's
high-frequency Lazer protocol for use on-chain.

This package is built using the Move language edition `2024`, the IOTA Move
flavor, and compiler version `1.27.0`.

### Build and test

Install the IOTA CLI and build the project:

```bash
brew install iotaledger/tap/iota
iota move build
```

Run tests:

```bash
iota move test
# run a specific test
iota move test test_parse_and_verify_le_ecdsa_update
```

### Deploy

Set up the deployment environment:

```bash
set -euo pipefail

# Name of your IOTA key identity
# KEY_ALIAS=""
IOTA_KEY=$(
  iota keytool export "$KEY_ALIAS" --json \
  | jq -r '.exportedPrivateKey'
)

REPO=$(git rev-parse --show-toplevel)
CHAIN="iota_localnet" # or "iota_testnet" / "iota_mainnet"

# The active IOTA CLI environment must match CHAIN
iota client switch --env "${CHAIN#iota_}"

cd "$REPO/contract_manager"
```

Vendor and test the upstream Wormhole package for the selected chain:

```bash
pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" vendor-wormhole
```

This writes the patched package to
`lazer/contracts/iota/vendor/wormhole_<network>`, replacing an existing copy
for that network after the new copy passes its tests.

Publish and initialize Wormhole. For a local or test deployment that will use
the devnet emitter in the test-management commands below, override the initial
guardian as shown:

```bash
GUARDIAN_SET_TTL="90000"
INITIAL_GUARDIAN="13947bd48b18e53fdaeee77f3473391ac727c638"

pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" deploy-wormhole \
  --guardian-set-ttl "$GUARDIAN_SET_TTL" \
  --private-key "$IOTA_KEY" \
  --initial-guardian "$INITIAL_GUARDIAN"
```

For a production deployment, do not use the example devnet guardian. Omitting
`--initial-guardian` uses the stable Wormhole bootstrap guardian. Pass
`--upgrade-guardian-set` to fetch and apply the canonical guardian-set upgrade
VAAs after initialization:

```bash
pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" deploy-wormhole \
  --guardian-set-ttl "$GUARDIAN_SET_TTL" \
  --private-key "$IOTA_KEY" \
  --upgrade-guardian-set
```

The command prints the Wormhole `State` object ID and stores the deployment in
`IotaWormholeContracts.json`. Use that state object to deploy Lazer:

```bash
# Wormhole State object ID from deploy-wormhole output
# WORMHOLE=""

# Wormhole emitter chain ID, see:
# https://wormhole.com/docs/products/reference/chain-ids
GOVERNANCE_CHAIN="1" # Solana
# Wormhole emitter address
GOVERNANCE_ADDRESS="a36234ef3749a2c94136b6345bceff450791ef1ebc99e918f16f8075a441bb24"

# Defaults to Pyth governance when chain and address are omitted
pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" deploy \
  --private-key "$IOTA_KEY" \
  --wormhole "$WORMHOLE" \
  --governance-chain "$GOVERNANCE_CHAIN" \
  --governance-address "$GOVERNANCE_ADDRESS"
```

The `deploy` command generates the selected `Move.<network>.toml` using
[`Move.toml.mustache`], links `Move.toml` to it, and updates [`meta.move`] using
[`meta.move.mustache`]. It prints the Lazer `State` object ID and stores the
contract in `IotaLazerContracts.json`.

**DO NOT DEPLOY OR UPGRADE without the correct [`meta.move`], otherwise the
package becomes locked after the publish or upgrade. Commit the generated Move
manifest and metadata changes.**

### Test contract management

Test a contract upgrade:

```bash
# See `Deploy` above for environment setup

# Emitter key matching the configuration used for deployment
EMITTER_KEY="$HOME/.config/solana/id.json"

# Contract ID taken from `deploy` output or `IotaLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" test-upgrade \
  --private-key "$IOTA_KEY" \
  --contract "$CONTRACT_ID" \
  --emitter "$EMITTER_KEY"
```

Test an update of the trusted signer:

```bash
# See `Deploy` above for environment setup

# Emitter key matching the configuration used for deployment
EMITTER_KEY="$HOME/.config/solana/id.json"

# Contract ID taken from `deploy` output or `IotaLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" \
  test-update-trusted-signer \
  --private-key "$IOTA_KEY" \
  --contract "$CONTRACT_ID" \
  --emitter "$EMITTER_KEY" \
  --signer "03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b" \
  --expires "1799422709"
```

### Production contract management

Propose a production contract upgrade:

```bash
# See `Deploy` above for environment setup

# Key for an ops wallet capable of submitting proposals
WALLET_KEY="$HOME/.config/solana/id.json"

# Contract ID taken from `deploy` output or `IotaLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" propose-upgrade \
  --contract "$CONTRACT_ID" \
  --wallet "$WALLET_KEY"
```

Propose a production trusted signer update:

```bash
# See `Deploy` above for environment setup

# Key for an ops wallet capable of submitting proposals
WALLET_KEY="$HOME/.config/solana/id.json"

pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" \
  propose-update-trusted-signer \
  --wallet "$WALLET_KEY" \
  --signer "03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b" \
  --expires "1799422709"
```

Execute unseen governance actions:

```bash
# See `Deploy` above for environment setup

# Contract ID taken from `deploy` output or `IotaLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_iota_lazer_contract.ts -c "$CHAIN" \
  execute-proposals \
  --private-key "$IOTA_KEY" \
  --contract "$CONTRACT_ID"
```

[`Move.toml.mustache`]: Move.toml.mustache
[`meta.move`]: sources/meta.move
[`meta.move.mustache`]: sources/meta.move.mustache
