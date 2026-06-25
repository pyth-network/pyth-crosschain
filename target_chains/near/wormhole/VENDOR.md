# Vendored Wormhole NEAR core bridge

This directory is a Pyth-owned copy of the Wormhole NEAR **core bridge** contract. It exists so the
Pyth NEAR receiver can verify accumulator VAAs against a guardian set that Pyth controls (the 5 Pyth
Pro routers, 3-of-5 quorum) instead of the 19 Wormhole mainnet guardians, while reusing Wormhole's
battle-tested VAA wire format and guardian-set rotation flow.

## Upstream pin

- **Repo:** https://github.com/wormhole-foundation/wormhole
- **Path:** `near/contracts/wormhole`
- **Commit:** `3888993f80d9a7e63742103eea6e482b4de87181` (2026-06-23)

To re-sync, diff this directory against the upstream path at a newer commit and re-apply the deltas
below.

## What was carried over

Only the **core bridge**:

- `verify_vaa` — parse + verify a VAA against the active guardian set (`src/state.rs`, `src/byte_utils.rs`).
- The guardian-set state machine and the `UpgradeGuardianSet` governance VAA (action `2`).
- The contract-upgrade governance VAA (action `1`) and its `migrate` / `update_contract` path.

## What was dropped

The non-core-bridge surface is intentionally not vendored, since the Pyth receiver only ever calls
`verify_vaa`:

- Message publishing: `publish_message`, `register_emitter`, the `emitters` map.
- The message-fee / `transfer_fee` governance actions (`3`, `4`) and the `message_fee` / `bank`
  state they touched. `submit_vaa` now rejects those actions as `InvalidGovernanceAction`.
- The token bridge and NTT (these live in separate upstream contracts and were never in this path).

## Deltas from upstream (beyond the trim)

1. **Router-set initialization.** Upstream boots the guardian set after deploy via the
   owner-gated `boot_wormhole(gset, addresses)`. Here, guardian set index 0 is initialized directly
   in the `#[init] new(initial_guardians)` constructor. The constructor argument is the list of
   20-byte secp256k1 guardian addresses (hex). **TODO(deployment):** the 5 Pyth Pro router pubkeys
   are supplied by `jayantk` at deploy time — they are not hardcoded.

2. **Quorum.** `GuardianSetInfo::quorum` is a simple majority (`n / 2 + 1`), so the 5-router set
   verifies at **3-of-5**. Upstream uses Wormhole's `2n/3 + 1`, which for a 5-key set would require
   4-of-5. This is the only consensus-affecting change; the rotation flow, the grace period, and the
   VAA wire format are unchanged.

3. **near-sdk 5.5.0 migration.** Upstream targets `near-sdk 4.0`. The contract was migrated to
   `near-sdk 5.5.0` (the version the receiver uses) so the workspace carries a single near-sdk:
   `Balance`/`u128` deposit math became `NearToken`, `Gas(...)` became `Gas::from_tgas`, borsh
   derives gained `#[borsh(crate = "near_sdk::borsh")]`, and the verbose per-call gas logging was
   dropped. Behavior is otherwise preserved.

## Build

Reproducible build (matches the receiver's flow):

```
cd target_chains/near/wormhole
cargo near build reproducible-wasm
```

The workspaces tests in `../receiver/tests/workspaces.rs` build the non-reproducible wasm via
`../receiver/workspace-test.sh` and deploy it with a 5-key router set.
