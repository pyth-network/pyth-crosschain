# Pyth CosmWasm

This directory contains the Pyth contract for CosmWasm and utilities to deploy it on CosmWasm chains.

## Deployment types

We have two kinds of deployment possible on each chain. Stable and Beta.
On mainnets we only deploy the stable version. On testnets we deploy both.
The purpose of deploying the stable version on testnets is allowing dApps to test their protocol using real accurate price feeds.

- Stable deployments are controlled by the upgrade multisig deployed on mainnet and accept price feeds that originate from pythnet.
- Beta deployments are controlled by the upgrade multisig deployed on devnet and accept price feeds that originate from pythtest-crosschain.

This also means we need to somehow distinguish between stable deployments on testnet and mainnets, otherwise a single governance message can affect both of them and have undesired side effects.
We do this on cosmwasm by assigning unique chain ids to the testnet and mainnet.

## Deployment

Deploying the CosmWasm contract has three steps:

1. Upload the code. This step will give you a code id.
2. Either create a new contract or upgrade an existing one:
   1. Create a new contract that has an address with a code id as its program.
   2. Upgrade an existing contract code id to the new code id using governance messages.
3. Update contract's admin to itself.

The [scripts](./deploy-scripts/README.md) directory contains the instructions and scripts to perform all the steps.

#### Permissoned networks:

We currently have two permissioned networks: injective and osmosis. Uploading the code on their mainnet is not possible without an authority or a governance proposal.
