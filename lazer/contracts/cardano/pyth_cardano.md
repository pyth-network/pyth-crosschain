# Pyth implementation on Cardano

This document describes the implementation of Pyth on the Cardano blockchain, focusing on how to manage approved signers and validate prices using UTxOs and tokens.

[Cardano](https://docs.cardano.org/) uses the [EUTxO](https://plutus.cardano.intersectmbo.org/resources/eutxo-paper.pdf) (Extended Unspent Transaction Output) model, which differs from account-based models used by other blockchains. In this model, data is stored in UTxOs, and transactions consume and produce UTxOs.

Additionally, Cardano scripts are stateless and do not maintain internal state. Instead, state is stored in "datums" attached to UTxOs. Validators (scripts) can access these datums when validating transactions.

Cardano supports multiple languages for writing smart contracts. This solution focuses on using [Aiken](https://aiken-lang.org/), a high-level language for writing Cardano smart contracts.

TODO: Determine whether we need to support other languages if we supply any on-chain library.

## Requirements
Simple contracts that can verify a Lazer payload and accept governance messages
* No Pythnet support required
* No "push" model support (no need to store price updates on-chain and provide a read layer)
* Multisig governance for signer set management
* Ability to rotate the signer set

# Design Overview
## Storing Trusted Signers
We will store trusted signers in a set of UTxOs owned by the pyth governance script. Each UTxO will contain a datum that holds a single signer's public key and an optional expiration time. Since we cannot prevent other users from sending arbitrary UTxOs to the governance script, we will include a token in each UTxO to identify valid signer entries. This token will be minted by the governance script and can only be created or destroyed by transactions it validates.

These UTxOs should include [inline datums](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0032) so users don't need to know the set of trusted signers in advance.

## Validating Prices
To validate a price update, Pyth users will need to:
1. Obtain a payload containing the signed price update. On Cardano, we use the "Solana Format" (Ed25519) [signature scheme](https://docs.pyth.network/price-feeds/pro/payload-reference#signature-schemes-and-binary-formats).
2. Look up the UTxOs owned by the governance script that contain the trusted signers. This can be done by querying for UTxOs owned by the governance script that also contain the signer token. E.g., [AddressesUtxosAsset](https://github.com/blockfrost/blockfrost-js/wiki/BlockFrostAPI#addressesutxosasset) in the Blockfrost API.
3. Reference these UTxOs in the transaction that includes the price update payload.
4. a. Use a provided library to validate the price update using the trusted signers obtained from the referenced UTxOs, or
   b. "Forward" the validation logic to an on-chain script that performs the validation.

### Forwarding Validation Logic On-Chain
One option for validating prices is to implement the validation logic in an on-chain script. This script would be invoked as part of the transaction that includes the price update payload. Note that reference inputs are not subject to validation, so we would need some way to invoke the validation logic. One approach is to use the ["withdraw 0 trick"](https://github.com/Anastasia-Labs/design-patterns/blob/main/stake-validator/STAKE-VALIDATOR-TRICK.md), where a staking script is used to implement the validation logic. 

A user who wants to validate a price would create a transaction that includes a 0 ADA withdrawal from a staking address controlled by the pyth governance script. The redeemer for this withdrawal would include the price update payload(s) to validate. Since the stake validator can see the entire transaction during its validation, it can find the referenced trusted signer UTxOs and validate the signed prices. 

This feels a bit convoluted and introduces complexity, but it would allow the validation logic to be executed on-chain without the use of a library. This has the side effect of making it easier for other observers to verify that the price was validated (by confirming that the transaction included the withdrawal from the staking address) without needing to see the client code.


TODO: Select an option for validating prices.

## Governance

### Multisig Governance
TODO

### Adding Trusted Signers
To add a new signer, the governance script will mint a new token and create a UTxO containing the trusted signer's public key in the datum. This UTxO will be locked by the governance script, ensuring that only authorized transactions can modify the set of approved signers.

### Invalidating Trusted Signers
To invalidate a signer, the governance script will burn the corresponding token, effectively removing the UTxO from the set of approved signers and causing any future transactions referencing that signer to fail validation.

### Modifying Trusted Signers
It is an open question whether we want to allow modification of existing signers (e.g., updating expiration time, or atomically replacing a signer entirely). Another approach is to:
1. Add a new signer with the existing public key and updated expiration time.
2. Invalidate the old signer by burning its token.
3. Add a completely new signer (if needed)

These could be done in separate transactions, which simplifies the validation logic by ensuring that each transaction only adds or removes a single signer. However, it would not support some features we might want, such as an atomic change to the set of signers. It may also be less efficient, as it requires multiple transactions to make changes.

### Modifying On-Chain Validation Logic
If we choose to implement on-chain validation logic, we would like a way to update this logic. This is complicated by the fact that Cardano scripts are immutable once deployed and so do not support an EVM-style upgrade mechanism.

TODO: Explore options for updating on-chain validation logic.
