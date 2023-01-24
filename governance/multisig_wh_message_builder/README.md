# Pyth Governance Multisig CLI Program

This program allows you to create/execute a multisig transaction that includes an instruction from wormhole for cross-chain governance.

## Installation

```
npm install
```

## Usage

Note:

- Node.js v17.15.0 or higher is required as it [introduces support for fetch API](https://nodejs.org/tr/blog/release/v17.5.0/).
- Node 19 doesn't work!
- When using with Ledger, please enable [blind signing](https://www.ledger.com/academy/enable-blind-signing-why-when-and-how-to-stay-safe) in the Solana app settings. TLDR: When you enable blind signing, you enable your device to approve a smart contract transaction, even though it hasn’t been able to display full contract data to you. In other words, you’re agreeing to trust, instead of verify, the transaction. You still have to manually approve each transactions.
- Information about ledger derivation can be found [here](https://github.com/LedgerHQ/ledger-live-common/blob/master/docs/derivation.md).

### Create a multisig transaction

```
npm start -- create -c <CLUSTER: [mainnet|devnet]> -l -lda <LEDGER_DERIVATION_ACCOUNT> -ldc <LEDGER_DERIVATION_CHANGE> -w <WALLET_SECRET_KEY_FILEPATH> -p <PAYLOAD>
```

To use ledger with default derivation account and change:

```
npm start -- create -c devnet -l -p hello
```

To use ledger with custom derivation account and/or change:

```
npm start -- create -c devnet -l -lda 0 -p hello

npm start -- create -c devnet -l -lda 0 -ldc 1 -p hello
```

To use hot wallet :

```
npm start -- create -c devnet -w keys/key.json -p hello
```

---

### Execute a multisig transaction

```
npm start -- execute -c <CLUSTER: [mainnet|devnet]> -w <WALLET_SECRET_KEY_FILEPATH> -t <TX_ID>
```

To use ledger with default derivation account and change:

```
npm start -- execute -c devnet -l -m keys/message.json -t GSC8r7Qsi9pc698fckaQgzHufG6LqVq3vZijyu5KsXLh
```

To use ledger with custom derivation account and/or change:

```
npm start -- execute -c devnet -l -lda 0 -m keys/message.json -t GSC8r7Qsi9pc698fckaQgzHufG6LqVq3vZijyu5KsXLh

npm start -- execute -c devnet -l -lda 0 -ldc 1 -m keys/message.json -t GSC8r7Qsi9pc698fckaQgzHufG6LqVq3vZijyu5KsXLh
```

Example:

```
npm start -- execute -c devnet -w keys/key.json -m keys/message.json -t GSC8r7Qsi9pc698fckaQgzHufG6LqVq3vZijyu5KsXLh
```

https://github.com/LedgerHQ/ledger-live/wiki/LLC:derivation
