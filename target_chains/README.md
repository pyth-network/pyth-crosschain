# Target Chains

This directory includes all implementations of pyth contracts in different chains.

Each implementation includes:

- Pyth contract in the target chain native contract development language (rust, move, solidity)
- Utility scripts for managing the contract
- Sdks required for other developers and dApps to integrate with pyth

# How pyth cross-chain works

Contracts deployed on other chains accept updates that are signed and published by wormhole.
These updates are in one of the two categories:

1. Price feed updates. For example, update the price of BTC/USD to the value of X.
2. Governance updates. For example, set the pyth update fee to X or upgrade the contract to a new implementation.

These messages are generated in pythnet (pyth mainnet network) and pythtest (pyth testnet network) and submitted to the wormhole program that is published on these chains.
Then the wormhole network signs these messages and produces a VAA that can be relayed and consumed in contracts on other blockchains.

A basic implementation of pyth on a target chain includes the following pieces of logic:

1. How to get the price values for a specific price feed (e.g BTC/USD). This usually comes with some helper functions to avoid users consuming old and stale data.
2. How to update the values of a price feed via wormhole vaas + bookkeeping on pyth fees
3. How to parse and process the governance messages and update the contract state

## What is stored on each contract

In terms of contract configuration the following states exist on all the implementations:

1. Price feeds: each contract stores the latest values for each price feed
2. Wormhole address: wormhole contract to be used for verifying the VAAs
3. Data sources: The VAAs can be published by address on any chain supported by wormhole, this configuration specifies which message sources to trust for updating the price feeds
4. Governance data source: Same as above but for governance updates. Only one single source is accepted at any time.
   The governance data source for the official pyth deployments are a multisig instance.
5. Update fees: How much to charge for each transaction updating the price feeds
6. Stale price time: How many seconds should be passed to consider a price feed stale

## Wormhole deployments

In the case that wormhole is not deployed on a new chain we want to deploy pyth on, we need to deploy wormhole too.
The deployment process is chain dependent, but should be very similar to how pyth is deployed on the target chain.
After the initial deployment, we need to make sure wormhole configuration is also on the latest version.
This is done by running a set of fixed, known VAAs that update the wormhole configurations (guardians sets) on all chains.

# Upgrade process:

A general upgrade process has the following steps, these steps can vary slightly based on the target chain nature:

1. Implement the changes in the target contract, test, and audit
2. Create a github release on the commit where all the required changes are reflected
3. Upload the new contracts on the target chain
4. Create a governance proposal for upgrading the contract to the specified new implementation
5. Wait for approval
6. When the proposal is approved and executed, a governance message will be sent to wormhole which will result in a VAA
7. By submitting the VAA to the contract, the implementation will be updated

# Deploying on a new chain:

Deploying a contract on a new chain consists of the following steps:

1. Add the chain configuration via the [contract manager](../contract_manager) (this includes chainId, rpc information, etc.)
2. [Optional] Deploy the wormhole contract, if not already deployed.
3. Deploy and instantiate the contract on the target chain
4. Make sure the configurations are up-to-date.
5. Save the contract and chain information via contract manager and commit them inside this repository
