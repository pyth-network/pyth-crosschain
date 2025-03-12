# Pre-requisites

Install move cli according to this [doc](../contracts/README.md)

# Deploying from scratch

Configure the `Move.toml` file accordingly. The wormhole address should be specified based on the target chain in the `Move.toml` and the pyth address should be `0x0`.

In order to run the commands, a SUI private key is needed. Often, the private key takes the form of "suiprivkey...". The example expects the key in the form of hex. You can use `sui keytool convert` to get the hex version fo the key, to be used below.

Run the following commands from the root of crosschain to ensure dependencies are correctly installed and built. You can install dependencies in root using `pnpm install`.

We can deploy the pyth oracle and initialize it with the following command:

```bash
pnpm turbo --filter @pythnetwork/pyth-sui-cli run cli -- deploy --private-key <private-key> --chain [sui_mainnet|sui_testnet]
```

You can then add your sui contract configs to the contract manager store.

You can also manually create all the price feeds available at the moment to make it easier for devs to test the oracle.

```bash
pnpm turbo --filter @pythnetwork/pyth-sui-cli run cli -- create-all --private-key <private-key> --contract <contract-id>
```

# Updating price feeds:

You can use the `create` and `update-feeds` commands to create and update price feeds respectively.

```bash
pnpm turbo --filter @pythnetwork/pyth-sui-cli run cli -- create --feed-id <feed-id> --private-key <private-key> --contract <contract-id>
```

```bash
pnpm turbo --filter @pythnetwork/pyth-sui-cli run cli -- update-feeds --feed-id <feed-id> --private-key <private-key> --contract <contract-id>
```

# Upgrade process:

The following steps are needed to upgrade our sui contracts:

- Contract changes:
  - Create a new struct for the new version and update `current_version` and `previous_version` functions in `version_control` module
  - Implement any custom logic needed to migrate the data from the old struct to the new one in the `migrate` module
  - Update dependency (e.g. wormhole) addresses if needed
- Generate the digest for the new contract build
- Create a governance proposal, proposing the sui package to be upgraded to this specific digest
- Approve and execute the governance proposal
- Run the upgrade transaction and publish the new package

## Generating the new contract hash:

Run the following command to generate the new hash, make sure the contract addresses are identical to the deployed ones:

```bash
pnpm turbo --filter @pythnetwork/pyth-sui-cli run cli -- generate-digest
```

## Upgrading the contract

To upgrade the contract after the governance vaa was executed run:

```bash
pnpm turbo --filter @pythnetwork/pyth-sui-cli run cli -- upgrade --private-key <private-key> --contract <contract-id> --vaa <upgrade-vaa>
```

The upgrade procedure consists of 2 transactions. The first one is to upgrade the contract (sui level) and the second one is to run the `migrate` function and upgrade the version (package level).
Since clients try to fetch the latest version of the package automatically, it's important to run the second transaction as soon as possible after the first one.

### FAQ:

- I'm seeing the error `Transaction has non recoverable errors from at least 1/3 of validators`. What should I do?
  Make sure you have enough funding in the wallet and try again. Usually a more descriptive error message is available in the returned value of the transaction.
