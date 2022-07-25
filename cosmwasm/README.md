# Intro

This folder contains pyth contract on CosmWasm and utilities to deploy it in CosmWasm chains.

# Deployment

Deploying a contract in terra consists of two steps:
1. Uploading the code. This step will give you a code id.
2. Optionally create a new contract or migrate an existing one:
    1. Creating a new contract which has an address with a code id as its program.
    2. Migrating an existing contract code id to the new code id.

This script can do both steps at the same time. Read below for the details.

## Uploading the code

First build the contracts:

``` sh
bash build.sh
```

This command will builds and saves all the contracts in the `artifact` directory.

Then, for example, to deploy `pyth_bridge.wasm`, run in the `tools` directory:

``` sh
npm ci # Do it only once to install required packages
npm run deploy-pyth -- --network testnet --artifact ../artifacts/pyth_bridge.wasm --mnemonic "..."
```

which will print something along the lines of:

``` sh
Storing WASM: ../artifacts/pyth_bridge.wasm (367689 bytes)
Deploy fee:  88446uluna
Code ID:  2435
```

If you do not pass any additional arguments to the script it will only upload the code and returns the code id. If you want to create a 
new contract or upgrade an existing contract you should pass more arguments that are described below.

## Instantiating new contract
If you want instantiate a new contract after your deployment pass `--instantiate` argument to the above command.
It will upload the code and with the resulting code id instantiates a new pyth contract:

``` sh
npm run deploy-pyth -- --network testnet --artifact ../artifacts/pyth_bridge.wasm --mnemonic "..." --instantiate
```

If successful, the output should look like:
```
Storing WASM: ../artifacts/pyth_bridge.wasm (183749 bytes)
Deploy fee:  44682uluna
Code ID:  53199
Instantiating a contract
Sleeping for 10 seconds for store transaction to finalize.
Instantiated Pyth Bridge at terra123456789yelw23uh22nadqlyjvtl7s5527er97 (0x0000000000000000000000001234567896267ee5479752a7d683e49317ff4294)
Deployed pyth contract at terra123456789yelw23uh22nadqlyjvtl7s5527er97
```

## Migrating existing contract
If you want to upgrade an existing contract pass `--migrate --contract terra123456xyzqwe..` arguments to the above command.
It will upload the code and with the resulting code id migrates the existing contract to the new one:

``` sh
npm run deploy-pyth -- --network testnet --artifact ../artifacts/pyth_bridge.wasm --mnemonic "..." --migrate --contract "terra123..."
```

If successful, the output should look like:
```
Storing WASM: ../artifacts/pyth_bridge.wasm (183749 bytes)
Deploy fee:  44682uluna
Code ID:  53227
Sleeping for 10 seconds for store transaction to finalize.
Migrating contract terra1rhjej5gkyelw23uh22nadqlyjvtl7s5527er97 to 53227
Contract terra1rhjej5gkyelw23uh22nadqlyjvtl7s5527er97 code_id successfully updated to 53227
```

## Notes

You might encounter gateway timeout or account sequence mismatch in errors. In is good to double check with terra finder as sometimes
transactions succeed despite being timed out.

If that happens in the middle of an instantiation or migration. You can avoid re-uploading the code and use the resulting Code Id 
by passing `--code-id <codeId>` instead of `--artifact` and it will only do the instantiation/migration part.

An example is:

``` sh
npm run deploy-pyth -- --network testnet --code-id 50123 --mnemonic "..." --migrate --contract "terra123..."
```
