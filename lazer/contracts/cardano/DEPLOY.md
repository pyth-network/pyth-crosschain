# Pyth Lazer Cardano — Deployment & Administration

This guide covers deploying the Pyth Lazer oracle to a Cardano testnet and
managing the signing policy. For dApp developer integration, see [USAGE.md](USAGE.md).

## Prerequisites

- Node.js 18+
- A funded Cardano testnet wallet (preview or preprod)
- A [Blockfrost](https://blockfrost.io/) API key for the target network

## Configuration

The deploy script reads `WALLET_MNEMONIC` and `BLOCKFROST_KEY` from two
sources. Environment variables take precedence over the config file.

### Option A: Environment variables

```bash
export WALLET_MNEMONIC="word1 word2 ... word24"
export BLOCKFROST_KEY="previewAbcDef123..."
```

### Option B: Config file

Create `~/.config/pyth-lazer-cardano/config.json`:

```json
{
  "walletMnemonic": "word1 word2 ... word24",
  "blockfrostKey": "previewAbcDef123..."
}
```

You can mix both sources — for example, store `blockfrostKey` in the config
file and pass `WALLET_MNEMONIC` via the environment.

## Deploying

From the `typescript/` directory:

```bash
npm run deploy -- preview   # or preprod
```

The script performs these steps sequentially (each is idempotent):

1. Loads the wallet from the mnemonic
2. Derives validator scripts and addresses
3. Registers the price script's staking credential (skips if already registered)
4. Mints the signer NFT with an empty signing policy (skips if already minted)

On success it prints the deployment info that dApp developers need:

```
=== Deployment Complete ===
Network:              preview
Signer Policy ID:     ab12cd34...
Signer Address:       addr_test1...
Price Reward Address: stake_test1...
NFT UTxO:             txhash#0
```

### Generating a test wallet

```bash
npx tsx -e "import { MeshWallet } from '@meshsdk/core'; console.log(MeshWallet.brew())"
```

Fund it from the [Cardano testnet faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/).

## Admin API Reference

These functions are used for deployment and signer management. They require
the contract owner's signing key.

### `initializeValidators(ownerPkh, networkId?)`

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

### `buildRegisterStakeTx(txBuilder, rewardAddress, changeAddress)`

Registers the staking credential on-chain. Must be called once before
`buildVerifyPriceTx` can be used:

```typescript
buildRegisterStakeTx(txBuilder, priceRewardAddress, changeAddress)
```

### `buildMintSignerNftTx(txBuilder, ...)`

Mints the signer NFT and creates the signing policy UTxO:

```typescript
buildMintSignerNftTx(
    txBuilder,
    signerScriptCbor,
    signerAddress,
    signerPolicyId,
    ownerPkh,           // owner's pubkey hash (hex, NOT bech32 address)
    signers,             // array of { pubkey, validFrom?, validTo? }
)
```

If `validFrom`/`validTo` are omitted for a signer, it is valid for all time
(NegInf to PosInf).

### `buildUpdateSignersTx(txBuilder, ...)`

Updates the signer set by spending the NFT UTxO and recreating it with a new
datum. The NFT is not burned/reminted — it moves to a new output:

```typescript
buildUpdateSignersTx(
    txBuilder,
    signerScriptCbor,
    signerAddress,
    signerPolicyId,
    ownerPkh,
    signerUtxo,          // existing UTxO containing the signer NFT
    [                    // new signer set
        { pubkey: '...', validFrom: 0, validTo: 1000 },
        { pubkey: '...'},  // no bounds = valid forever
    ],
)
```

### `buildBurnSignerNftTx(txBuilder, ...)`

Burns the signer NFT and spends the signing policy UTxO. This permanently
removes the oracle from the chain:

```typescript
buildBurnSignerNftTx(
    txBuilder,
    signerScriptCbor,
    signerPolicyId,
    ownerPkh,
    signerUtxo,
)
```

## Manual Setup Flow

If you need more control than the deploy script provides, you can run each
step individually using the admin API.

### 1. Initialize the Validators

```typescript
import { MeshTxBuilder, MeshWallet, deserializeAddress } from '@meshsdk/core'
import {
    initializeValidators,
    buildRegisterStakeTx,
    buildMintSignerNftTx,
} from '@pyth-network/lazer-cardano'

const wallet = new MeshWallet({ ... })
const ownerAddr = await wallet.getChangeAddress()
const { pubKeyHash: ownerPkh } = deserializeAddress(ownerAddr)

const {
    signerScript,
    priceScript,
    signerAddress,
    signerPolicyId,
    priceRewardAddress,
} = initializeValidators(ownerPkh)
```

### 2. Register the Staking Credential

```typescript
const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider })
buildRegisterStakeTx(txBuilder, priceRewardAddress, ownerAddr)
txBuilder.selectUtxosFrom(walletUtxos)

const unsignedTx = await txBuilder.complete()
const signedTx = await wallet.signTx(unsignedTx)
await provider.submitTx(signedTx)
```

### 3. Mint the Signer NFT

```typescript
const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider })
buildMintSignerNftTx(
    txBuilder,
    signerScript.scriptCbor,
    signerAddress,
    signerPolicyId,
    ownerPkh,
    [{ pubkey: SIGNER_PUBKEY }],
)
txBuilder.changeAddress(ownerAddr).selectUtxosFrom(walletUtxos)
txBuilder.txInCollateral(
    walletUtxos[0].input.txHash,
    walletUtxos[0].input.outputIndex,
    walletUtxos[0].output.amount,
    walletUtxos[0].output.address,
)

const unsignedTx = await txBuilder.complete()
const signedTx = await wallet.signTx(unsignedTx)
await provider.submitTx(signedTx)
```

### 4. Update the Signer Set

```typescript
const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider })
buildUpdateSignersTx(
    txBuilder,
    signerScript.scriptCbor,
    signerAddress,
    signerPolicyId,
    ownerPkh,
    signerUtxo,
    [
        { pubkey: NEW_SIGNER_PUBKEY },
        { pubkey: ANOTHER_SIGNER, validFrom: 100, validTo: 5000 },
    ],
)
txBuilder.changeAddress(ownerAddr).selectUtxosFrom(walletUtxos)
txBuilder.txInCollateral(
    walletUtxos[0].input.txHash,
    walletUtxos[0].input.outputIndex,
    walletUtxos[0].output.amount,
    walletUtxos[0].output.address,
)

const unsignedTx = await txBuilder.complete()
const signedTx = await wallet.signTx(unsignedTx)
await provider.submitTx(signedTx)
```

### 5. Burn the Signer NFT (Teardown)

```typescript
const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider })
buildBurnSignerNftTx(
    txBuilder,
    signerScript.scriptCbor,
    signerPolicyId,
    ownerPkh,
    signerUtxo,
)
txBuilder.changeAddress(ownerAddr).selectUtxosFrom(walletUtxos)
txBuilder.txInCollateral(
    walletUtxos[0].input.txHash,
    walletUtxos[0].input.outputIndex,
    walletUtxos[0].output.amount,
    walletUtxos[0].output.address,
)

const unsignedTx = await txBuilder.complete()
const signedTx = await wallet.signTx(unsignedTx)
await provider.submitTx(signedTx)
```
