# Pyth CosmWasm

This directory contains the Pyth contract for CosmWasm and utilities to deploy it on CosmWasm chains.

## Deployment

Deploying the CosmWasm contract has two steps:

1. Upload the code. This step will give you a code id.
2. Either create a new contract or migrate an existing one:
   1. Create a new contract that has an address with a code id as its program.
   2. Migrating an existing contract code id to the new code id.

This directory includes a script to perform both steps. Read below for the details.

### Uploading the code

First, build the contracts within [the current directory](./):

```sh
bash build.sh
```

This command will build and save the Pyth contract in the `artifacts` directory.

Then, to deploy the Pyth contract (`pyth_cosmwasm.wasm`), run the following command in the `tools` directory:

```sh
npm ci # Do it only once to install the required packages
npm run deploy-pyth -- --network testnet --artifact ../artifacts/pyth_cosmwasm.wasm --mnemonic "..."

npm run deploy-pyth -- --network injective_testnet --artifact ../artifacts/pyth_cosmwasm-aarch64.wasm --mnemonic "prison glue section frog author urge disease honey vocal grow speak negative"

node ./lib/deploy-pyth-bridge.js --network injective_testnet --artifact ../artifacts/pyth_cosmwasm-aarch64.wasm --mnemonic "prison glue section frog author urge disease honey vocal grow speak negative"

npm run deploy-pyth -- --network injective_testnet --code-id 291 --mnemonic "prison glue section frog author urge disease honey vocal grow speak negative" --instantiate

npm run deploy-pyth -- --network injective_testnet --code-id 292 --mnemonic "prison glue section frog author urge disease honey vocal grow speak negative" --migrate --contract "inj19ledet2rkvtj3zdr8l88eaqq7qmv47p8tlg2qu"

```

If successful, this command will print something along the lines of:

```sh
Storing WASM: ../artifacts/pyth_cosmwasm.wasm (367689 bytes)
Deploy fee:  88446uluna
Code ID:  2435
```

If you do not pass any additional arguments to the script, it will only upload the code and return the code id. If you want to create a
new contract or upgrade an existing contract you should pass more arguments that are described below.

### Instantiating new contract

If you want to instantiate a new contract after your deployment, pass `--instantiate` to the above command.
This command will upload the code and instantiates a new Pyth contract with the resulting code id:

```sh
npm run deploy-pyth -- --network testnet --artifact ../artifacts/pyth_cosmwasm.wasm --mnemonic "..." --instantiate
```

If successful, the output should look like so:

```
Storing WASM: ../artifacts/pyth_cosmwasm.wasm (183749 bytes)
Deploy fee:  44682uluna
Code ID:  53199
Instantiating a contract
Sleeping for 10 seconds for store transaction to finalize.
Instantiated Pyth at terra123456789yelw23uh22nadqlyjvtl7s5527er97 (0x0000000000000000000000001234567896267ee5479752a7d683e49317ff4294)
Deployed Pyth contract at terra123456789yelw23uh22nadqlyjvtl7s5527er97
```

### Migrating existing contract

If you want to upgrade an existing contract pass `--migrate --contract terra123456xyzqwe..` to the above command.
This command will upload the code, and with the resulting code id, will migrate the existing contract to the new one:

```sh
npm run deploy-pyth -- --network testnet --artifact ../artifacts/pyth_cosmwasm.wasm --mnemonic "..." --migrate --contract "terra123..."
```

If successful, the output should look like so:

```
Storing WASM: ../artifacts/pyth_cosmwasm.wasm (183749 bytes)
Deploy fee:  44682uluna
Code ID:  53227
Sleeping for 10 seconds for store transaction to finalize.
Migrating contract terra1rhjej5gkyelw23uh22nadqlyjvtl7s5527er97 to 53227
Contract terra1rhjej5gkyelw23uh22nadqlyjvtl7s5527er97 code_id successfully updated to 53227
```

### Common Errors

While running the instantiation/migration commands you might get the following errors:

- Gateway timeout: This error means that the request timed out. It is good to double check with terra finder as sometimes transactions succeed despite being timed out.
- Account sequence mismatch: Transactions from an account should have an increasing sequence number. This error happens when a transaction from the same sender is not fully synchronized with the terra RPC and an old sequence number is used. This is likely to happen because the deploy script sends two transactions: one to submit the code, and one to do the instantiation/migration.

You can rerun your command if you encounter any of the above errors. If an error occurs after the new code is uploaded, you can avoid re-uploading the code and use the uploaded code for instantiation/migration. You can use the printed code id in the logs
by passing `--code-id <codeId>` instead of `--artifact`. If you do so, the script will skip uploading the code and instantiate/migrate the contract with the given code id.

An example command using an existing code id looks like so:

```sh
npm run deploy-pyth -- --network testnet --code-id 50123 --mnemonic "..." --migrate --contract "terra123..."
```
