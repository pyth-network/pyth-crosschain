# Solana v1 transaction readiness

Solana's [larger transaction sizes](https://solana.com/upgrades/larger-transaction-sizes)
upgrade adds a third transaction version, `v1`. This page records what breaks in this
repo when v1 transactions appear on chain, and what we must change before we can send
v1 transactions ourselves.

## What v1 changes

- The size limit rises from 1232 bytes to 4096 bytes.
- The message starts with a `0x81` discriminator. Signatures move to the tail and lose
  their length prefix.
- Address lookup tables are gone. Every account sits inline, up to 64 of them.
- Duplicate account addresses are rejected instead of deduplicated.
- Compute unit limit, loaded accounts data size, heap size, and priority fee move out of
  `ComputeBudget` instructions and into fixed message config fields. They default to
  zero, not to the legacy 200k CU and 64 MiB.
- The priority fee field holds total lamports, not micro-lamports per compute unit.
- On-chain programs cannot read the message config. A v1 transaction carries no
  `ComputeBudget` instruction for the instructions sysvar to expose.
- Reading a v1 transaction needs `maxSupportedTransactionVersion: 1` on `getTransaction`
  and `getBlock`, and `@solana/kit` >= 8.0.0, `@solana/web3.js` >= 3.0.0-rc.3,
  `solana-*` >= 4.2, `solders` >= 0.29.0, or the Go client >= 1.23.0.
- Sending a transaction over 1232 bytes requires `encoding: "base64"`.

## Breaks on its own, once v1 transactions land

Two call sites fail without us changing anything.

- `contract_manager/src/node/utils/governance.ts`,
  `SubmittedWormholeMessage.fromTransactionSignature`. It called `getParsedTransaction`
  with no version config, so the RPC rejected every versioned transaction with error
  -32015. It now passes `maxSupportedTransactionVersion: 0`, which covers legacy and v0.
  A v1 governance transaction still fails there, and will keep failing until the package
  moves off `@solana/web3.js` 1.x.
- `pyth-network/research`, `pythresearch/data/scripts/pyth_usage/query_funders_solana.py`.
  It pins `maxSupportedTransactionVersion: 0` in the raw `getTransaction` body, so the
  RPC returns -32015 for every v1 funder transaction and the script's bare `except`
  turns that into a crash on the retry.

Nothing else reads transactions from an RPC. Hermes and Quorum only read accounts.
No on-chain program in this repo reads the message config, so no program logic changes.
The instructions sysvar reads in `programs/core-bridge` (secp256k1 signature
verification) and in the Lazer contract (ed25519 signature verification) target
precompile instructions, which v1 keeps.

## Blocks us from sending v1

Every Solana client we ship is pinned to `@solana/web3.js` 1.x, which cannot build or
parse a v1 transaction at all. `pnpm-workspace.yaml` catalogs `^1.98.0`, and
`solana_utils`, `pyth_solana_receiver`, `contract_manager`, `xc_admin`, `price_pusher`,
and `apps/staking` all follow it. Moving to v1 means moving to `@solana/kit`. On the Rust
side, `apps/hermes/server` pins `solana-client` and `solana-sdk` to `=1.16.19` and
`apps/quorum` to 2.2.x. Neither reads transactions, so neither blocks us today.

The following need rework in the same migration.

- `target_chains/solana/sdk/js/solana_utils/src/transaction.ts`, `getSizeOfTransaction`.
  It encodes the legacy and v0 layout: length-prefixed signatures at the head, one
  version byte, a lookup table array at the tail. All three are wrong for v1.
- The same file gates packing on `PACKET_DATA_SIZE`, the 1232-byte constant from
  `@solana/web3.js`. `PACKET_DATA_SIZE_WITH_ROOM_FOR_COMPUTE_BUDGET` derives from it, and
  `MAX_EXECUTOR_PAYLOAD_SIZE` in `xc_admin_common/src/propose.ts` derives from that.
  A v1 path needs a 4096-byte constant instead.
- `TransactionBuilder.buildVersionedTransactions` adds `setComputeUnitLimit` only when the
  estimate exceeds the 200k-per-instruction default. Under v1 that conditional leaves the
  compute unit limit at zero and the transaction fails. The builder must always write the
  config, and must also set the loaded accounts data size, which nothing sets today.
- `PriorityFeeConfig.computeUnitPriceMicroLamports` carries micro-lamports per compute
  unit. The v1 field is total lamports. `DEFAULT_PRIORITY_FEE_CONFIG` uses 50,000, which
  is a reasonable per-unit price and a large flat fee. Copying the number across is wrong.
- `buildVersionedTransactions` calls `compileToV0Message` with an address lookup table.
  `PythSolanaReceiver` threads one through and `price_pusher` passes it. v1 has no lookup
  tables. Dropping them costs 31 bytes per unique account, which the larger limit has to
  absorb.
- `pyth_solana_receiver/src/vaa.ts` works around the 1232-byte limit twice.
  `DEFAULT_REDUCED_GUARDIAN_SET_SIZE` trims a VAA from the full guardian set down to 5
  signatures so the contents fit one transaction, and `VAA_SPLIT_INDEX` splits the
  remaining write into two instructions. A 4096-byte transaction can carry a full
  13-signature VAA, so v1 lets us delete both workarounds and stop trimming signatures.
- The Lazer Solana contract takes `ed25519_instruction_index` from the caller, and
  `pyth-lazer/sdk/js-solana/src/ed25519.ts` takes a matching `instructionIndex`. Callers
  compute that index over the instruction list. Under v1 the `ComputeBudget` instructions
  are not in that list, so every hard-coded index shifts. `pyth-examples`
  `lazer/solana/src/lib.rs` hard-codes 0 and shows the problem.
- Frontends (`apps/staking`, `xc_admin_frontend`) go through
  `@solana/wallet-adapter-react`. A dapp must read `supportedTransactionVersions` from the
  wallet and fall back to v0 before it sends v1.
- `sendTransactions` in `solana_utils` posts through `connection.sendRawTransaction`,
  which already uses base64. No change needed there.
- Jito bundles go through `jito-ts`. Confirm the block engine accepts v1 before enabling
  v1 on the Jito pusher path.

## Not affected

- Duplicate account addresses. `@solana/web3.js` deduplicates accounts while compiling,
  so no call site produces a duplicate for v1 to reject.
- The 64-account inline limit. No transaction we build comes close.
- `PythGovernanceAction.serialize` and `ExecutePostedVaa.serialize` allocate a
  `PACKET_DATA_SIZE` scratch buffer and truncate to the written length. The constant is
  only an upper bound there.
