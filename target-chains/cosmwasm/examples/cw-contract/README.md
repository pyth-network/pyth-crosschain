# Pyth SDK Example Contract for CosmWasm

This repository contains an example contract that demonstrates how to read the Pyth price from the Pyth on-chain contract.
The example [contract](src/contract.rs) has two functions:

- `instantiate` sets the Pyth contract address and price feed id that the contract uses.
  This function is intended to be called once when the contract is deployed.
  See the [CosmWasm SDK README](../../pyth-sdk-cw/README.md) for the list of possible price feed ids.
- `query` queries the Pyth contract to get the current price for the configured price feed id.

## Testnet Demo

This example contract is running on Terra testnet at `terra16h868tx50d3w37ry7c5lzzg648f7yetu39p5pd`.
This contract has been instantiated to return the price of `Crypto.LUNA/USD`.
You can query the contract from this repo by running:

```sh
cd tools/
# Install dependencies (if you haven't done so already)
npm install
# Query the contract
npm run query -- --network testnet --contract terra16h868tx50d3w37ry7c5lzzg648f7yetu39p5pd
```

Or by going to the contract address in [Terra Finder](https://finder.terra.money/) you can query make a query like below:

```
{
  "fetch_price": {}
}
```

If the query is successful, the output should look like:

```
{
  current_price: { price: "8704350000", conf: "3150000", expo: -8 },
  ema_price: { price: "8665158600", conf: "2965370", expo: -8 }
}
```

If the price feed is currently not available you will see:

```
rpc error: code = Unknown desc = Generic error: Current price is not available: contract query failed
```

## Developing

If you would like to deploy a changed version of this contract, the process consists of two steps:

1. Build the WASM for the contract.
2. Upload the code and instantiate a new contract.

### Build WASM

See the [Developing instructions](Developing.md) for how to build the WASM for the contract.
The instructions in that document will build a file called `example_cw_contract.wasm` under the `artifacts/` directory.

### Upload and Instantiate Contract

The tools directory contains a deployment script that will upload a WASM file and instantiate a new contract with it.
You can run that script on the built WASM file as follows:

```sh
cd tools/
npm install
npm run deploy -- --network testnet --artifact ../artifacts/example_cw_contract.wasm --mnemonic "..." --instantiate
```

This command will deploy the contract to `testnet` and sets its owner to the wallet with the provided `mnemonic`.
Note that you have to populate the `--mnemonic` flag with the seedphrase for a valid Terra wallet with some LUNA for the specified network.

If successful, the output should look like:

```
Storing WASM: ../artifacts/example_cw_contract.wasm (183749 bytes)
Deploy fee:  44682uluna
Code ID:  53199
Instantiating a contract
Sleeping for 10 seconds for store transaction to finalize.
Instantiated Pyth Example at terra123456789yelw23uh22nadqlyjvtl7s5527er97 (0x0000000000000000000000001234567896267ee5479752a7d683e49317ff4294)
Deployed pyth example contract at terra123456789yelw23uh22nadqlyjvtl7s5527er97
```

By default, the deployment script sets the price feed to `Crypto.LUNA/USD` but you can change it in [deploy.js](tools/deploy.js).

### Querying the Contract

Once the contract is instantiated, you can query it by running:

```sh
npm run query -- --network testnet --contract <contract address>
```

### Migrating the Contract

You can also migrate an existing contract by passing the `--migrate --contract terra123456xyzqwe..` arguments to the deploy command:

```sh
npm run deploy -- --network testnet --artifact ../artifacts/example_cw_contract.wasm --mnemonic "..." --migrate --contract "terra123..."
```

This command will replace the code for the given contract with the specified WASM artifact.
If successful, the output should look like:

```
Storing WASM: ../artifacts/example_cw_contract.wasm (183749 bytes)
Deploy fee:  44682uluna
Code ID:  53227
Sleeping for 10 seconds for store transaction to finalize.
Migrating contract terra123456789yelw23uh22nadqlyjvtl7s5527er97 to 53227
Contract terra123456789yelw23uh22nadqlyjvtl7s5527er97 code_id successfully updated to 53227
```

### Troubleshooting

When deploying the contract, you may encounter gateway timeout or account sequence mismatch errors.
If this happens, check Terra Finder to determine if your transaction succeeded -- sometimes transactions succeed despite timing out.
Note that the deployment script submits multiple transactions.
If any of them fails, simply rerun the entire script; there is no problem re-running the successful transactions.
