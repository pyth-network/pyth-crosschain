# Deploying Contracts to Production

Running the Truffle migrations in [`migrations/prod`](migrations/prod) or [`migrations/prod-receiver`](migrations/prod-receiver/) will deploy the contracts to production. The `prod-receiver` migrations should be used when you need to deploy to a chain that is unsupported by the Wormhole network. The Wormhole Receiver contract acts as a read-only Wormhole endpoint that can verify Wormhole messages even if the Wormhole network has not yet connected the chain.

This is the deployment process:

```bash
# 1. Follow the installation instructions on README.md

# 2. Export the secret recovery phrase for the deployment account.
export MNEMONIC=$(cat path/to/mnemonic)


# 3. If you are modifying an existing contract, make sure that third_party/pyth/multisig-wh-message-builder/keys/key.json
# has the proper operational key for interacting with the multisig. Please follow
# the corresponding notion doc for more information about the keys.

# 4. Deploy the changes
# You might need to repeat this script because of busy RPCs. Repeating would not cause any problem even
# if the changes are already made. Also, sometimes the gases are not adjusted and it will cause the tx to
# remain on the mempool for a long time (so there is no progress until timeout). Please update them with
# the network explorer gas tracker. Tips in Troubleshooting section below can help in case of any error.
./deploy.sh <network_a> <network_b> <...>
# Example: Deploying to some testnet networks
# ./deploy.sh bnb_testnet fantom_testnet mumbai
#
# Example: Deploying to some mainnet networks
# ./deploy.sh ethereum bnb avalanche

# Perform this in first time mainnet deployments with Wormhole Receiver. (Or when guardian sets are upgraded)
npm run receiver-submit-guardian-sets -- --network $MIGRATIONS_NETWORK
```

As a sanity check, it is recommended to deploy the migrations in `migrations/prod` to the Truffle `development` network first. You can do this by using the configuration values in [`.env.prod.development`](.env.prod.development).

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

To upgrade the contract you should bump the version of the contract and the npm package to the new version and run the deployment
process described above. Please bump the version properly as described in [the section below](#versioning).

**When you are making changes to the storage, please make sure that your change to the contract won't cause any collision**. For example:

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

# Troubleshooting

- Sometimes the truffle might fail during the dry-run (e.g., in Ethereum). It is because openzeppelin does not have the required metadata for forking. To fix it please
  follow the suggestion [here](https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/241#issuecomment-1192657444).

- Sometimes due to rpc problems or insufficient gas the migration is not executed completely. It is better to avoid doing multiple transactions in one
  migration. However, if it happens, you can comment out the part that is already ran (you can double check in the explorer), and re-run the migration.
  You can avoid gas problems by choosing a much higher gas than what is showed on the network gas tracker. Also, you can find rpc nodes from
  [here](https://chainlist.org/)
