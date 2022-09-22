# Deploying Contracts to Production

Running the Truffle migrations in [`migrations/prod`](migrations/prod) or [`migrations/prod-receiver`](migrations/prod-receiver/) will deploy the contracts to production. The `prod-receiver` migrations should be used when you need to deploy to a chain that is unsupported by the Wormhole network. The Wormhole Receiver contract acts as a read-only Wormhole endpoint that can verify Wormhole messages even if the Wormhole network has not yet connected the chain.

This is the deployment process:

```bash
# The Secret Recovery Phrase for the wallet the contract will be deployed from.
export MNEMONIC=...

# Set the deploy commit hash in the contract (used for debugging purposes)
sed -i "s/__DEPLOY_COMMIT_HASH_PLACEHOLER__/$(git rev-parse HEAD)/g" ./contracts/pyth/Pyth.sol

# Ensure that we deploy a fresh build with up-to-date dependencies.
rm -rf build && npx truffle compile --all

# Merge the network addresses into the artifacts, if some contracts are already deployed.
npx apply-registry

# After doing the above steps, you can run the below commands per each network.

# Load the configuration environment variables for deploying your network. make sure to use right env file.
# If it is a new chain you are deploying to, create a new env file and commit it to the repo.
rm -f .env; ln -s .env.prod.xyz .env && set -o allexport && source .env set && set +o allexport

# Perform the migration step by step using `--to` argument. Some steps require a governance execution to be successful.
# You might need to repeat the steps because of busy RPCs.
# Also, sometimes the gases are not adjusted. Please update them with the network
# explorer gas tracker.
npx truffle migrate --network $MIGRATIONS_NETWORK --to <step>

# Some steps require executing a governance instruction to be successful, you can use the multisig message builder tool in 
# `third_party/pyth` of this repo root to create multisig transaction and execute it to create the VAA.
# Then you can use the VAA (in hex) to execute the governance instruction. To do so, run:
$ npx truffle console --network $MIGRATIONS_NETWORK
> let p = await PythUpgradable.deployed()
> await p.executeGovernanceInstruction("<VAA in hex like: 0x123002342352>");

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
 * Version <x.y.z>.
 * 
 * Briefly describe the changelog here.
 */
module.exports = async function (deployer) {
    const proxy = await PythUpgradable.deployed();
    await upgradeProxy(proxy.address, PythUpgradable, { deployer });
}
```

**When changing the storage, you might need to disable the storage checks because Open Zeppelin is very conservative,
and appending to the Pyth State struct is considered illegal.** Pyth `_state` variable is a Pyth State
struct that contains all Pyth variables inside it. It is the last variable in the contract
and is safe to append fields inside it. However, Open Zeppelin only allows appending variables
in the contract surface and does not allow appending in the nested structs.

To disable security checks, you can add 
`unsafeSkipStorageCheck: true` option in `upgradeProxy` call. **If you do such a thing, 
make sure that your change to the contract won't cause any collision**. For example:
- Renaming a variable is fine.
- Changing a variable type to another type with the same size is ok.
- Appending to the contract variables is ok. If the last variable is a struct, it is also fine
  to append to that struct.
- Appending to a mapping value is ok as the contract stores mapping values in a random (hashed) location.

Anything other than the operations above will probably cause a collision. Please refer to Open Zeppelin Upgradeable
(documentations)[https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable] for more information.

## Versioning

We use [Semantic Versioning](https://semver.org/) for our releases. When upgrading the contract, update the npm package version using
`npm version <new version number> --no-git-tag-version`. Also, modify the hard-coded value in `version()` method in
[the `Pyth.sol` contract](./contracts/pyth/Pyth.sol) to the new version. Then, after your PR is merged in main, create a release like with tag `pyth-evm-contract-v<x.y.z>`. This will help developers to be able to track code changes easier.

# Testing

The [pyth-js][] repository contains an example with documentation and a code sample showing how to relay your own prices to a
target Pyth network. Once you have relayed a price, you can verify the price feed has been updated by doing:

```
$ npx truffle console --network $MIGRATIONS_NETWORK
> let p = await PythUpgradable.deployed()
> p.queryPriceFeed("0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b") // BTC Testnet or any other address
```

[pyth-js]: https://github.com/pyth-network/pyth-js/tree/main/pyth-evm-js#evmrelay

# Verifying the contract

Please first try verifying the contract using truffle as described in [VERIFY.md](./VERIFY.md). It that doesn't work
Try to manually verify the contract using the explorer UI. You can try to upload the standard json output in `build/contracts`
directory. If that doesn't work either, you can flatten the contract and try to verify it.

To flatten the contract, run the following command:

`npx sol-merger contracts/pyth/PythUpgradable.sol`

It will create a new file `PythUpgradable_merged.sol` which you can use in the explorer to verify the implementation contract (using exact sol version and optimization flag). After verifying implementation, you can verify the proxy.
