# Pyth Ethereum Contract

This directory contains The Pyth contract on Ethereum and utilities to deploy it in EVM chains.

## Installation

The contracts are built and tested using Foundry. You can either:

1. **Use the setup script (recommended)**:
   Go to the `contracts` directory and Run `npm run setup` to automatically install Foundry v0.3.0 AND all forge dependencies.

2. **Manual installation**:
   a) Follow the [Foundry installation instructions](https://book.getfoundry.sh/getting-started/installation) and install version v0.3.0.

b) Next, from the `contracts` directory, run the following command to install forge dependencies:

```
npm run install-forge-deps
```

Next, run the following command from the repo root to install required dependencies for the contract:

```
pnpm i
pnpm turbo build --filter @pythnetwork/pyth-evm-contract
```

## Testing

Run `forge build` to build the contracts and `forge test` to run the contract unit tests.
The unit tests live in the `test` directory.

### Code Coverage

To see line-by-line test coverage:

```
npm run coverage
```

Open `coverage/index.html` in your web browser to see the results.

## Deployment and Governance tests

To deploy the contracts, you'll need to set up your environment variables and use the Foundry deployment script.

1. Copy the environment template and fill in your values:

```bash
cp .env.test .env
# Edit .env with your configuration
```

2. Deploy to a local network (for testing):

```bash
# Start a local node
anvil

# Anvil shows a list of default accounts and their corresponding private keys.
# Fetch any one of the private key from the anvil terminal and update in .env file.

# In another terminal, deploy the contracts
npm run deploy-local
```

3. Run the test suite:

```bash
npm run test
```

4. Deploy to a live network:

```bash
# Make sure your .env file has the correct RPC_URL and PRIVATE_KEY
npm run deploy
```

The deployment script will:

- Deploy the Wormhole contracts (Setup, Implementation, and Wormhole proxy)
- Deploy the Pyth contracts (PythUpgradable with ERC1967 proxy)
- Configure all necessary parameters from environment variables

5. Deploy and Verify the contracts (on live network)

```bash
# Make sure your .env file has the correct ETHERSCAN_API_KEY
npm run deploy-and-verify
```

### Gas Benchmarks

You can use foundry to run gas benchmark tests (which can be found in the `forge-test` directory). To run the tests with gas report
you can run `forge test --gas-report --match-contract GasBenchmark`. However, as there are multiple benchmarks, this might not be useful. You can run a
specific benchmark test by passing the test name using `--match-test`. A full command to run `testBenchmarkUpdatePriceFeedsFresh` benchmark test is like this:

```
forge test --gas-report --match-contract GasBenchmark --match-test testBenchmarkUpdatePriceFeedsFresh
```

A gas report should have a couple of tables like this:

```
╭───────────────────────────────────────────────────────────────────────────────────────────┬─────────────────┬────────┬────────┬─────────┬─────────╮
│ node_modules/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy contract ┆                 ┆        ┆        ┆         ┆         │
╞═══════════════════════════════════════════════════════════════════════════════════════════╪═════════════════╪════════╪════════╪═════════╪═════════╡
│ Deployment Cost                                                                           ┆ Deployment Size ┆        ┆        ┆         ┆         │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┤
│ 164236                                                                                    ┆ 2050            ┆        ┆        ┆         ┆         │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┤
│ Function Name                                                                             ┆ min             ┆ avg    ┆ median ┆ max     ┆ # calls │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┤
│ .............                                                                             ┆ .....           ┆ .....  ┆ .....  ┆ .....   ┆ ..      │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┤
│ updatePriceFeeds                                                                          ┆ 383169          ┆ 724277 ┆ 187385 ┆ 1065385 ┆ 2       │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌┤
│ .............                                                                             ┆ .....           ┆ .....  ┆ .....  ┆ .....   ┆ ...     │
╰───────────────────────────────────────────────────────────────────────────────────────────┴─────────────────┴────────┴────────┴─────────┴─────────╯
```

For most of the methods, the minimum gas usage is an indication of our desired gas usage. Because the calls that store something in the storage
for the first time in `setUp` use significantly more gas. For example, in the above table, there are two calls to `updatePriceFeeds`. The first
call has happened in the `setUp` method and costed over a million gas and is not intended for our Benchmark. So our desired value is the
minimum value which is around 380k gas.

If you like to optimize the contract and measure the gas optimization you can get gas snapshots using `forge snapshot` and evaluate your
optimization with it. For more information, please refer to [Gas Snapshots documentation](https://book.getfoundry.sh/forge/gas-snapshots).
Once you optimized the code, please share the snapshot difference (generated using `forge snapshot --diff <old-snapshot>`) in the PR too.
This snapshot gas value also includes an initial transaction cost as well as reading from the contract storage itself. You can get the
most accurate result by looking at the gas report or the gas shown in the call trace with `-vvvv` argument to `forge test`.
