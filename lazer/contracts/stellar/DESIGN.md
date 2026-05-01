# Pyth Lazer Stellar (Soroban) Verification Contract - Design Document

## Problem Statement

Pyth Lazer is a low-latency price oracle system that distributes signed price feed data to consumers across multiple blockchain ecosystems. On-chain verification contracts exist for EVM (Solidity), Solana (Anchor/Rust), Sui (Move), and Aptos (Move), but not for Stellar's Soroban smart contract platform. To serve the Stellar DeFi ecosystem, we need:

1. A **Pyth Lazer verification contract** that verifies Pyth Lazer LE-ECDSA signed price updates and exposes verified payload for on-chain consumption.
2. A **Wormhole governance executor contract** that verifies Wormhole VAAs and dispatches governance actions (updating trusted signers, upgrading contracts), following the same pattern used by the EVM Executor and Solana remote-executor contracts.

## Goals

1. Implement a Soroban smart contract that verifies Pyth Lazer LE-ECDSA signed price updates using secp256k1 key recovery and keccak256 hashing.
2. Implement a Wormhole executor/governance contract for Stellar that can verify Wormhole VAAs and execute arbitrary governance actions via cross-contract calls.
3. Maintain a set of trusted signers (compressed secp256k1 public keys) with expiry timestamps, managed via Wormhole governance.
4. Parse verified payloads into structured price feed data (timestamp, channel, feeds with properties).
5. Follow the same architectural patterns as existing Lazer contracts (especially the Sui contract for verification, and the EVM Executor / Solana remote-executor for Wormhole governance).
6. Support contract upgradeability.
7. Provide a companion SDK crate for off-chain integration.
8. Manage Soroban state rent proactively to prevent archival of critical contract data.

## Non-Goals

- Ed25519 signature support (the Sui and EVM contracts only support ECDSA; ed25519 is Solana-specific).
- Full Wormhole core bridge port (we only need VAA verification, not message publishing).

## Background: Existing Contract Architecture

### Wire Format (LE-ECDSA Message)

The Pyth Lazer protocol defines an `LeEcdsaMessage` envelope (used by Sui and Solana ECDSA paths):

```
[4 bytes]  magic (LE u32) = 0x4D475044 (LE_ECDSA_FORMAT_MAGIC = 1296547300)
[64 bytes] ECDSA signature (r: 32 bytes, s: 32 bytes)
[1 byte]   recovery_id
[2 bytes]  payload_length (LE u16)
[N bytes]  payload
```

The payload is signed with secp256k1 ECDSA over `keccak256(payload)`. The signer's public key is recovered from the signature and checked against the trusted signers list.

### Payload Format

```
[4 bytes]  payload_magic (LE u32) = 0x93DFF3F5 (PAYLOAD_MAGIC = 2479346549)
[8 bytes]  timestamp (LE u64, microseconds since epoch)
[1 byte]   channel (enum: 0=Invalid, 1=RealTime, 2=FixedRate50, etc.)
[1 byte]   num_feeds
For each feed:
  [4 bytes]  feed_id (LE u32)
  [1 byte]   num_properties
  For each property:
    [1 byte]   property_id (enum)
    [variable]  value (depends on property type)
```

### Common Contract Components

All existing Lazer contracts share these components:
1. **Storage/State**: Trusted signers list (pubkey + expiry), admin/authority
2. **Admin functions**: initialize, update_trusted_signer (add/update/remove by setting expiry=0)
3. **Verification function**: Accepts raw update bytes, verifies signature against trusted signers, returns verified payload

### Wormhole Governance Pattern Across Ecosystems

The Pyth ecosystem uses Wormhole VAAs to deliver governance instructions across chains. The pattern varies by ecosystem:

**EVM (Executor.sol)**: A standalone `Executor` contract verifies Wormhole VAAs via the Wormhole core bridge (`IWormhole.parseAndVerifyVM`). The VAA payload contains a serialized `GovernanceInstruction` with the PTGM (Pyth Governance Message) format: magic `0x5054474d` ("PTGM"), module, action, target chain, executor address, call address, value, and calldata. The executor dispatches an arbitrary EVM call to the target contract. This enables any governance action (updating signers, upgrading contracts, etc.) without modifying the executor itself.

**Solana (remote-executor)**: Similarly, a standalone `remote_executor` program processes posted Wormhole VAAs. The VAA payload contains an `ExecutorPayload` with a list of instructions (program ID, accounts, data). The executor invokes each instruction via CPI, signing with a PDA derived from the emitter address. This enables arbitrary Solana program calls governed by Wormhole.

**Sui (governance.move + actions.move)**: Wormhole governance is integrated directly into the Lazer contract. The `governance` module validates incoming VAAs (emitter chain, emitter address, sequence number) and parses the PTGM header. The `actions` module implements specific governance actions: `upgrade` (contract upgrade via UpgradeCap) and `update_trusted_signer`. The Sui Wormhole SDK is vendored and provides `vaa::VAA` for VAA parsing.

### Common PTGM Format

All governance messages use the PTGM (Pyth Governance Message) header:
```
[4 bytes]  magic = "PTGM" (0x5054474d)
[1 byte]   module (3 = Lazer)
[1 byte]   action (0 = upgrade contract, 1 = update trusted signer)
[2 bytes]  target_chain_id (BE u16)
[variable] action-specific payload
```

For `update_trusted_signer` (action=1):
```
[33 bytes] compressed secp256k1 public key
[8 bytes]  expires_at (BE u64, 0 = remove)
```

For `upgrade_contract` (action=0):
```
[8 bytes]  version (BE u64)
[32 bytes] wasm digest/hash
```

## Proposed Approach

### Technology Choice

- **Language**: Rust (compiled to WASM via Soroban SDK)
- **SDK**: `soroban-sdk` (the official Stellar smart contract SDK)
- **Crypto**: Soroban native host functions:
  - `env.crypto().keccak256()` for hashing (both Lazer payloads and VAA body hashing)
  - `env.crypto().secp256k1_recover()` for recovering public keys (both Lazer signer verification and Wormhole guardian signature verification)
- **Testing**: Soroban SDK's built-in local testing mode (`soroban-sdk` with `testutils` feature)
- **Deployment tool**: `stellar` CLI

### Architecture Overview

The system consists of two Soroban contracts:

1. **Pyth Lazer contract** (`pyth-lazer-stellar`): Verifies Lazer price update signatures and manages trusted signers. Admin functions are callable by the governance executor.
2. **Wormhole executor contract** (`wormhole-executor-stellar`): Verifies Wormhole VAAs, parses PTGM governance payloads, and dispatches calls to the Lazer contract (or any other target contract). This is the Stellar equivalent of the EVM `Executor.sol` and Solana `remote-executor`.

The governance flow:
```
Wormhole VAA (from guardians)
  → Wormhole Executor contract (verify VAA, parse PTGM)
    → Cross-contract call to Lazer contract (update_trusted_signer, upgrade, etc.)
```

### Contract 1: Wormhole Executor

#### 1a. VAA Verification

Since there is no existing Wormhole core bridge deployed on Stellar, the executor contract must verify Wormhole VAAs directly. This involves:

1. Parsing the VAA binary format (version, guardian set index, signatures, body)
2. Computing `keccak256(keccak256(body))` (the Wormhole double-hash)
3. For each guardian signature, using `secp256k1_recover` to recover the signer's public key
4. Checking recovered keys against the stored guardian set
5. Verifying quorum (2/3 + 1 of guardians signed)

The guardian set (list of guardian public keys) is stored in the contract and updated via guardian set upgrade VAAs (a self-referential governance mechanism built into Wormhole).

#### 1b. Wormhole VAA Format

```
[1 byte]   version (must be 1)
[4 bytes]  guardian_set_index (BE u32)
[1 byte]   num_signatures
For each signature:
  [1 byte]   guardian_index
  [64 bytes] ECDSA signature (r: 32, s: 32)
  [1 byte]   recovery_id
Body:
  [4 bytes]  timestamp (BE u32)
  [4 bytes]  nonce (BE u32)
  [2 bytes]  emitter_chain (BE u16)
  [32 bytes] emitter_address
  [8 bytes]  sequence (BE u64)
  [1 byte]   consistency_level
  [N bytes]  payload
```

#### 1c. Executor State

```
Storage (persistent):
  - owner_emitter_chain_id: u16         // authorized governance emitter chain
  - owner_emitter_address: BytesN<32>   // authorized governance emitter address
  - last_executed_sequence: u64         // replay protection
  - chain_id: u16                       // this chain's Wormhole chain ID
  - guardian_set: Vec<BytesN<20>>       // current guardian set (ethereum addresses)
  - guardian_set_index: u32             // current guardian set index
```

#### 1d. Executor Functions

- `initialize(env, wormhole_chain_id, owner_emitter_chain_id, owner_emitter_address, initial_guardian_set, guardian_set_index)` - One-time setup
- `execute_governance_action(env, vaa_bytes: Bytes)` - Verify VAA, parse PTGM, dispatch cross-contract call
- `update_guardian_set(env, vaa_bytes: Bytes)` - Process guardian set upgrade VAA (self-governance)

The execution flow:
1. Parse and verify the Wormhole VAA (guardian signatures, quorum)
2. Check emitter chain/address matches the authorized governance source
3. Check sequence > last_executed_sequence (replay protection)
4. Parse the PTGM header from the VAA payload
5. Based on the PTGM module and action, dispatch a cross-contract call to the appropriate target (e.g., Lazer contract's `update_trusted_signer` or `upgrade`)

#### 1e. Dispatch Model

Following the EVM Executor pattern, the PTGM payload includes the target contract address and action-specific calldata. The executor makes a cross-contract `env.invoke_contract()` call to the target. The target contract must check that the caller is the authorized executor address.

### Contract 2: Pyth Lazer Verification

#### 2a. State Management

```
Storage (persistent):
  - executor: Address                       // authorized Wormhole executor contract address
  - trusted_signers: Map<BytesN<33>, u64>   // compressed secp256k1 pubkey -> expires_at (unix seconds)
```

Note: The `admin` field from the original design is replaced by `executor` - the Wormhole executor contract is the authority for governance operations. For initial setup, an `initialize` function with a one-time admin is still needed. Fee collection has been removed as Pyth is moving away from on-chain fees.

#### 2b. Contract Functions

**Governance functions** (require `executor` authorization):

- `update_trusted_signer(env, pubkey: BytesN<33>, expires_at: u64)` - Add/update/remove signer (expires_at=0 removes)
- `upgrade(env, new_wasm_hash: BytesN<32>)` - Upgrade the contract WASM

**Setup function** (one-time):

- `initialize(env, executor: Address)` - One-time setup, stores initial config

**Verification function** (public):

- `verify_update(env, update: Bytes) -> Bytes` - Verifies the LE-ECDSA envelope signature, checks signer is trusted and not expired, returns the raw payload bytes

The verification flow:
1. Parse the LE-ECDSA envelope: magic, signature (64 bytes), recovery_id (1 byte), payload_length, payload
2. Compute `hash = keccak256(payload)`
3. Recover public key: `recovered_pubkey = secp256k1_recover(hash, signature, recovery_id)`
4. Look up the recovered compressed public key in trusted signers storage
5. Check `current_timestamp < expires_at` for the matched signer
6. Return the verified payload bytes

#### 2c. Upgradeability

Soroban contracts are upgradeable by default. The governance executor can trigger an upgrade by calling `upgrade(new_wasm_hash)` which invokes `env.deployer().update_current_contract_wasm(new_wasm_hash)`.

### Project Structure

```
lazer/contracts/stellar/
  Cargo.toml                          # workspace root
  contracts/
    pyth-lazer-stellar/
      Cargo.toml
      src/
        lib.rs                        # contract entry point, public functions
        state.rs                      # storage keys, read/write helpers
        verify.rs                     # signature verification logic
        error.rs                      # custom error enum
        test.rs                       # unit tests
    wormhole-executor-stellar/
      Cargo.toml
      src/
        lib.rs                        # executor contract entry, dispatch logic
        vaa.rs                        # Wormhole VAA parsing and verification
        guardian.rs                   # guardian set management
        governance.rs                 # PTGM header parsing
        error.rs                      # custom error enum
        test.rs                       # unit tests
  Makefile                            # build, test, deploy scripts
  README.md
```

### Key Design Decisions

**1. LE-ECDSA format (not EVM format)**

The Sui contract uses the LE-ECDSA format (`LeEcdsaMessage` with magic `0x4D475044`). We will use the same format for Stellar since:
- LE encoding is natural for WASM/Rust
- The Sui contract is the closest reference implementation
- keccak256 + secp256k1 are natively supported as Soroban host functions

**2. Compressed public keys (33 bytes)**

Following the Sui contract convention, trusted signers are stored as compressed secp256k1 public keys (33 bytes). Soroban's `secp256k1_recover` returns uncompressed 65-byte keys, so the contract applies SEC-1 point compression (parity byte + x-coordinate) before comparison. This is a trivial operation (~few hundred instructions) documented in the "secp256k1_recover: Output Format and Key Conversion" section above.

**3. Wormhole governance via executor contract**

Following the EVM and Solana patterns, we implement a standalone Wormhole executor contract that verifies VAAs and dispatches governance calls. This is preferred over the simpler admin authority approach because:
- It matches the production governance model used by EVM and Solana deployments
- It enables trustless governance from the Pyth governance multisig via Wormhole
- The executor is reusable for other Pyth contracts deployed on Stellar in the future
- The Lazer contract doesn't need to know about Wormhole internals

**4. Inline VAA verification (no core bridge dependency)**

Since there is no existing Wormhole core bridge on Stellar, the executor contract verifies Wormhole VAAs directly using Soroban's native `secp256k1_recover` and `keccak256`. This is similar to how the Sui Lazer contract vendors the Wormhole SDK. The tradeoff is more code in the executor, but no external dependency. If a Wormhole core bridge is later deployed on Stellar, the executor could be updated to delegate verification to it.

**5. No on-chain fee collection**

Pyth is moving away from on-chain verification fees. The Stellar contract will not charge per-verification fees, simplifying the contract interface and removing the need for treasury management and token transfer logic.

**6. Return raw payload bytes**

The `verify_update` function returns the raw verified payload bytes. A separate SDK/library (either on-chain or off-chain) can parse the payload into structured data. This follows the EVM contract pattern where `verifyUpdate` returns `(bytes payload, address signer)`.

### Soroban State Rent Model

Soroban uses a **rent-based state model** to prevent unbounded ledger growth. Every piece of stored data has a TTL (time-to-live) measured in ledgers (~5 seconds per ledger). Understanding and managing rent is critical for these contracts.

#### How Rent Works

Each ledger entry (contract data, contract code) has a `liveUntilLedger` field. When the current ledger exceeds this value, the entry's fate depends on its storage type:

| Storage Type | On Expiry | Restoration | Use Case |
|---|---|---|---|
| **Persistent** | Archived (moved off-chain), NOT deleted | Restorable via `RestoreFootprintOp` or auto-restore (Protocol 23+) | Financially meaningful data: trusted signers, guardian sets |
| **Instance** | Archived with contract instance | Same as persistent | Contract configuration, executor settings |
| **Temporary** | Permanently deleted | Cannot be restored | Ephemeral data (not used by these contracts) |

**Key TTL limits (current mainnet):**

| Parameter | Value | Approximate Time |
|---|---|---|
| `maxEntryTTL` | 6,312,000 ledgers | ~1 year |
| `min_persistent_entry_ttl` | 4,096 ledgers | ~5.7 hours |
| Ledger close time | ~5 seconds | — |

**Rent cost** is dynamic, computed as: `size_bytes × ledgers × write_fee_per_1kb / (1024 × rentRateDenominator)`. The `write_fee_per_1kb` scales with total ledger size, and the `persistentRentRateDenominator` is currently 2,103. In practice, average Soroban transaction fees (including rent) are ~0.02 XLM (~$0.003).

#### Rent Strategy for Pyth Contracts

**Contract instance and code TTL:**
- Both contracts must extend their own instance and code TTLs proactively on every user-facing call (`verify_update`, `execute_governance_action`).
- Use threshold-based extension: `env.storage().instance().extend_ttl(THRESHOLD, EXTEND_TO)` where `THRESHOLD` = ~100,000 ledgers (~6 days) and `EXTEND_TO` = ~500,000 ledgers (~29 days). This way the TTL is refreshed only when it drops below the threshold, amortizing the rent cost across many transactions.

**Persistent data (trusted signers, guardian set):**
- Extend TTL on each write (governance updates) and each read (`verify_update` extends signer entry TTL, `execute_governance_action` extends guardian set TTL).
- Use the same threshold pattern: `env.storage().persistent().extend_ttl(&key, THRESHOLD, EXTEND_TO)`.

**Fallback for inactive periods:**
- If the contracts go unused for extended periods, entries may approach expiry. An external cron job or admin script using `stellar contract extend --id <CONTRACT_ID> --ledgers-to-extend <N>` can extend TTLs without calling contract functions.
- Protocol 23 auto-restoration means that even if entries are archived, the next transaction that touches them will automatically restore them (the caller pays the restoration fee). This is a safety net, not the primary strategy.

**Cost estimation:**
- Guardian set (~19 × 20-byte addresses + overhead ≈ ~500 bytes): extending for 500,000 ledgers costs a few hundred stroops (~negligible).
- Trusted signers (each 33-byte key + 8-byte expiry ≈ ~50 bytes per signer): similarly negligible per extension.
- Use `simulateTransaction` RPC to get precise rent costs before deployment.

### Resource Limits and Gas Analysis for VAA Verification

Wormhole VAA verification requires 13+ `secp256k1_recover` calls (2/3 + 1 of the 19 mainnet guardians). This section analyzes whether this fits within Soroban's per-transaction resource limits.

#### Per-Transaction Resource Limits (Current Mainnet)

| Resource | Limit |
|---|---|
| CPU Instructions | 100,000,000 (100M) |
| Memory (RAM) | 40 MB |
| Transaction Size | 132,096 bytes (~129 KB) |
| Read Entries (footprint) | 100 entries |
| Write Entries | 50 entries |
| Read Bytes | 200,000 bytes |
| Write Bytes | 132,096 bytes |

#### Cost Breakdown for VAA Verification (13 Signatures)

| Operation | Per-Call Cost | Count | Total |
|---|---|---|---|
| `secp256k1_recover` | ~2,312,848 instructions | 13 | ~30,067,024 |
| `keccak256` (body hashing) | ~few thousand | 2-14 | ~100,000 |
| WASM execution (parsing, loops) | — | — | ~5M-15M (est.) |
| VM instantiation overhead | — | 1 | ~10M-30M (est.) |
| **Estimated total** | | | **~45M-75M instructions** |

**Conclusion: VAA verification fits within the 100M instruction budget.** The 13 `secp256k1_recover` calls alone consume ~30M instructions (30% of budget), leaving ample room for parsing, WASM overhead, and cross-contract calls. Protocol 23 improvements (WASM module caching via CAP-0054/0055/0056) further reduce VM instantiation overhead.

**Note:** SLP-0004 proposes increasing the per-transaction limit to 400M instructions, which would provide even more headroom. However, the current 100M limit is sufficient.

**Risk mitigation:**
- Use `simulateTransaction` on testnet with a prototype to get exact resource consumption.
- If a specific edge case exceeds 100M (e.g., very large VAA + complex dispatch), the contract could accept pre-parsed guardian signatures, but this is unlikely to be necessary.

### secp256k1_recover: Output Format and Key Conversion

Soroban's `secp256k1_recover` returns a **65-byte uncompressed SEC-1 public key** (`BytesN<65>`), formatted as `0x04 || x (32 bytes) || y (32 bytes)`. The function signature is:

```rust
pub fn secp256k1_recover(
    &self,
    message_digest: &Hash<32>,   // must be output of a hash function
    signature: &BytesN<64>,       // r (32 bytes) || s (32 bytes)
    recovery_id: u32,             // valid range: 0-3
) -> BytesN<65>
```

The Soroban SDK does **not** provide a built-in compressed/uncompressed key conversion. This differs from Sui's `secp256k1_ecrecover`, which returns compressed (33-byte) keys directly.

**Solution for Lazer signer verification (compressed key comparison):**

Since trusted signers are stored as 33-byte compressed keys (matching the governance PTGM format and other Pyth contracts), the contract must compress the recovered key before lookup. Point compression is straightforward and cheap:

```rust
fn compress_pubkey(uncompressed: &BytesN<65>) -> BytesN<33> {
    // uncompressed format: 0x04 || x (32 bytes) || y (32 bytes)
    let mut compressed = [0u8; 33];
    // Parity prefix: 0x02 if y is even, 0x03 if y is odd
    compressed[0] = if uncompressed.get(64) & 1 == 0 { 0x02 } else { 0x03 };
    // Copy x-coordinate (bytes 1..33 of the uncompressed key)
    compressed[1..33].copy_from_slice(&uncompressed[1..33]);
    BytesN::from_array(env, &compressed)
}
```

This adds negligible cost (a few hundred instructions) compared to the `secp256k1_recover` call itself (~2.3M instructions).

**Solution for Wormhole guardian verification (Ethereum address derivation):**

Wormhole guardians are identified by 20-byte Ethereum addresses, derived from the uncompressed public key as: `keccak256(x || y)[12..32]` (last 20 bytes of the keccak256 hash of the 64-byte x,y coordinates, excluding the `0x04` prefix). This is the standard Ethereum address derivation:

```rust
fn eth_address_from_pubkey(env: &Env, uncompressed: &BytesN<65>) -> BytesN<20> {
    // Hash the 64-byte raw key (skip the 0x04 prefix)
    let raw_key: Bytes = uncompressed.slice(1..65);
    let hash = env.crypto().keccak256(&raw_key);
    // Ethereum address = last 20 bytes of keccak256 hash
    BytesN::from_array(env, &hash.to_array()[12..32])
}
```

Both Soroban host functions (`keccak256` and `secp256k1_recover`) are available natively, so no external crates are needed for cryptographic operations.

**Note on the `Hash<32>` type:** The public `Crypto::secp256k1_recover` wraps the digest in `Hash<32>` (not raw `BytesN<32>`) to provide type-level assurance that the input has been hashed. The contract must pass the output of `env.crypto().keccak256()` directly, which already returns the correct type.

### Remaining Risks and Open Questions

1. **Contract size limit**: Soroban contracts have a 64KB WASM size limit. The executor contract includes VAA verification logic which adds code size. Need to verify both contracts fit within limits after compilation with optimizations.

2. **Wormhole chain ID for Stellar**: Need to determine the correct Wormhole chain ID for Stellar. This may require coordination with the Wormhole team if Stellar is not yet registered.

3. **Guardian set bootstrap**: The initial guardian set must be hardcoded or provided at initialization time. Need to obtain the current Wormhole mainnet guardian set for deployment.

4. **Cross-contract call authorization**: The Lazer contract must verify that governance calls come from the authorized executor. In Soroban, this is done via `env.require_auth()` where the executor's contract address is the authorized caller.

## Key Files and Directories

- **New directory**: `lazer/contracts/stellar/` in pyth-crosschain repo
- **Reference implementations**:
  - `lazer/contracts/sui/` (closest reference for Lazer verification - LE-ECDSA, secp256k1, includes Wormhole governance)
  - `lazer/contracts/evm/` (EVM format reference, includes payload parsing)
  - `target_chains/ethereum/contracts/contracts/executor/Executor.sol` (EVM Wormhole executor - governance dispatch pattern)
  - `governance/remote_executor/programs/remote-executor/` (Solana Wormhole executor - CPI dispatch pattern)
  - `pyth-lazer/contracts/solana/` (Solana Lazer format reference)
- **Protocol definitions**: `pyth-lazer/sdk/rust/protocol/src/message.rs` (wire formats), `pyth-lazer/sdk/rust/protocol/src/payload.rs` (payload format)
- **Target branch**: `stellar` branch of pyth-crosschain

## Implementation Plan

### Task 1: Wormhole executor - VAA verification and guardian set management

Set up the `wormhole-executor-stellar` project under `lazer/contracts/stellar/contracts/`. Implement Wormhole VAA binary parsing, guardian signature verification using `secp256k1_recover` + `keccak256`, quorum checking, and guardian set storage/updates. Include unit tests with real VAA test vectors.

### Task 2: Wormhole executor - PTGM parsing and governance dispatch

Add PTGM header parsing (magic, module, action, chain ID), emitter validation, sequence-based replay protection, and cross-contract call dispatch to target contracts. Include unit tests for governance message parsing and dispatch.

### Task 3: Pyth Lazer contract - scaffolding, admin, and signature verification

Set up the `pyth-lazer-stellar` project. Implement initialization, trusted signer management (with executor authorization), and the core `verify_update` function (LE-ECDSA envelope parsing, keccak256 hashing, secp256k1 key recovery, signer lookup). Include proactive rent management (TTL extension on reads/writes). Include unit tests for all functions.

### Task 4: Payload parsing

Implement payload parsing functions that decode the verified payload bytes into structured data (timestamp, channel, feeds with their properties). This mirrors PythLazerLib.sol and the Sui update.move/feed.move modules. Include typed return structs and accessor functions.

### Task 5: Integration tests and documentation

Write integration tests using the Soroban test framework that test the full governance flow: deploy both contracts, initialize, deliver a Wormhole VAA to add a trusted signer via the executor, then verify a Lazer price update. Create a README with build/test/deploy instructions and add CI configuration.
