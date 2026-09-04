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
- **Lazer contract** (`EvmLazerContract` / `SuiLazerContract` / `IotaLazerContract` / `StellarLazerContract`) — the Pyth Lazer verifier, which checks signed Lazer price updates and holds the trusted signer set.
- **Executor contract** (`EvmExecutorContract` / `StellarExecutorContract`) — the governance executor that verifies a Pyth governance VAA and dispatches the decoded action to its target contract (or upgrades itself).
- **Entropy contract** (`EvmEntropyContract`) — the Pyth Entropy contract serving on-chain secure randomness requests.
- **Pulse contract** (`EvmPulseContract`) — the Pyth Pulse contract for scheduled, on-demand price-update callbacks.
- **Token** (`Token`) — a native/gas token used to pay fees on a chain.
- **Vault** (`Vault`) — the Solana multisig governance vault used to propose and execute governance messages.

# Docs

You can generate the docs by running `pnpm exec typedoc src/index.ts` from this directory. Open the docs by opening `docs/index.html` in your browser.

# Scripts

You can run the scripts by executing `pnpm tsx scripts/<script_name>.ts` from this directory.

# Pyth Pro guardian sets

A Pyth Pro wormhole receiver is deployed with the set-0 keys from
`getDefaultDeploymentConfig(deploymentType)`, but the Pro routers sign price VAAs with the
**latest** guardian set. A receiver that has not had every rotation replayed onto it therefore
verifies nothing.

The signed rotation VAAs live in `src/store/guardian_sets/`, one file per Pro deployment type,
ordered by the index they install:

- `ProCompatibleStagingGuardianSetVaas.json`
- `ProCompatibleProductionGuardianSetVaas.json`

`src/core/pro_guardian_sets.ts` loads and validates them, and
`WormholeContract.syncProGuardianSets(deploymentType, privateKey)` replays the ones a receiver has
not applied yet. After a rotation, append the new VAA to the file for that deployment type so every
later deploy picks it up.

The EVM and Solana deploy scripts (`deploy_evm_pro_cutover.ts` /
`deploy_evm_*_contracts.ts` via `common.ts`, and `deploy_solana_programs.ts`) do this
automatically. **Sui is deployed by a shell script and has no such hook**, so after deploying a
Sui Pro receiver run the rotations by hand:

```bash
pnpm tsx scripts/sync_pro_guardian_set.ts --expect-index <latest> --from-store \
  --deployment-type pro-compatible-production --chain sui_mainnet --private-key <key>
```

`--from-store` works for every chain, so the same command with `--dry-run` and no `--chain` filter
is also how to check that every receiver in the store is on the latest set.
