# Using Pyth Lazer on Cardano

This guide shows how to use the TypeScript library to verify Pyth Lazer price
feeds in Cardano transactions.

## Installation

```bash
cd lazer/contracts/cardano/typescript
npm install
```

## Quick Start

The most common use case is adding price verification to an existing Cardano
transaction. This works via the "withdraw-0 trick" — your transaction includes
a 0-ADA withdrawal from the Pyth price validator's staking credential, which
triggers the on-chain price verification logic without spending any UTxOs.

```typescript
import {
    MeshTxBuilder,
    deserializeAddress,
} from '@meshsdk/core'
import {
    initializeValidators,
    buildVerifyPriceTx,
    parsePriceMessage,
    parsePriceUpdate,
} from '@pyth-network/lazer-cardano'

// 1. Initialize the validators with the Pyth owner's public key hash
const ownerPkh = 'deadbeefdeadbeef...' // Pyth's owner PKH (provided by Pyth)
const {
    signerScript,
    priceScript,
    signerAddress,
    signerPolicyId,
    priceRewardAddress,
} = initializeValidators(ownerPkh)

// 2. Get a signed price message from the Pyth Lazer service
const signedPriceBytes: Uint8Array = /* from Pyth Lazer WebSocket/API */

// 3. (Optional) Parse the price data off-chain to read values
const msg = parsePriceMessage(signedPriceBytes)
const update = parsePriceUpdate(msg.payload)
console.log('Price:', update.feeds[0].price)
console.log('Feed ID:', update.feeds[0].feedId)

// 4. Look up the signer UTxO (the reference input with the signing policy)
//    This UTxO lives at the signer validator's script address and contains a
//    "signer" NFT with the signing policy as inline datum.
const signerRefUtxo = {
    txHash: '...', // transaction hash of the signer UTxO
    outputIndex: 0, // output index
}

// 5. Build the verification transaction
const provider = /* your Cardano provider (Blockfrost, Yaci, etc.) */
const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
})

buildVerifyPriceTx(
    txBuilder,
    priceScript.scriptCbor,
    priceRewardAddress,
    signerRefUtxo,
    [signedPriceBytes],     // can include multiple price messages
    0,                       // validFromSlot
    1000,                    // validToSlot
    'addr_test1...',         // your change address
)

// 6. Add your own transaction logic (inputs, outputs, etc.)
//    The price verification happens alongside your transaction.
//    For example, you might also be swapping tokens in a DEX:
// txBuilder.txIn(myUtxo.txHash, myUtxo.outputIndex, ...)
//           .txOut(dexAddress, [...])

// 7. Complete, sign, and submit
const unsignedTx = await txBuilder.complete()
const signedTx = wallet.signTx(unsignedTx)
const txHash = await provider.submitTx(signedTx)
```

## Concepts

### Two-Validator Architecture

The system uses two independent validators:

1. **`signer_nft`** — manages the signer NFT lifecycle (mint, update, burn).
   Parameterized by the owner's PKH.
2. **`pyth_price`** — handles price verification via the withdraw-0 trick.
   Parameterized by the signer NFT's policy ID.

This separation allows each component to be deployed and upgraded independently.

### The Withdraw-0 Trick

Cardano Plutus V3 validators can be triggered via staking withdrawals. The Pyth
price contract uses a 0-ADA withdrawal to run its price verification logic as
part of any transaction. This means:

- **No UTxO contention** — the signing policy is a reference input, not spent
- **Composable** — verification can be added to any transaction (DEX swaps,
  lending operations, etc.)
- **Multiple prices per tx** — a single withdrawal can verify many price feeds

The only prerequisite is that the price validator's staking credential must be
registered on-chain (a one-time setup operation).

### Signing Policy

The on-chain signing policy is a UTxO at the signer NFT validator's script
address that contains:

- A "signer" NFT (minted under the signer validator's policy ID)
- An inline datum of type `PythSigningPolicy` listing trusted Ed25519 public
  keys with their validity intervals

The price validator checks that each price message's signer is in this list and
that the transaction's validity range falls within the signer's validity window.

### Single NFT Pattern

Instead of burning and reminting the signer NFT when the signer set changes,
the NFT UTxO is simply spent and recreated with an updated datum. This is more
efficient and preserves the NFT identity. Use `buildUpdateSignersTx` for this.

### Validity Range

The transaction must set `invalidBefore` and `invalidHereafter` slots. The
on-chain contract checks that the signer's validity interval **includes** the
transaction's validity range. For signers with no expiry (NegInf to PosInf),
any validity range works.

## API Reference

### Parsing Functions

#### `parsePriceMessage(msg: Uint8Array): PriceMessage`

Parses a raw Pyth Lazer message (Solana envelope format) into its components:

```typescript
interface PriceMessage {
    signature: Uint8Array  // 64-byte Ed25519 signature
    pubkey: Uint8Array     // 32-byte Ed25519 public key
    payload: Uint8Array    // variable-length signed payload
}
```

Throws if the magic bytes are wrong, the message is truncated, or the payload
size doesn't match the declared length.

#### `parsePriceUpdate(payload: Uint8Array): PriceUpdate`

Parses the inner payload of a price message into structured data:

```typescript
interface PriceUpdate {
    timestamp: bigint   // microsecond timestamp
    channel: Channel    // RealTime, FixedRate50ms, FixedRate200ms, FixedRate1000ms
    feeds: Feed[]       // array of price feeds
}

interface Feed {
    feedId: number
    price?: bigint              // property 0: int64
    bestBidPrice?: bigint       // property 1: int64
    bestAskPrice?: bigint       // property 2: int64
    publisherCount?: number     // property 3: uint16
    exponent?: number           // property 4: int16
    confidence?: bigint         // property 5: uint64
    fundingRate?: bigint | null // property 6: optional int64
    fundingTimestamp?: bigint | null    // property 7: optional uint64
    fundingRateInterval?: bigint | null // property 8: optional uint64
    marketSession?: MarketSession      // property 9: int16 enum
}
```

### Validation Functions

#### `validateSignature(msg: PriceMessage): boolean`

Verifies the Ed25519 signature on a parsed price message. Uses `@noble/curves`
for the cryptographic verification.

#### `validatePriceMessage(msg, policy, currentTimeMs): boolean`

Validates a price message against a signing policy:
1. Checks that the message's pubkey matches a trusted signer
2. Checks that `currentTimeMs` falls within the signer's validity window
3. Verifies the Ed25519 signature

```typescript
const policy: SigningPolicy = [
    {
        pubkey: new Uint8Array([...]), // 32-byte Ed25519 public key
        validFrom: 0,
        validTo: Number.MAX_SAFE_INTEGER,
    },
]

const isValid = validatePriceMessage(msg, policy, Date.now())
```

#### `validateRawPriceMessage(rawMsg, policy, currentTimeMs): boolean`

Combines parsing and validation in one call. Returns `false` (instead of
throwing) on parse errors.

### Contract Functions

#### `getSignerNftScript(ownerPkh, networkId?)`

Loads the signer NFT blueprint, applies the owner parameter, and returns:

```typescript
const { scriptCbor, address, policyId } = getSignerNftScript(
    'deadbeef...', // owner's public key hash (hex)
    0              // 0 = testnet (default), 1 = mainnet
)
```

- `scriptCbor` — the compiled Plutus V3 script (CBOR hex)
- `address` — bech32 script address (where signer UTxOs live)
- `policyId` — the signer validator's policy ID / script hash

#### `getPythPriceScript(signerPolicyId, networkId?)`

Loads the price verification blueprint, applies the signer policy ID, and
returns:

```typescript
const { scriptCbor, policyId, rewardAddress } = getPythPriceScript(
    signerPolicyId, // from getSignerNftScript()
    0               // 0 = testnet (default), 1 = mainnet
)
```

- `scriptCbor` — the compiled Plutus V3 script (CBOR hex)
- `policyId` — the price validator's script hash
- `rewardAddress` — the staking address for the withdraw-0 trick

#### `initializeValidators(ownerPkh, networkId?)`

Convenience function that initializes both validators:

```typescript
const {
    signerScript,      // { scriptCbor, address, policyId }
    priceScript,       // { scriptCbor, policyId, rewardAddress }
    signerAddress,     // shortcut: signerScript.address
    signerPolicyId,    // shortcut: signerScript.policyId
    priceRewardAddress, // shortcut: priceScript.rewardAddress
} = initializeValidators('deadbeef...', 0)
```

#### `buildVerifyPriceTx(txBuilder, ...)`

The main function for dApp developers. Adds price verification to a
transaction:

```typescript
buildVerifyPriceTx(
    txBuilder,         // MeshTxBuilder instance
    priceScriptCbor,   // from getPythPriceScript() or initializeValidators()
    rewardAddress,     // from getPythPriceScript() or initializeValidators()
    signerRefUtxo,     // { txHash, outputIndex } of the signing policy UTxO
    signedPrices,      // Uint8Array[] — one or more signed price messages
    validFromSlot,     // transaction invalidBefore slot
    validToSlot,       // transaction invalidHereafter slot
    changeAddress,     // your wallet's change address
)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `txBuilder` | `MeshTxBuilder` | A fresh or in-progress transaction builder |
| `priceScriptCbor` | `string` | Compiled price script from `getPythPriceScript()` |
| `rewardAddress` | `string` | Staking address from `getPythPriceScript()` |
| `signerRefUtxo` | `{ txHash, outputIndex }` | The UTxO containing the signer NFT + signing policy datum |
| `signedPrices` | `Uint8Array[]` | Raw signed price messages from Pyth Lazer |
| `validFromSlot` | `number` | Transaction valid-from slot |
| `validToSlot` | `number` | Transaction valid-until slot |
| `changeAddress` | `string` | Change address for leftover ADA |

**Note:** You can chain additional operations on the returned `MeshTxBuilder`
before calling `.complete()`.

## Off-Chain Price Parsing

You can parse and inspect price data without submitting a transaction:

```typescript
import {
    parsePriceMessage,
    parsePriceUpdate,
    validateSignature,
    Channel,
} from '@pyth-network/lazer-cardano'

const raw: Uint8Array = /* signed price message bytes */

// Parse the envelope
const msg = parsePriceMessage(raw)
console.log('Signer pubkey:', Buffer.from(msg.pubkey).toString('hex'))

// Verify the signature off-chain
const sigValid = validateSignature(msg)
console.log('Signature valid:', sigValid)

// Parse the payload
const update = parsePriceUpdate(msg.payload)
console.log('Timestamp:', update.timestamp)
console.log('Channel:', Channel[update.channel])

for (const feed of update.feeds) {
    console.log(`Feed ${feed.feedId}:`)
    if (feed.price !== undefined) console.log(`  Price: ${feed.price}`)
    if (feed.exponent !== undefined) console.log(`  Exponent: ${feed.exponent}`)
    if (feed.confidence !== undefined) console.log(`  Confidence: ${feed.confidence}`)
    if (feed.bestBidPrice !== undefined) console.log(`  Best Bid: ${feed.bestBidPrice}`)
    if (feed.bestAskPrice !== undefined) console.log(`  Best Ask: ${feed.bestAskPrice}`)
}
```

## Troubleshooting

### "Staking credential not registered"

The withdraw-0 trick requires the price validator's staking credential to be
registered. Run `buildRegisterStakeTx` once before using `buildVerifyPriceTx`.

### "Reference input not found"

The `signerRefUtxo` must point to a UTxO at the signer script address that
contains the signer NFT (signer policy ID + token name `"signer"` / hex
`7369676e6572`). Query the signer script address and find the UTxO with this
token.

### Validity range errors

The transaction's `invalidBefore`/`invalidHereafter` must fall within the
signer's validity window. If the signer was created with `validFrom`/`validTo`
bounds, your transaction's validity range must be a subset of that interval.
For signers with no bounds (the default), any validity range works.
