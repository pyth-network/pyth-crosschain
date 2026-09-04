# Contract Manager

The contract manager is a tool to interact with Pyth related contracts on all supported chains.

It has the following structure:

- `store` contains all the necessary information for registered chains and deployed contracts
- `scripts` contains utility scripts to interact with the contract manager and accomplish common tasks
- `src` contains the contract manager code

# Main Entities

Contract Manager has base classes which you can use to interact with the
entities below. Most have a chain-specific implementation per supported ecosystem
(EVM/Cosmos/Aptos/Sui/Iota/Near/Fuel/Starknet/Ton/Stellar), and every instance is
loaded from `store` by the `DefaultStore`.

- **Chain** (`Chain`) — a blockchain network the tooling can target; holds RPC/network config and builds and submits transactions and governance payloads.
- **Price feed contract** (`PriceFeedContract`) — the core Pyth contract that receives price updates and is configured through governance.
- **Wormhole contract** (`WormholeContract`) — the Wormhole core bridge contract used to verify and submit governance VAAs.
- **Lazer contract** (`EvmLazerContract` / `SuiLazerContract` / `IotaLazerContract` / `StellarLazerContract`) — the Pyth Lazer verifier, which checks signed Lazer price updates and holds the trusted signer set.
- **Executor contract** (`EvmExecutorContract` / `StellarExecutorContract`) — the governance executor that verifies a Pyth governance VAA and dispatches the decoded action to its target contract (or upgrades itself).
- **Entropy contract** (`EvmEntropyContract`) — the Pyth Entropy contract serving on-chain secure randomness requests.
- **Pulse contract** (`EvmPulseContract`) — the Pyth Pulse contract for scheduled, on-demand price-update callbacks.
- **Token** (`Token`) — a native/gas token used to pay fees on a chain.
- **Vault** (`Vault`) — the Solana multisig governance vault used to propose and execute governance messages.

# Docs

You can generate the docs by running `pnpm exec typedoc src/index.ts` from this directory. Open the docs by opening `docs/index.html` in your browser.

# Scripts

You can run the scripts by executing `pnpm tsx scripts/<script_name>.ts` from this directory.

## `report_price_feed_usage.ts`

Reports which price feeds are actually being written on-chain, so that feeds in real use can
be checked against the Pyth Pro catalog before Pyth Core is switched off. It covers every EVM
and Sui mainnet that has a `pro-compatible-production` price feed contract, plus Solana, and
on each one scans both that deployment and the legacy Core deployment.

The three platforms are counted by different mechanisms, since none is shared:

| platform | position   | mechanism                                                      |
| -------- | ---------- | -------------------------------------------------------------- |
| EVM      | block      | `eth_getLogs` on the `PriceFeedUpdate` topic                     |
| Sui      | checkpoint | GraphQL `events` on `<pkg>::event::PriceFeedUpdateEvent`         |
| SVM      | slot       | receiver `post_update` instructions decoded from transactions    |

EVM and Sui counts mean the same thing — both events fire only on a *fresh* update. SVM counts
are write attempts that reached the receiver, which is close but not identical; see the header
comment in the script.

```sh
pnpm tsx scripts/report_price_feed_usage.ts --days 30 --output usage.csv
```

This writes three files: `usage.csv` (one row per feed, one column per chain), `usage_split.csv`
(the same counts split into legacy and upgraded contracts) and `usage_coverage.csv` (the
position range actually scanned per contract). Run `--help` for the full flag list.

A 30-day run takes hours and is resumable — re-run the same command to continue from the
checkpoint file named by `--state-file`.

### RPC endpoints

The scan is bounded by request count, not data volume, because public RPCs cap `eth_getLogs`
block ranges. The chunk size adapts automatically, but on the chains below a public endpoint
means tens of thousands of requests or an outright refusal, so point them at a paid archive
endpoint with `--rpc <chain>=<url>` (or through the `$ENV_*` placeholder the `rpcUrl` values in
`src/store/chains/EvmChains.json` already support):

| chain             | problem with the public endpoint in the store          |
| ----------------- | ------------------------------------------------------ |
| `injective_inevm` | endpoint is dead; the chain cannot be scanned at all    |
| `optimism`        | 50-block cap, and 30-day-old logs are refused outright  |
| `monad`           | 100-block cap over ~8.6M blocks per 30 days             |
| `bsc`, `hyperevm` | 1,000-block cap                                         |
| `cronos`          | 2,000-block cap                                         |
| `solana_mainnet`  | needs `SOLANA_MAINNET_API_KEY`; see below               |

Solana is the hardest of these. A count costs one `getTransaction` per receiver transaction,
and `api.mainnet-beta.solana.com` serves about 1.25 per second before returning HTTP 429 —
against a receiver that sees roughly 2.1 transactions per second, so the scan cannot keep up
with real time on the public endpoint. Set `SOLANA_MAINNET_API_KEY` (the `rpcUrl` in
`src/store/chains/SvmChains.json` already interpolates it) or pass `--rpc solana_mainnet=<url>`.

A chain that cannot be scanned across the whole window is never silently under-counted: its
column in `usage.csv` is suffixed `_INCOMPLETE` and `usage_coverage.csv` records the position
range and wall-clock window it actually covered.
