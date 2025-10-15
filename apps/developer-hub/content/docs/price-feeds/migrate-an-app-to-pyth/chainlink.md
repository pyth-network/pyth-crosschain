---
title: "Migrate from Chainlink to Pyth"
description: "Step-by-step guide to migrate your EVM application from Chainlink price feeds to Pyth using the Chainlink-compatible interface."
icon: "ArrowsClockwise"
---

# Migrate from Chainlink to Pyth

This guide explains how to migrate an EVM application that uses Chainlink price feeds to Pyth price feeds.
Pyth provides a Chainlink-compatible interface for its price feeds to make this process simple.
There are two main steps to the migration:

1. Deploy the [`PythAggregatorV3`](https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/ethereum/sdk/solidity/PythAggregatorV3.sol) contract to provide a Chainlink-compatible feed interface.
2. Schedule price updates for the feeds required by your app.

## Install Pyth SDKs

The `PythAggregatorV3` contract is provided in the [Pyth Price Feeds Solidity SDK](https://github.com/pyth-network/pyth-crosschain/tree/main/target_chains/ethereum/sdk/solidity).
Add this SDK to the dependencies of your EVM contract.

**Truffle/Hardhat**

If you are using Truffle or Hardhat, simply install the NPM package:

```bash copy
npm install @pythnetwork/pyth-sdk-solidity
```

**Foundry**

If you are using Foundry, you will need to create an NPM project if you don't already have one.
From the root directory of your project, run:

```bash copy
npm init -y
npm install @pythnetwork/pyth-sdk-solidity
```

Then add the following line to your `remappings.txt` file:

```text copy
@pythnetwork/pyth-sdk-solidity/=node_modules/@pythnetwork/pyth-sdk-solidity
```

## Deploy Adapter Contract

First, deploy the `PythAggregatorV3` contract from `@pythnetwork/pyth-sdk-solidity` as a replacement for your application's Chainlink price feeds.
`PythAggregatorV3` is an adapter contract that wraps the Pyth contract and implements Chainlink's `AggregatorV3Interface`.

One important difference between Pyth and Chainlink is that the Pyth contract holds data for all price feeds; in contrast, Chainlink has separate instances of `AggregatorV3Interface` for each feed.
The adapter contract resolves this discrepancy by wrapping a single Pyth price feed.
Users should deploy an instance of this adapter for every required price feed, then point their existing app to the addresses of the deployed adapter contracts.

The following `forge` deployment script demonstrates the expected deployment process:

```solidity copy
// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import { PythAggregatorV3 } from "@pythnetwork/pyth-sdk-solidity/PythAggregatorV3.sol";
import { ChainlinkApp } from "./ChainlinkApp.sol";

contract PythAggregatorV3Deployment is Script {
  function run() external {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    vm.startBroadcast(deployerPrivateKey);

    // Get the address for your ecosystem from:
    // https://docs.pyth.network/price-feeds/contract-addresses/evm
    address pythPriceFeedsContract = 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C;
    // Get the price feed ids from:
    // https://docs.pyth.network/price-feeds/price-feeds
    bytes32 ethFeedId = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 solFeedId = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;

    // Deploy an instance of PythAggregatorV3 for every feed.
    PythAggregatorV3 ethAggregator = new PythAggregatorV3(
      pythPriceFeedsContract,
      ethFeedId
    );
    PythAggregatorV3 solAggregator = new PythAggregatorV3(
      pythPriceFeedsContract,
      solFeedId
    );

    // Pass the address of the PythAggregatorV3 contract to your chainlink-compatible app.
    ChainlinkApp app = new ChainlinkApp(
      address(ethAggregator),
      address(solAggregator)
    );

    vm.stopBroadcast();
  }
}

```

Please see the [Chainlink Migration Example](https://github.com/pyth-network/pyth-examples/tree/main/price_feeds/evm/chainlink_migration) for a runnable version of the example above.

## Schedule Updates

Chainlink-compatible applications typically expect on-chain price feeds to update on a schedule.
When migrating to Pyth, apps may need to schedule these price updates themselves.
This step is required because Pyth is a pull oracle; see [What is a pull oracle?](/price-feeds/pull-updates.mdx) to learn more about this topic.

The [Sponsored Feeds](/price-feeds/sponsored-feeds.mdx) page shows a list of feeds that have scheduled on-chain updates.
If the feeds your application needs are not on this list, see [Schedule Price Updates](/price-feeds/schedule-price-updates) for several options to solve this problem.
