# EasyLend Protocol

EasyLend is a simplified lending protocol that uses Express Relay for avoiding value leakage on liquidations.
It uses Pyth price feeds to calculate the asset values and the liquidation thresholds.

This project illustrates how to use the Express Relay SDK for contract integration and publishing opportunities.

## Contracts

The contracts are located in the `contracts` directory. The `EasyLend.sol` file contains the main contract logic.
The protocol can allow creation of undercollateralized vaults that are liquidatable upon creation. This is solely
for ease of testing and demonstration purposes.

## Monitoring script

The script in `src/monitor.ts` is used to monitor the vaults health and publish the liquidation opportunities:

- It subscribes to Pyth price feeds to get the latest prices for the assets used in the protocol.
- It periodically checks for new vaults using the chain rpc.
- Upon finding a vault that is below the liquidation threshold, it publishes a liquidation opportunity using the Express Relay SDK.
