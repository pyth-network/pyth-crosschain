# Pyth Multisig CLI Program

This program allows you to create/execute a multisig transaction that includes an instruction from wormhole for cross-chain governance.

## Installation

```
npm install
```

## Usage

### Create a multisig transaction

```
npm start -- create -c <CLUSTER> -v <VAULT_ADDRESS> -w <WALLET_SECRET_KEY_FILEPATH> -p <PAYLOAD>
```

Example:

```
npm start -- create -c devnet -v HezRVdwZmKpdKbksxFytKnHTQVztiTmL3GHdNadMFYui -w key.json -p hello
```

### Execute a multisig transaction

```
npm start -- execute -c <CLUSTER> -e <EMITTER_ADDRESS> -w <WALLET_SECRET_KEY_FILEPATH> -m <MESSAGE_SECRET_KEY_FILEPATH> -t <TX_ID> -u <RPC_URL>
```

Example:

```
npm start -- execute -c devnet -e 5adbWTidzU8xQC1D8fjRceTWhfbV4Lp5CJ2xZnB7efxJ -w key.json -m message.json -t GSC8r7Qsi9pc698fckaQgzHufG6LqVq3vZijyu5KsXLh -u https://wormhole-v2-testnet-api.certus.one/
```
