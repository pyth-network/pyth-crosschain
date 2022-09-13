# Pyth Multisig CLI Program

This program allows you to create/execute a multisig transaction that includes an instruction from wormhole for cross-chain governance.

## Installation

```
npm install
```

## Usage

Note: Node.js v17.15.0 or higher is required as it [introduces support for fetch API](https://nodejs.org/tr/blog/release/v17.5.0/).

### Create a multisig transaction

```
npm start -- create -c <CLUSTER> -v <VAULT_ADDRESS> -w <WALLET_SECRET_KEY_FILEPATH> -p <PAYLOAD>
```

Example:

```
npm start -- create -c devnet -v HezRVdwZmKpdKbksxFytKnHTQVztiTmL3GHdNadMFYui -w keys/key.json -p hello
```

### Execute a multisig transaction

```
npm start -- execute -c <CLUSTER> -v <VAULT_ADDRESS> -w <WALLET_SECRET_KEY_FILEPATH> -m <MESSAGE_SECRET_KEY_FILEPATH> -t <TX_ID> -u <RPC_URL>
```

Example:

```
npm start -- execute -c devnet -v HezRVdwZmKpdKbksxFytKnHTQVztiTmL3GHdNadMFYui -w keys/key.json -m keys/message.json -t GSC8r7Qsi9pc698fckaQgzHufG6LqVq3vZijyu5KsXLh -u https://wormhole-v2-testnet-api.certus.one/
```
