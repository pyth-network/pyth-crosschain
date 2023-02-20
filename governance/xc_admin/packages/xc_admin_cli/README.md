# Pyth Cross-chain Governance Admin CLI Program

This program allows you to do a couple of features such as:

- accept-authority
- upgrade-program
- init-price
- parse-transaction
- approve
- propose-token-transfer
- activate

## Usage

Note:

- When using with Ledger, please enable [blind signing](https://www.ledger.com/academy/enable-blind-signing-why-when-and-how-to-stay-safe) in the Solana app settings. TLDR: When you enable blind signing, you enable your device to approve a smart contract transaction, even though it hasn’t been able to display full contract data to you. In other words, you’re agreeing to trust, instead of verify, the transaction. You still have to manually approve each transactions.
- Information about ledger derivation can be found [here](https://github.com/LedgerHQ/ledger-live-common/blob/master/docs/derivation.md).

### Example

To activate a transaction:
```

npx ts-node src/index.ts activate -t <TRANSACTION_HASH> -c <CLUSTER: [mainnet|devnet]> -v <VAULT_ADDRESS> -w <WALLET_SECRET_KEY_FILEPATH: [filepath|"ledger"]> -lda <LEDGER_DERIVATION_ACCOUNT> -ldc <LEDGER_DERIVATION_CHANGE>

```


