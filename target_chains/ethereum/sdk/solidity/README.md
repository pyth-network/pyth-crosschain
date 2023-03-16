# Pyth Solidity SDK

This package provides utilities for consuming prices from the [Pyth Network](https://pyth.network/) Oracle using Solidity. Also, it contains [the Pyth Interface ABI](./abis/IPyth.json) that you can use in your libraries
to communicate with the Pyth contract.

It is **strongly recommended** to follow the [consumer best practices](https://docs.pyth.network/consumers/best-practices) when consuming Pyth data.

## Installation

```bash
npm install @pythnetwork/pyth-sdk-solidity
```

## Example Usage

To consume prices you should use the [`IPyth`](IPyth.sol) interface. Please make sure to read the documentation of this interface in order to use the prices safely.

For example, to read the latest price, call [`getPrice`](IPyth.sol) with the Price ID of the price feed you're interested in. The price feeds available on each chain are listed [below](#target-chains).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract ExampleContract {
  IPyth pyth;

  constructor(address pythContract) {
    pyth = IPyth(pythContract);
  }

  function getBtcUsdPrice(
    bytes[] calldata priceUpdateData
  ) public payable returns (PythStructs.Price memory) {
    // Update the prices to the latest available values and pay the required fee for it. The `priceUpdateData` data
    // should be retrieved from our off-chain Price Service API using the `pyth-evm-js` package.
    // See section "How Pyth Works on EVM Chains" below for more information.
    uint fee = pyth.getUpdateFee(priceUpdateData);
    pyth.updatePriceFeeds{ value: fee }(priceUpdateData);

    bytes32 priceID = 0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b;
    // Read the current value of priceID, aborting the transaction if the price has not been updated recently.
    // Every chain has a default recency threshold which can be retrieved by calling the getValidTimePeriod() function on the contract.
    // Please see IPyth.sol for variants of this function that support configurable recency thresholds and other useful features.
    return pyth.getPrice(priceID);
  }
}

```

## How Pyth Works on EVM Chains

Pyth prices are published on Solana, and relayed to EVM chains using the [Wormhole Network](https://wormholenetwork.com/) as a cross-chain message passing bridge. The Wormhole Network observes when Pyth prices on Solana have changed and publishes an off-chain signed message attesting to this fact. This is explained in more detail [here](https://docs.wormholenetwork.com/wormhole/).

This signed message can then be submitted to the Pyth contract on the EVM networks along the required update fee for it, which will verify the Wormhole message and update the Pyth contract with the new price.

Please refer to [Pyth On-Demand Updates page](https://docs.pyth.network/consume-data/on-demand) for more information.

## Solidity Target Chains

[This](https://docs.pyth.network/consume-data/evm#networks) document contains list of the EVM networks that Pyth is available on.

You can find a list of available price feeds [here](https://pyth.network/developers/price-feed-ids/).

## Mocking Pyth

[MockPyth](./MockPyth.sol) is a mock contract that you can use and deploy locally to mock Pyth contract behaviour. To set and update price feeds you should call `updatePriceFeeds` and provide an array of encoded price feeds (the struct defined in [PythStructs](./PythStructs.sol)) as its argument. You can create encoded price feeds either by using web3.js or ethers ABI utilities or calling `createPriceFeedUpdateData` function in the mock contract.

## Development

### ABIs

When making changes to a contract interface, please make sure to update the ABI files too. You can update it using `npm run generate-abi` and it will update the ABI files in [abis](./abis) directory. If you create a new contract, you also need to add the contract name in [the ABI generation script](./scripts/generateAbi.js#L5) so the script can create the ABI file for the new contract as well.

### Releases

We use [Semantic Versioning](https://semver.org/) for our releases. In order to release a new version of this package and publish it to npm, follow these steps:

1. Run `npm version <new version number> --no-git-tag-version`. This command will update the version of the package. Then push your changes to github.
2. Once your change is merged into `main`, create a release with tag `v<new version number>` like `v1.5.2`, and a github action will automatically publish the new version of this package to npm.
