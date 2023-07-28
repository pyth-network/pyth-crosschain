# Crank Executor

This package checks for ready-to-execute proposals on a specified multisig address and executes them with the provided keypair.

Since some of the proposal instructions on multisig need other specific instructions which are not included in the proposal (like paying the wormhole fee or initializing an account),
it is not always possible to execute the proposal directly from the multisig ui.
This tool helps with crafting the correct execution transaction and runs them automatically.

## How to run:

For a single run you can execute:

```bash
CLUSTER=<devnet or mainnet-beta> VAULT=<vault-address> WALLET=<path-to-ops-wallet> ts-node index.ts
```

Otherwise you can configure a cron job to run this script periodically.
