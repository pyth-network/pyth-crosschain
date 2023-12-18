# Pyth Solana Receiver

This folder contains:

- A Pyth receiver program to receive Pythnet price feeds on Solana in `programs/pyth-solana-receiver`
- A Cli that acts as a simple client to interact with the Pyth receiver program in `cli/`

# Overview of the design

Receiving a price update from Pythnet involves two steps:

- First, verifying the VAA i.e. verifying the Wormhole guardians' signatures on the accumulator root that contains all the price updates for a given Pythnet slot. This happens in the Wormhole receiver contract (Note: this contract is in the Wormhole monorepo, we're currently using this branch https://github.com/guibescos/wormhole/tree/variable-sigs).
- Second, verifying the price update by providing an inclusion proof that proves the price update is part of the accumulator root that was verified in the first step. This happens in the Pyth receiver contract.

The Pyth receiver program:

- verifies that the VAA has been verified by the Wormhole program (through the owner of the account that contains the VAA, the anchor discriminator and the field `verified_signatures`).
- checks that the VAA was emitted by the right data source
- checks the inclusion proof is valid
- posts the price update to a `PriceUpdateV1` account

# Devnet deployment

The program is currently deployed on Devnet with addresses:

- `HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ` for the Wormhole receiver
- `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` for the Pyth receiver

# Example flow

The `cli` folder contains some useful client code to interact with both the Wormhole receiver and the Pyth receiver.

To run the full flow of posting a price update (on devnet) please follow the following steps:

Get a Hermes update from Hermes stable:

```
curl  "https://hermes.pyth.network/api/latest_vaas?ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"

```

Post it to devnet:

```
cargo run --package pyth-solana-receiver-cli -- --url https://api.devnet.solana.com --keypair ${PATH_TO_KEYPAIR} --wormhole HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ post-price-update -p ${HERMES_UPDATE_IN_BASE_64}
```
