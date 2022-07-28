# Deploying Contracts to Production

Running the Truffle migrations in [`migrations/prod`](migrations/prod) or [`migrations/prod-receiver`](migrations/prod-receiver/) will deploy the contracts to production. The `prod-receiver` migrations should be used when you need to deploy to a chain that is unsupported by the Wormhole network. The Wormhole Receiver contract acts as a read-only Wormhole endpoint that can verify Wormhole messages even if the Wormhole network has not yet connected the chain.

This is the deployment process:

```bash
# Load the configuration environment variables for deploying your network. make sure to use right env file.
# If it is a new chain you are deploying to, create a new env file and commit it to the repo.
rm -f .env; ln -s .env.prod.xyz .env && set -o allexport && source .env set && set +o allexport

# The Secret Recovery Phrase for the wallet the contract will be deployed from.
export MNEMONIC=...

# Ensure that we deploy a fresh build with up-to-date dependencies.
rm -rf build && npx truffle compile --all

# Merge the network addresses into the artifacts, if some contracts are already deployed.
npx apply-registry

# Perform the migration
npx truffle migrate --network $MIGRATIONS_NETWORK

# Perform this in first time mainnet deployments with Wormhole Receiver. (Or when guardian sets are upgraded)
npm run receiver-submit-guardian-sets -- --network $MIGRATIONS_NETWORK
```

As a sanity check, it is recommended to deploy the  migrations in `migrations/prod` to the Truffle `development` network first. You can do this by using the configuration values in [`.env.prod.development`](.env.prod.development).

As a result of this process for some files (with the network id in their name) in `networks` and `.openzeppelin` directory might change which need to be committed (if they are result of a production deployment).

If you are deploying to a new network, please add the new contract address to consumer facing libraries and documentations.

To do so, add the contract address to both [Pyth Gitbook EVM Page](https://github.com/pyth-network/pyth-gitbook/blob/main/consumers/evm.md) and [pyth-evm-js package](https://github.com/pyth-network/pyth-js/blob/main/pyth-evm-js/src/index.ts#L13). You also need to add the new network address to [pyth-evm-js relaying example](https://github.com/pyth-network/pyth-js/blob/main/pyth-evm-js/src/examples/EvmRelay.ts#L47).

## `networks` directory
Truffle stores the address of the deployed contracts in the build artifacts, which can make local development difficult. We use [`truffle-deploy-registry`](https://github.com/MedXProtocol/truffle-deploy-registry) to store the addresses separately from the artifacts, in the [`networks`](networks) directory. When we need to perform operations on the deployed contracts, such as performing additional migrations, we can run `npx apply-registry` to populate the artifacts with the correct addresses.

Each file in the network directory is named after the network id and contains address of Migration contract and PythUpgradable contract
(and Wormhole Receiver if we use `prod-receiver`). If you are upgrading the contract it should not change. In case you are deploying to a new network make sure to commit this file.

## `.openzeppelin` directory
In order to handle upgrades safely this directory stores details of the contracts structure, such as implementation addresses
and their respective storage layout in one file per network (the name contains network id). This allows truffle to 
check whether the upgrade is causing any memory collision. Please take a look at (this doc)[https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable] 
for more information.

Changes to the files in this directory should be commited as well.

# Upgrading the contract
To upgrade the contract you should add a new migration file in the `migrations/*` directories increasing the migration number.

It looks like so:

```javascript
require('dotenv').config({ path: "../.env" });

const PythUpgradable = artifacts.require("PythUpgradable");

const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

/**
 * Briefly describe the changelog here.
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer });
}
```

# Testing

The [pyth-js][] repository contains an example with documentation and a code sample showing how to relay your own prices to a
target Pyth network. Once you have relayed a price, you can verify the price feed has been updated by doing:

```
$ npx truffle console --network $MIGRATIONS_NETWORK
> let p = await PythUpgradable.deployed()
> p.queryPriceFeed("0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b") // BTC Testnet or any other address
```

[pyth-js]: https://github.com/pyth-network/pyth-js/tree/main/pyth-evm-js#evmrelay

# Manually Verifying the contract

Run the following command:

`npx sol-merger contracts/pyth/PythUpgradable.sol`

It will create a new file `PythUpgradable_merged.sol` which you can use in etherscan to verify the implementation contract (using exact sol version and optimization flag). After verifying implementation, you can verify the proxy.
