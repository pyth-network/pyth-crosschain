# Contract Manager

The contract manager is a tool to interact with Pyth related contracts on all supported chains.

It has the following structure:

- `store` contains all the necessary information for registered chains and deployed contracts
- `scripts` contains utility scripts to interact with the contract manager and accomplish common tasks
- `src` contains the contract manager code


## Guide to add new Chain

Adding a new chain type to the contract manager can be done like so:

1. Add a new Chain type to `src/chains.ts` extending `Chain`.
2. Add a new Contract under `src/contracts/`. See another contract for reference.
3. Update `shell.ts` and `store.ts` with your new Chain type.
4. Add scripts that use the new contract under `scripts/` for useful tasks.
