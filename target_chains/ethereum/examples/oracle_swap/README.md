# Pyth Oracle AMM

This directory contains an example oracle AMM application using Pyth price feeds.
The oracle AMM manages a pool of two tokens and allows a user to trade with the pool at the current Pyth price.

This application has two components. The first component is a smart contract (in the `contract` directory) that manages the pool and implements the trading functionality.
The second is a frontend application (in the `app` directory) that communicates with the smart contract.

Please see the [Pyth documentation](https://docs.pyth.network/pythnet-price-feeds) for more information about Pyth and how to integrate it into your application.

**Warning** this AMM is intended only as a demonstration of Pyth price feeds and is **not for production use**.

## AMM Contract

All of the commands in this section expect to be run from the `contract` directory.

### Building

You need to have [Foundry](https://getfoundry.sh/) and `node` installed to run this example.
Once you have installed these tools, run the following commands from this directory:

```
forge install foundry-rs/forge-std@2c7cbfc6fbede6d7c9e6b17afe997e3fdfe22fef --no-git --no-commit
forge install pyth-network/pyth-sdk-solidity@v2.2.0 --no-git --no-commit
forge install OpenZeppelin/openzeppelin-contracts@v4.8.1 --no-git --no-commit
```

### Testing

Simply run `forge test` in the [`contract`](./contract) directory. This command will run the
tests located in the [`contract/test`](./contract/test) directory.

### Deploying

To deploy the contract, you first need to configure the target network and the tokens in the AMM pool.
Edit the configuration parameters in the [deploy script](./contract/scripts/deploy.sh) and then run it using `./scripts/deploy.sh`.
The code comments in that file should help you populate the parameters correctly.

If you don't have ERC-20 tokens to test with, you can use the [token deploy script](./contract/scripts/deploy_token.sh) to create some for testing.
Edit the configuration parameters in there before running to set the network and token name.
This will deploy a new mock token and print out a contract address.
Once you have this address, you can mint the token anytime using the following command:

```
cast send --rpc-url <RPC_URL> -l <ERC20_CONTRACT_ADDRESS> "mint(address,uint256)" <YOUR_WALLET_ADDRESS> <QUANTITY_IN_WEI>
```

When the contract is deployed, the token pools are initially empty.
You will need to send some funds to the pool for testing purposes.
You can use the following command to transfer ERC-20 tokens from your wallet to the contract:

```
cast send --rpc-url <RPC_URL> -l <ERC20_CONTRACT_ADDRESS> "transfer(address,uint256)" <DESTINATION_ADDRESS> <QUANTITY_IN_WEI>
```

### Create ABI

If you change the contract, you will need to create a new ABI.
The frontend uses this ABI to create transactions.
You can overwrite the existing ABI by running the following command:

```
forge inspect OracleSwap abi > ../app/src/abi/OracleSwapAbi.json
```

## Frontend Application

All of the commands in this section assume you are in the `app` directory.
By default the frontend is configured to use the already deployed version of the smart-contracts 
on Polygon Mumbai at address [`0x15F9ccA28688F5E6Cbc8B00A8f33e8cE73eD7B02`](https://mumbai.polygonscan.com/address/0x15F9ccA28688F5E6Cbc8B00A8f33e8cE73eD7B02). 
This means you can start playing with the application without going through the steps above.

### Build

`npm ci`

### Run

`npm run start`

### Other configurations:

optimism goerli addresses
brl 0x8e2a09b54fF35Cc4fe3e7dba68bF4173cC559C69
usd 0x98cDc14fe999435F3d4C2E65eC8863e0d70493Df
swap contract 0xf3161b2B32761B46C084a7e1d8993C19703C09e7