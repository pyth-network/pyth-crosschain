# Pyth CosmWasm

This directory contains the Pyth contract for CosmWasm and utilities to deploy it on CosmWasm chains.

## Deployment

Deploying the CosmWasm contract has three steps:

1. Upload the code. This step will give you a code id.
2. Either create a new contract or migrate an existing one:
   1. Create a new contract that has an address with a code id as its program.
   2. Migrating an existing contract code id to the new code id.
3. Update contract's admin to itself.

This directory contains the code to perform all the steps. Read below for the details.

### Uploading the code

First, build the contracts within [the current directory](./). You must have Docker installed.

```
cd ./tools
npm ci

# if you want to build specifically for injective
npm run build-contract -- --injective

# else a generic cosmwasm contract can be build using
npm run build-contract -- --cosmwasm
```

This command will build and save the Pyth contract in the `artifacts` directory.

Then, to deploy the Pyth contract (`pyth_cosmwasm.wasm`), run the following command in the `tools` directory:

```sh
npm ci # Do it only once to install the required packages
npm run deploy-pyth -- deploy-artifact --network osmosis_local --mnemonic "online prefer ..." --artifact "../artifacts/pyth_cosmwasm.wasm"
```

If successful, this command will print something along the lines of:

```sh
Deploying artifact
Storing WASM: ../artifacts/pyth_cosmwasm.wasm (230813 bytes)
Broadcasted transaction hash: "BBD2E5DF5046B24287E63C53852D251D4F7DDD7755E663C9EB67A9B5560DFE4C"
Deployed Code ID:  11
```

### Instantiating new contract

This command will upload the code and instantiates a new Pyth contract with the given code id:

```sh
npm run deploy-pyth -- instantiate --network osmosis_local --code-id 10 --mnemonic "online prefer ..."
```

If successful, the output should look like so:

```
Instantiating a contract
Broadcasted transaction hash: "5F9689ACEB5A57868F9B305A211962DEA826B1C47900904D39D61449A095ADE1"
Instantiated pyth at osmo1hzz0s0ucrhdp6tue2lxk3c03nj6f60qy463we7lgx0wudd72ctms64096d (0xb884f83f981dda1d2f9957cd68e1f19cb49d3c04aea2ecfbe833ddc6b7cac2f7)
Deployed Pyth contract at osmo1hzz0s0ucrhdp6tue2lxk3c03nj6f60qy463we7lgx0wudd72ctms64096d
```

### Migrating existing contract

If you want to upgrade an existing contract pass use the `migrate` command as follows.
This command will upload the code, and with the given code id, will migrate the existing contract to the new one:

```sh
npm run deploy-pyth -- migrate --network osmosis_local --code-id 9 --contract osmo1.. --mnemonic "online prefer ..."
```

If successful, the output should look like so:

```
Migrating contract osmo1hzz0s0ucrhdp6tue2lxk3c03nj6f60qy463we7lgx0wudd72ctms64096d to 9
Broadcasted transaction hash: "8CF74A7FDBA4264DC58418289D6A256DEA3BBFB89ABD6C0D74C0CEBC29418E52"
Contract osmo1hzz0s0ucrhdp6tue2lxk3c03nj6f60qy463we7lgx0wudd72ctms64096d code_id successfully updated to 9
```

### Updating contract's admin

Pyth contracts are owner of their own. To update a smart contract's admin use the following command.

```sh
npm run deploy-pyth -- update-admin --network osmosis_local --new-admin osmo1.. --contract osmo1... --mnemonic "online prefer ..."
```

The output should be like.

```
Updating contract's admin
Broadcasted transaction hash: "B8AA9E25F3AF28858464622AFABA0C0157BD0CB1814C6DB62ACDD2D240E5B973"
{
  codeId: 9,
  address: 'osmo1hzz0s0ucrhdp6tue2lxk3c03nj6f60qy463we7lgx0wudd72ctms64096d',
  creator: 'osmo1cyyzpxplxdzkeea7kwsydadg87357qnahakaks',
  admin: 'osmo1hzz0s0ucrhdp6tue2lxk3c03nj6f60qy463we7lgx0wudd72ctms64096d',
  initMsg: undefined
}
Contract's admin successfully updates
```

### Getting contract's info

If you want to check a contract details, use the following command.

```sh
npm run deploy-pyth -- get-contract-info --network osmosis_local --contract osmo1... --mnemonic "online prefer ..."
```

The output should be like:

```
Fetching contract info for: osmo1v6qjx5smfdxnh5gr8vprswl60rstyprj3wh4gz5mg7gcl7mtl5xqkm7gje
Fetched contract info for: osmo1v6qjx5smfdxnh5gr8vprswl60rstyprj3wh4gz5mg7gcl7mtl5xqkm7gje
{
  codeId: 9,
  address: 'osmo1v6qjx5smfdxnh5gr8vprswl60rstyprj3wh4gz5mg7gcl7mtl5xqkm7gje',
  creator: 'osmo1cyyzpxplxdzkeea7kwsydadg87357qnahakaks',
  admin: 'osmo1v6qjx5smfdxnh5gr8vprswl60rstyprj3wh4gz5mg7gcl7mtl5xqkm7gje',
  initMsg: undefined
}
```

### Common Errors

While running the instantiation/migration commands you might get the following errors:

- Gateway timeout: This error means that the request timed out. It is good to double check with terra finder as sometimes transactions succeed despite being timed out.
- Account sequence mismatch: Transactions from an account should have an increasing sequence number. This error happens when a transaction from the same sender is not fully synchronized with the terra RPC and an old sequence number is used. This is likely to happen because the deploy script sends two transactions: one to submit the code, and one to do the instantiation/migration.

Sometimes the output might have some node.js warning. But if you see a similar output as mentioned above. Transaction was successful.
