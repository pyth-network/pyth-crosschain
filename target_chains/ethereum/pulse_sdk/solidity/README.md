# Pyth Pulse Solidity SDK

The Pyth Pulse Solidity SDK allows you to interact with the Pyth Pulse protocol, which automatically pushes Pyth price updates to on-chain contracts based on configurable conditions. This SDK provides the interfaces and data structures needed to integrate with the Pulse service.

## Install

### Truffle/Hardhat

If you are using Truffle or Hardhat, simply install the NPM package:

```bash
npm install @pythnetwork/pulse-sdk-solidity
```

### Foundry

If you are using Foundry, you will need to create an NPM project if you don't already have one.
From the root directory of your project, run:

```bash
npm init -y
npm install @pythnetwork/pulse-sdk-solidity
```

Then add the following line to your `remappings.txt` file:

```text
@pythnetwork/pulse-sdk-solidity/=node_modules/@pythnetwork/pulse-sdk-solidity
```

## Usage

To use the SDK, you need the address of a Pulse contract on your blockchain.

```solidity
import "@pythnetwork/pulse-sdk-solidity/IScheduler.sol";
import "@pythnetwork/pulse-sdk-solidity/SchedulerStructs.sol";

IScheduler pulse = IScheduler(<address>);
```

## Key Data Structures

### SubscriptionParams

This struct defines the parameters for a Pulse subscription:

```solidity
struct SubscriptionParams {
  bytes32[] priceIds; // Array of Pyth price feed IDs to subscribe to
  address[] readerWhitelist; // Optional array of addresses allowed to read prices
  bool whitelistEnabled; // Whether to enforce whitelist or allow anyone to read
  bool isActive; // Whether the subscription is active
  bool isPermanent; // Whether the subscription can be updated
  UpdateCriteria updateCriteria; // When to update the price feeds
}
```

### UpdateCriteria

This struct defines when price feeds should be updated:

```solidity
struct UpdateCriteria {
  bool updateOnHeartbeat; // Update based on time elapsed
  uint32 heartbeatSeconds; // Time interval for heartbeat updates
  bool updateOnDeviation; // Update based on price deviation
  uint32 deviationThresholdBps; // Price deviation threshold in basis points
}
```

## Creating a Subscription

```solidity
SchedulerStructs.SubscriptionParams memory params = SchedulerStructs.SubscriptionParams({
    priceIds: new bytes32[](1),
    readerWhitelist: new address[](1),
    whitelistEnabled: true,
    isActive: true,
    isPermanent: false,
    updateCriteria: SchedulerStructs.UpdateCriteria({
        updateOnHeartbeat: true,
        heartbeatSeconds: 60,
        updateOnDeviation: true,
        deviationThresholdBps: 100
    })
});

params.priceIds[0] = bytes32(...);  // Pyth price feed ID
params.readerWhitelist[0] = address(...);  // Allowed reader

uint256 minBalance = pulse.getMinimumBalance(uint8(params.priceIds.length));
uint256 subscriptionId = pulse.createSubscription{value: minBalance}(params);
```

## Reading Price Feeds

```solidity
bytes32[] memory priceIds = new bytes32[](1);
priceIds[0] = bytes32(...);  // Pyth price feed ID

PythStructs.Price[] memory prices = pulse.getPricesUnsafe(subscriptionId, priceIds);

// Access price data
int64 price = prices[0].price;
uint64 conf = prices[0].conf;
int32 expo = prices[0].expo;
uint publishTime = prices[0].publishTime;
```
