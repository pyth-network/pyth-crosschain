# Pyth Lazer for Cardano

See [`DESIGN`](./DESIGN.md) for description of contract architecture.

**(TODO)**

## Setup

Prepare `./sdk/js/.env` file using [`.env.example`](./sdk/js/.env.example) as
a template. Make sure to install [Aiken](https://aiken-lang.org), e.g. through
`aikup`:

```bash
brew install aiken-lang/tap/aikup
aikup install
```

## Building and testing

Contract can be built and checked separately using `aiken build` and
`aiken check` commands, but to correctly generate off-chain bindings, switch to
`./sdk/js` directory and use `pnpm cli build` command.

For debugging purposes, it is useful to pass `--trace-level=verbose` to `build`
commands - this will generate friendly traces from `except` and `?` syntax shown
in error logs, but will inflate contract sizes.

## Devnet

For local development, run `pnpm cli devnet` in a separate terminal to start
a local network. The setup will automatically give your wallet funds for
testing.

## Deploying

Build on-chain scripts and off-chain bindings:

```bash
set -euo pipefail

REPO=$(git rev-parse --show-toplevel)

cd "$REPO/lazer/contracts/cardano/sdk/js"

# Environment can be "default" | "preprod" | "preview"
pnpm cli build --env preview
```

Initialize contracts state:

```bash
# Can be "mainnet" | "preprod" | "preview" | "devnet"
CARDANO_NETWORK="devnet"
# Wormhole emitter chain ID, see:
# https://wormhole.com/docs/products/reference/chain-ids
GOVERNANCE_CHAIN="1" # for Solana
# Wormhole emitter address
GOVERNANCE_ADDRESS="5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e"

pnpm cli init --network "$CARDANO_NETWORK" \
  --emitter-chain "$GOVERNANCE_CHAIN" \
  --emitter-address "$GOVERNANCE_ADDRESS"
```

This outputs policy IDs identifying Wormhole and Pyth deployments. We will refer to Pyth policy ID as `PYTH_ID`.

Generate trusted signer proposal for testnet self-managed deployment:

```bash
# Emitter key matching configuration used for deploy
EMITTER_KEY="$HOME/.config/solana/id.json"

cd "$REPO/contract_manager"

pnpm tsx scripts/manage_cardano_governance.ts -c "cardano_$CARDANO_NETWORK" \
  test-update-trusted-signer \
  --emitter "$EMITTER_KEY" \
  --signer "80efc1f480c5615af3fb673d42287e993da9fbc3506b6e41dfa32950820c2e6c" \
  --expires "1799422709"
```

or propose signer update to governance on production:

```bash
# Key for ops wallet capable of submitting proposals
WALLET_KEY="$HOME/.config/solana/id.json"

cd "$REPO/contract_manager"

pnpm tsx scripts/manage_cardano_governance.ts -c "cardano_$CARDANO_NETWORK" \
  propose-update-trusted-signer \
  --wallet "$WALLET_KEY" \
  --signer "80efc1f480c5615af3fb673d42287e993da9fbc3506b6e41dfa32950820c2e6c" \
  --expires "1799422709"
```

and execute VAA provided in the output:

```bash
cd "$REPO/lazer/contracts/cardano/sdk/js"

pnpm cli execute --network "$CARDANO_NETWORK" \
  --state "$PYTH_ID" \
  --vaa "$VAA"
```

## Upgrading (TODO)

### Withdraw script

First get the withdraw script hash:

```bash
cd "$REPO/lazer/contracts/cardano/sdk/js"

pnpm cli withdraw-script-hash --state "$PYTH_ID"
```

Then on testnet / self-managed deployments:

```bash
# Emitter key matching configuration used for deploy
EMITTER_KEY="$HOME/.config/solana/id.json"

cd "$REPO/contract_manager"

pnpm tsx scripts/manage_cardano_governance.ts -c "cardano_$CARDANO_NETWORK" \
  test-upgrade-withdraw-script \
  --emitter "$EMITTER_KEY" \
  --script "$WITHDRAW_SCRIPT_HASH" \
  --expires "1799422709"
```

or production:

```bash
WALLET_KEY="$HOME/.config/solana/id.json"

cd "$REPO/contract_manager"

pnpm tsx scripts/manage_cardano_governance.ts -c "cardano_$CARDANO_NETWORK" \
  propose-upgrade-withdraw-script \
  --wallet "$WALLET_KEY" \
  --script "$WITHDRAW_SCRIPT_HASH" \
  --expires "1799422709"
```

Finally, execute the proposal with:

```bash
cd "$REPO/lazer/contracts/cardano/sdk/js"

pnpm cli execute --network "$CARDANO_NETWORK" \
  --state "$PYTH_ID" \
  --vaa "$VAA"
```

Spend script upgrades use the same flow. First get the spend script hash:

```bash
cd "$REPO/lazer/contracts/cardano/sdk/js"

pnpm cli spend-script-hash
```

On testnet / self-managed deployments:

```bash
EMITTER_KEY="$HOME/.config/solana/id.json"

cd "$REPO/contract_manager"

pnpm tsx scripts/manage_cardano_governance.ts -c "cardano_$CARDANO_NETWORK" \
  test-upgrade-spend-script \
  --emitter "$EMITTER_KEY" \
  --script "$NEW_SPEND_SCRIPT_HASH"
```

or production:

```bash
WALLET_KEY="$HOME/.config/solana/id.json"

cd "$REPO/contract_manager"

pnpm tsx scripts/manage_cardano_governance.ts -c "cardano_$CARDANO_NETWORK" \
  propose-upgrade-spend-script \
  --wallet "$WALLET_KEY" \
  --script "$NEW_SPEND_SCRIPT_HASH"
```

As with withdraw script upgrades, apply the printed VAA directly for the test
flow, or wait for governance to emit the VAA for the production flow and then
run `pnpm cli execute`.

<!-- TODO:
    We'll need to expand on which CLI version to run and how to provide correct
    script binary for the process.
-->
