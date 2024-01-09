# Pyth Solana Receiver

This folder contains:

- A Pyth receiver program to receive Pythnet price feeds on Solana in `programs/pyth-solana-receiver`
- A Cli that acts as a simple client to interact with the Pyth receiver program in `cli/`

# Overview of the design

Receiving a price update from Pythnet involves two steps:

- First, verifying the VAA i.e. verifying the Wormhole guardians' signatures on the accumulator root that contains all the price updates for a given Pythnet slot.
- Second, verifying the price update by providing an inclusion proof that proves the price update is part of the accumulator root that was verified in the first step.

# Implementation

This contract offers two ways to post a price update from Pythnet onto Solana:

- `post_updates` allows you to do it in 2 transactions and checks all the Wormhole guardian signatures (the quorum is currently 13 signatures). It relies on the Wormhole contract to verify the signatures.
- `post_updates_atomic` allows you to do it in 1 transaction but only partially checks the Wormhole guardian signatures (5 signatures seems like the best it can currently do). Therefore it is less secure. It relies on a guardian set account from the Wormhole contract to check the signatures against the guardian keys.

`post_updates` is also a more efficient way to post updates if you're looking to post data for many different price feeds at a single point in time.
This is because it persists a verified encoded VAA, so guardian signatures will only get checked once. Then that single posted VAA can be used to prove the price update for all price feeds for that given point in time.

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
cargo run --package pyth-solana-receiver-cli -- --url https://api.devnet.solana.com --keypair ${PATH_TO_KEYPAIR} --wormhole HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ post-price-update-atomic -p ${HERMES_UPDATE_IN_BASE_64}
```

or

```
cargo run --package pyth-solana-receiver-cli -- --url https://api.devnet.solana.com --keypair ${PATH_TO_KEYPAIR} --wormhole HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ post-price-update -p ${HERMES_UPDATE_IN_BASE_64}
```
