# Pyth Ethereum Contract

This directory contains The Pyth contract on Ethereum and utilities to deploy it in EVM chains.

## Installation

The contracts are built and tested using Foundry. Follow the [Foundry installation instructions](https://book.getfoundry.sh/getting-started/installation) to install it if you do not already have it.

Next, run the following command from the repo root to install required dependencies for the contract:

```
pnpm i
pnpm turbo build --filter @pythnetwork/pyth-evm-contract
```

Next, from the `contracts` directory, run the following command to install forge dependencies:

```
npm run install-forge-deps
```

## Testing

Run `forge build` to build the contracts and `forge test` to run the contract unit tests.
The unit tests live in the `forge-test` directory.

### Code Coverage

To see line-by-line test coverage:

```
npm run coverage
```

Open `coverage/index.html` in your web browser to see the results.

### Governance tests

There is a separate test suite executed by truffle for testing governance messages and contract upgrades. You can run ganache-cli as a blockchain instance and test it manually. To do the latter, run the following commands in the `contracts` folder:

1. Spawn a new network on a seperate terminal (do not close it while running tests):

```bash
pnpm dlx ganache-cli -e 10000 --deterministic --time="1970-01-02T00:00:00+00:00" --host=0.0.0.0
```

2. deploy the contracts:

```bash
cp .env.test .env && pnpm exec truffle compile --all && pnpm exec truffle migrate --network development
```

3. Run the test suite:

```bash
npm run test-contract
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
