# Pyth Governance Voter CLI

A small CLI for casting votes on [Pyth DAO](https://v2.realms.today/dao/4ct8XU5tKbMNRphWy4rePsS9kBqPhDdvZoGpmprPaug4)
governance proposals from a **Fireblocks**-custodied Solana wallet (the
production path), or from a local **hot** wallet / **Ledger** device (for
testing).

Realms' own UI does not work with our Fireblocks vault, so this replaces the
manual click-through flow with a scriptable, reviewable transaction builder.

Each vote is a single Solana transaction with two instructions:

1. `updateVoterWeight(CastVote)` on the Pyth staking program — stamps the
   voter-weight record for the proposal's voting epoch.
2. `castVote` on SPL Governance V2 — consumes that voter weight and records the
   vote.

Both instructions must be in the same transaction for the freshly computed voter
weight to be valid.

## Install & build

From the repository root:

```sh
pnpm install
pnpm turbo build --filter=@pythnetwork/pyth-governance-voter
```

This produces `dist/index.cjs`. Run it with `node dist/index.cjs …` or via the
`pyth-governance-voter` bin.

## Finding a proposal address

Open the proposal on Realms
(`https://v2.realms.today/dao/4ct8XU5tKbMNRphWy4rePsS9kBqPhDdvZoGpmprPaug4`),
click the proposal you want to vote on, and copy the proposal's public key from
the URL or the "Proposal" account link on the page. That pubkey is the
`--proposal` argument.

## Usage

```
pyth-governance-voter cast-vote \
  --proposal <proposal-pubkey> \
  --side yes|no \
  --wallet fireblocks|hot|ledger \
  --stake-account <stake-account-positions-pubkey> \
  [--rpc-url <solana-rpc-url>] \
  [--dry-run] \
  [--hot-wallet-path <keypair.json>] \
  [--ledger-derivation-account <n> --ledger-derivation-change <n>]
```

- `--stake-account` is **required** — the CLI does not auto-detect it. Pass the
  stake-account-positions pubkey whose owner is the voter wallet.
- `--rpc-url` defaults to `https://api.mainnet-beta.solana.com`.
- `--side yes` maps to an SPL Governance `Approve` vote (100% weight on the
  single choice); `--side no` maps to a `Deny` vote.

### Dry run first

`--dry-run` builds the exact transaction (including a recent blockhash), prints a
structured summary of both instructions, and runs
`connection.simulateTransaction`. It exits `0` on a clean simulation and non-zero
if the simulation returns an error. **No transaction is sent, and for
`--wallet fireblocks` no Fireblocks approval item is created.**

Always dry-run first, eyeball the summary and simulation logs, then re-run
without `--dry-run` to actually cast the vote.

### Hot wallet (local testing)

```sh
node dist/index.cjs cast-vote \
  --proposal <proposal-pubkey> \
  --side yes \
  --wallet hot \
  --hot-wallet-path ~/.config/solana/id.json \
  --stake-account <stake-account-positions-pubkey> \
  --dry-run
```

### Ledger

```sh
node dist/index.cjs cast-vote \
  --proposal <proposal-pubkey> \
  --side no \
  --wallet ledger \
  --ledger-derivation-account 0 \
  --ledger-derivation-change 0 \
  --stake-account <stake-account-positions-pubkey>
```

Enable [blind signing](https://www.ledger.com/academy/enable-blind-signing-why-when-and-how-to-stay-safe)
in the Ledger Solana app, and approve the transaction on the device when
prompted.

### Fireblocks (production)

```sh
export FIREBLOCKS_API_KEY=<uuid>
export FIREBLOCKS_SECRET_KEY_PATH=/path/to/fireblocks_secret.pem
export FIREBLOCKS_VAULT_ACCOUNT_ID=<numeric-vault-id>
# optional:
export FIREBLOCKS_ASSET_ID=SOL          # use SOL_TEST for devnet
export FIREBLOCKS_VOTER_PUBKEY=<pubkey> # skip the getDepositAddresses lookup

node dist/index.cjs cast-vote \
  --proposal <proposal-pubkey> \
  --side yes \
  --wallet fireblocks \
  --stake-account <stake-account-positions-pubkey> \
  --dry-run
```

The Fireblocks path signs the transaction message with a `RAW`
`MPC_EDDSA_ED25519` signing operation, polls Fireblocks every 3 seconds (up to 5
minutes) for the operation to complete (printing the Fireblocks transaction id so
a pending approval can be traced), attaches the returned signature, and submits
the transaction to Solana.

**Approve promptly.** The signature covers a specific recent blockhash, which is
only valid for ~60–90 seconds. If the Fireblocks approval takes longer than
that, the blockhash expires and the transaction can no longer be submitted (the
signed message cannot be re-blockhashed without another approval). The CLI
detects this and exits with an actionable error rather than an opaque send
failure — just re-run the command and approve quickly. A durable-nonce execute
path would remove this time pressure and is a candidate future improvement.

## Environment variable contract (Fireblocks)

Credentials are read from the environment only — never as CLI flags — so they do
not land in shell history.

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIREBLOCKS_API_KEY` | yes | Fireblocks API key (uuid) |
| `FIREBLOCKS_SECRET_KEY_PATH` | yes | Path to the RSA private key PEM, read once at startup |
| `FIREBLOCKS_VAULT_ACCOUNT_ID` | yes | Numeric vault account id holding the wallet |
| `FIREBLOCKS_ASSET_ID` | no (default `SOL`) | Fireblocks asset id; use `SOL_TEST` for devnet |
| `FIREBLOCKS_VOTER_PUBKEY` | no | Voter Solana pubkey; if unset, derived via `getDepositAddresses` |

The Fireblocks secret key contents are never logged, echoed, or written
anywhere.
