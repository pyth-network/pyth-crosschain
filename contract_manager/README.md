# Contract Manager

The contract manager is a tool to interact with Pyth related contracts on all supported chains.

It has the following structure:

- `store` contains all the necessary information for registered chains and deployed contracts
- `scripts` contains utility scripts to interact with the contract manager and accomplish common tasks
- `src` contains the contract manager code

# Main Entities

Contract Manager has base classes which you can use to interact with the
entities below. Most have a chain-specific implementation per supported ecosystem
(EVM/Cosmos/Aptos/Sui/Iota/Near/Fuel/Starknet/Ton/Stellar), and every instance is
loaded from `store` by the `DefaultStore`.

- **Chain** (`Chain`) — a blockchain network the tooling can target; holds RPC/network config and builds and submits transactions and governance payloads.
- **Price feed contract** (`PriceFeedContract`) — the core Pyth contract that receives price updates and is configured through governance.
- **Wormhole contract** (`WormholeContract`) — the Wormhole core bridge contract used to verify and submit governance VAAs.
- **Lazer contract** (`EvmLazerContract` / `SuiLazerContract` / `StellarLazerContract`) — the Pyth Lazer verifier, which checks signed Lazer price updates and holds the trusted signer set.
- **Executor contract** (`EvmExecutorContract` / `StellarExecutorContract`) — the governance executor that verifies a Pyth governance VAA and dispatches the decoded action to its target contract (or upgrades itself).
- **Entropy contract** (`EvmEntropyContract`) — the Pyth Entropy contract serving on-chain secure randomness requests.
- **Pulse contract** (`EvmPulseContract`) — the Pyth Pulse contract for scheduled, on-demand price-update callbacks.
- **Token** (`Token`) — a native/gas token used to pay fees on a chain.
- **Vault** (`Vault`) — the Solana multisig governance vault used to propose and execute governance messages.

# Docs

You can generate the docs by running `pnpm exec typedoc src/index.ts` from this directory. Open the docs by opening `docs/index.html` in your browser.

# Scripts

You can run the scripts by executing `pnpm tsx scripts/<script_name>.ts` from this directory.
