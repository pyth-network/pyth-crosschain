# Contract Manager

The contract manager is a tool to interact with Pyth related contracts on all supported chains.

It has the following structure:

- `store` contains all the necessary information for registered chains and deployed contracts
- `scripts` contains utility scripts to interact with the contract manager and accomplish common tasks
- `src` contains the contract manager code

# Main Entities

Contract Manager has base classes which you can use to interact with the following entities:

- Chain
- PythContract
- WormholeContract

Each of these entities has a specialized class for each supported chain (EVM/Cosmos/Aptos/Sui).

# Docs

You can generate the docs by running `pnpm exec typedoc src/index.ts` from this directory. Open the docs by opening `docs/index.html` in your browser.

# Scripts

You can run the scripts by executing `pnpm exec ts-node scripts/<script_name>.ts` from this directory.
