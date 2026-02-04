## Pyth Lazer Sui Contract

`pyth_lazer` is a Sui package that allows consumers to easily parse and verify cryptographically signed price feed data from the Pyth Network's high-frequency Lazer protocol for use on-chain.

This package is built using the Move language edition `2024` and Sui framework `v1.63.1`.

### Build, test, deploy

Install Sui CLI and build the project:

```bash
brew install sui # or install and use `suiup`
sui move build
```

Run tests:

```bash
sui move test
# run a specific test
sui move test test_parse_and_verify_le_ecdsa_update
```

Deploy:

```bash
set -euo pipefail

# name of your Sui key identity
# KEY_ALIAS=""
SUI_KEY=$(
  sui keytool export --key-identity "$KEY_ALIAS" --json \
  | jq -r '.exportedPrivateKey'
)

REPO=$(git rev-parse --show-toplevel)
CHAIN="sui_testnet" # or "sui_mainnet"
# Wormhole state object ID, see:
# https://wormhole.com/docs/products/reference/contract-addresses
WORMHOLE="31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790"
# Wormhole emitter chain ID, see:
# https://wormhole.com/docs/products/reference/chain-ids
GOVERNANCE_CHAIN="1" # for Solana
# Wormhole emitter address
GOVERNANCE_ADDRESS="a36234ef3749a2c94136b6345bceff450791ef1ebc99e918f16f8075a441bb24"

cd "$REPO/contract_manager"

# Defaults to Pyth governance when chain and address are omitted
pnpm tsx scripts/manage_sui_lazer_contract.ts -c "$CHAIN" deploy \
  --private-key "$SUI_KEY" \
  --wormhole "$WORMHOLE" \
  --governance-chain "$GOVERNANCE_CHAIN" \
  --governance-address "$GOVERNANCE_ADDRESS"
```

`deploy` command updates contents of [`meta.move`] using [`meta.move.mustache`]
to reflect its parameters.

**DO NOT DEPLOY OR UPGRADE without correct [`meta.move`], otherwise we get
locked out of the package after the upgrade!**

### Test contract management

Test contract upgrade:

```bash
# See `deploy` above for env setup

# Emitter key matching configuration used for deploy
EMITTER_KEY="$HOME/.config/solana/id.json"

# Contract ID taken from `deploy` output or `SuiLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_sui_lazer_contract.ts -c "$CHAIN" test-upgrade \
  --private-key "$SUI_KEY" \
  --contract "$CONTRACT_ID" \
  --emitter "$EMITTER_KEY"
```

Test update of trusted signer:

```bash
# See `deploy` above for env setup

# Emitter key matching configuration used for deploy
EMITTER_KEY="$HOME/.config/solana/id.json"

# Contract ID taken from `deploy` output or `SuiLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_sui_lazer_contract.ts -c "$CHAIN" \
  test-update-trusted-signer \
  --private-key "$SUI_KEY" \
  --contract "$CONTRACT_ID" \
  --emitter "$EMITTER_KEY" \
  --signer "03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b" \
  --expires "1799422709"
```

### Production contract management

Production contract upgrade:

```bash
# See `deploy` above for env setup

# Key for ops wallet capable of submitting proposals
WALLET_KEY="$HOME/.config/solana/id.json"

# Contract ID taken from `deploy` output or `SuiLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_sui_lazer_contract.ts -c "$CHAIN" propose-upgrade \
  --contract "$CONTRACT_ID" \
  --wallet "$WALLET_KEY"
```

Production trusted signer update:

```bash
# See `deploy` above for env setup

# Key for ops wallet capable of submitting proposals
WALLET_KEY="$HOME/.config/solana/id.json"

pnpm tsx scripts/manage_sui_lazer_contract.ts -c "$CHAIN" \
  propose-update-trusted-signer \
  --wallet "$WALLET_KEY" \
  --signer "03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b" \
  --expires "1799422709"
```

Execute unseen governance actions:

```bash
# See `deploy` above for env setup

# Contract ID taken from `deploy` output or `SuiLazerContracts.json`
# CONTRACT_ID=""

pnpm tsx scripts/manage_sui_lazer_contract.ts -c "$CHAIN" execute-proposals \
  --private-key "$SUI_KEY" \
  --contract "$CONTRACT_ID"
```

[`meta.move`]: sources/meta.move
[`meta.move.mustache`]: sources/meta.move.mustache
