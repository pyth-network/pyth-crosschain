# Pyth-integration

An implementation of a [Pyth Network](https://pyth.network/) oracle contract in Sway. Utilising minimal, internal [Wormhole](https://docs.wormhole.com/wormhole/) functionality and state.

## Interfaces

The project provides four interfaces for interaction with the oracle contract:

- [PythCore](./pyth-interface/src/interface.sw#L24) - provides the core functionality to required to utilise the oracle; getting fees, updating prices and fetching prices.
- [PythInit](./pyth-interface/src/interface.sw#L263) - provides the functionality to setup the oracle's state.
- [PythInfo](./pyth-interface/src/interface.sw#L277) - provides additional information about the oracle's state.
- [WormholeGuardians](./pyth-interface/src/interface.sw#L308) - provides functionality to maintain and query the wormhole-state-elements used by the oracle.

## Running the project

### Project

Run the following commands from the root of the repository.

#### Program compilation

```bash
forc build
```

#### Running the tests

Before running the tests the programs must be compiled with the command above.

```bash
cargo test
```

#### Before deploying

Before deploying the oracle contract; the `deployer` must be set to the address of the deploying wallet in the storage block, so that the deployer can setup the contract with the `constructor()` method.

Parameters for the `constructor()` method can be seen in the [tests of the method](./tests/utils/interface/pyth_init.rs#L7), which at the time of writing uses the real up-to-date values as per Pyth's documentation and EVM integrations. Care should be taken to ensure that the most up-to-date values are used for the `constructor()` method's parameters.

#### Fuel network deployment:

The Pyth oracle contract has been deployed to Mainnet at `0x1c86fdd9e0e7bc0d2ae1bf6817ef4834ffa7247655701ee1b031b52a24c523da` and Testnet at `0x25146735b29d4216639f7f8b1d7b921ff87a1d3051de62d6cceaacabeb33b8e7`.
