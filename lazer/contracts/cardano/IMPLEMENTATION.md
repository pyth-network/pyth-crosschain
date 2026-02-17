# Pyth Lazer Cardano Integration — Implementation Overview

This document describes the architecture and implementation of the Pyth Lazer
price feed integration for Cardano, intended for code review.

## Overview

The integration enables Cardano dApps to consume Pyth Lazer price feeds with
full on-chain Ed25519 signature verification. It consists of two components:

1. **Aiken on-chain contracts** — two independent validators for signer
   management and price verification
2. **TypeScript off-chain library** — parses the Lazer wire format, validates
   signatures off-chain, and builds Cardano transactions that interact with the
   contracts

## Architecture

```
                 ┌──────────────────────┐
                 │  Pyth Lazer Server   │
                 │  (signed price data) │
                 └──────────┬───────────┘
                            │ signed messages (Solana envelope format)
                            ▼
               ┌────────────────────────┐
               │   TypeScript Library   │
               │  parse → validate →    │
               │  build Cardano tx      │
               └────────────┬───────────┘
                            │ submit transaction
                            ▼
               ┌────────────────────────┐
               │   Cardano Ledger       │
               │                        │
               │  ┌──────────────────┐  │
               │  │  signer_nft      │  │
               │  │  (mint/spend)    │  │
               │  └──────────────────┘  │
               │  ┌──────────────────┐  │
               │  │  pyth_price      │  │
               │  │  (withdraw)      │  │
               │  └──────────────────┘  │
               └────────────────────────┘
```

## Two-Validator Design

The system uses two independent validators that can be deployed and upgraded
separately:

1. **`signer_nft`** — manages the lifecycle of the signer NFT (mint, update
   via spend, burn). Parameterized by the `owner` PKH.
2. **`pyth_price`** — verifies price feeds via the withdraw-0 trick.
   Parameterized by the `signer_policy_id` (the policy ID of `signer_nft`).

This separation means:
- The price verification logic can be upgraded without touching signer management
- The signer NFT validator can be upgraded without redeploying the price validator
  (as long as the policy ID stays the same via parameter changes only)
- Each validator has a smaller, more focused codebase

## On-Chain Contracts (Aiken)

### File Structure

| File | Purpose |
|------|---------|
| `aiken/validators/signer_nft.ak` | Signer NFT validator: mint, spend, else |
| `aiken/validators/pyth_price.ak` | Price verification validator: withdraw, else |
| `aiken/lib/validate.ak` | Shared signature verification and message parsing |
| `aiken/plutus.json` | Compiled Plutus V3 blueprint (auto-generated) |

### `signer_nft` Validator

**Parameter:** `owner` (`VerificationKeyHash`) — the PKH authorized to manage signers.

#### `mint` handler — Signer NFT Lifecycle

**`AddSigner` (Constr 0)**

Mints exactly 1 token with asset name `"signer"`. The transaction must:

1. Be signed by the `owner`
2. Mint exactly 1 token with name `"signer"` and quantity 1
3. Send all outputs containing the signer token to the script's own address

**`RemoveSigner` (Constr 1)**

Burns exactly 1 signer token (quantity -1). Must be signed by the `owner`.

#### `spend` handler — Signer Set Updates

Allows updating the signing policy by spending the existing signer NFT UTxO
and recreating it with a new datum. This is the "single NFT pattern" — instead
of burning the old NFT and minting a new one, the NFT is simply moved to a new
output with updated data.

Checks:
1. Owner must sign the transaction
2. All outputs containing the signer token must:
   - Be at the same script address (NFT stays locked)
   - Have an inline datum that successfully parses as `PythSigningPolicy`

#### `else` handler

Always fails. Prevents the script from being used for other purposes.

### `pyth_price` Validator

**Parameter:** `signer_policy_id` (`ByteArray`) — the policy ID of the
`signer_nft` validator.

#### `withdraw` handler — Price Verification (Withdraw-0 Trick)

This is the core integration point. Cardano dApps verify Pyth prices by
including a 0-ADA withdrawal from this validator's staking credential.

The redeemer is:

```rust
type PriceRedeemer {
  signed_prices: List<ByteArray>,
}
```

The handler:

1. Finds a reference input containing an NFT with `signer_policy_id` and
   token name `"signer"`
2. Reads the `PythSigningPolicy` inline datum from that reference input
3. Validates every signed price message against the signing policy and the
   transaction's validity range

Each message is validated by `validate_raw_price_message` (in `validate.ak`):

1. **Parse** — extract signature (64B), pubkey (32B), and payload from the
   Solana-format envelope
2. **Signer check** — confirm the pubkey matches a trusted signer whose
   validity interval includes the transaction's validity range
3. **Signature check** — verify the Ed25519 signature over the payload

#### `else` handler

Always fails.

### On-Chain Data Types

```rust
PythSigningPolicy {
  trusted_signers: List<(VerificationKey, Interval<Int>)>
}

PriceMessage {
  signature: ByteArray,   // 64-byte Ed25519 signature
  pubkey: ByteArray,      // 32-byte Ed25519 public key
  payload: ByteArray      // variable-length signed payload
}
```

### Security Properties

- **Owner-only signer management**: Only the `owner` PKH can mint, update, or
  burn signer NFTs (enforced via `extra_signatories` check).
- **NFT locked at script address**: Both mint and spend handlers verify that
  all outputs containing the signer token are owned by the script itself.
- **Datum validation on update**: The spend handler ensures the output datum
  parses as a valid `PythSigningPolicy`, preventing corruption.
- **Ed25519 signature verification**: Every price message's signature is
  verified on-chain using Plutus V3 builtins.
- **Time-bounded signers**: Each signer has a validity interval. The contract
  checks that the transaction's validity range falls within this interval.
- **Reference inputs for policies**: The signing policy UTxO is consumed as a
  reference input (not spent), so it can be shared across many transactions
  concurrently without contention.

## Off-Chain TypeScript Library

### File Structure

| File | Purpose |
|------|---------|
| `typescript/src/types.ts` | Wire format constants, enums, interfaces |
| `typescript/src/parse.ts` | Solana envelope + Lazer payload parsers |
| `typescript/src/validate.ts` | Ed25519 signature verification (off-chain) |
| `typescript/src/contract.ts` | Cardano transaction builders using Mesh SDK |
| `typescript/src/index.ts` | Public API re-exports |

### Wire Format

The library parses the Pyth Lazer "Solana envelope" format:

```
Solana Envelope (variable length):
┌──────────┬────────────┬─────────┬──────────────┬─────────────┐
│ Magic 4B │ Sig 64B    │ PK 32B  │ Size 2B (LE) │ Payload ... │
│ b9011a82 │ Ed25519    │ Ed25519 │ uint16       │             │
└──────────┴────────────┴─────────┴──────────────┴─────────────┘

Payload (variable length):
┌──────────┬───────────┬─────────┬──────────┬──────────────┐
│ Magic 4B │ TS 8B     │ Ch 1B   │ #Feeds 1B│ Feeds ...    │
│ 75d3c793 │ uint64 LE │ uint8   │ uint8    │              │
└──────────┴───────────┴─────────┴──────────┴──────────────┘

Feed (variable length):
┌────────────┬─────────┬──────────────────┐
│ FeedID 4B  │ #Props  │ Properties ...   │
│ uint32 LE  │ uint8   │                  │
└────────────┴─────────┴──────────────────┘
```

### Transaction Builders (`contract.ts`)

All transaction construction uses `@meshsdk/core`'s `MeshTxBuilder`.

- **`getSignerNftScript(ownerPkh, networkId)`** — loads the `signer_nft`
  blueprint, applies the owner parameter, returns `{ scriptCbor, address,
  policyId }`.

- **`getPythPriceScript(signerPolicyId, networkId)`** — loads the `pyth_price`
  blueprint, applies the signer policy ID parameter, returns `{ scriptCbor,
  policyId, rewardAddress }`.

- **`initializeValidators(ownerPkh, networkId)`** — convenience function that
  initializes both validators and returns all needed values.

- **`buildSigningPolicyDatum(signers)`** — constructs the `PythSigningPolicy`
  Plutus datum.

- **`buildAddSignerTx(...)`** — mints a signer NFT with the signing policy datum.

- **`buildRemoveSignerTx(...)`** — spends the signer UTxO and burns the NFT.

- **`buildUpdateSignersTx(...)`** — spends the signer UTxO and recreates it
  with an updated datum (single NFT pattern).

- **`buildVerifyPriceTx(...)`** — the main integration point for dApps. Uses the
  `pyth_price` validator's withdraw-0 trick with a simplified redeemer containing
  only the signed prices list.

- **`buildRegisterStakeTx(...)`** — registers the price script's staking
  credential on-chain.

### Plutus Data Encoding

The Mesh SDK's `Data` type does not include `boolean`. Aiken's `Bool` is
encoded as algebraic data: `True = Constr(1, [])`, `False = Constr(0, [])`.

Aiken's `Interval` type uses three constructors for bound types:
- `NegInf = Constr(0, [])` — negative infinity
- `Finite(a) = Constr(1, [a])` — finite bound with value
- `PosInf = Constr(2, [])` — positive infinity

## Test Coverage

### Aiken Tests (17 total)

| Test | Validator | Type | Description |
|------|-----------|------|-------------|
| `validate_basic` | validate | unit | Parse + verify signature on known test vector |
| `validation_fails_with_wrong_signature` | validate | fail | Tampered payload byte rejected |
| `validate_bad_magic` | validate | unit | Wrong magic bytes → `None` |
| `validate_bad_length` | validate | unit | Truncated message → `None` |
| `validate_bad_payload_length_too_short` | validate | unit | Payload 1 byte short → `None` |
| `validate_bad_payload_length_too_long` | validate | unit | Payload 1 byte long → `None` |
| `mint_add_signer` | signer_nft | unit | Happy-path signer NFT mint |
| `mint_add_signer_wrong_owner` | signer_nft | fail | Non-owner cannot mint |
| `mint_signer_sent_to_wrong_address` | signer_nft | fail | NFT must go to script address |
| `mint_remove_signer` | signer_nft | unit | Happy-path signer NFT burn |
| `spend_update_signers` | signer_nft | unit | Happy-path: spend NFT, recreate with new datum |
| `spend_update_signers_wrong_owner` | signer_nft | fail | Must be signed by owner |
| `spend_update_signers_sent_elsewhere` | signer_nft | fail | NFT must return to script address |
| `spend_update_signers_bad_datum` | signer_nft | fail | Output datum must be valid PythSigningPolicy |
| `validate_single_price` | pyth_price | unit | Valid price verification |
| `validate_outdated_signer` | pyth_price | fail | Signer expired → validation fails |
| `validate_multiple_prices` | pyth_price | unit | Multiple prices in single tx |

### TypeScript Unit Tests (16 total)

**Parsing (8 tests):**
- Correct extraction of signature, pubkey, payload from test vector
- Rejection of bad magic, truncated messages, payload size mismatches
- Full payload parsing: timestamp, channel, feedId, price
- Rejection of extra bytes after payload

**Validation (8 tests):**
- Valid signature acceptance from known test vector
- Tampered payload rejection
- Policy-based validation: valid signer, unknown signer, expired signer,
  future signer
- Raw message validation (parse + validate in one call)

### Integration Tests (5, require Yaci devnet)

End-to-end flow: register staking address → mint signer → verify price →
update signers → remove signer.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@meshsdk/core` | Cardano transaction building, script parameterization |
| `@noble/curves` | Audited Ed25519 implementation (pure JS, no native deps) |
| `vitest` | Test runner (dev dependency) |
| `typescript` | Type checking (dev dependency) |
