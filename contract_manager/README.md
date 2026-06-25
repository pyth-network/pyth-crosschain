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

Each of these entities has a specialized class for each supported chain (EVM/Cosmos/Aptos/Sui/Stellar).

# Lazer on Stellar

Pyth Lazer on Stellar (Soroban) is split across two contracts (see
`pyth-network/pyth-lazer` `contracts/stellar`), each with its own class in
`src/core/contracts/stellar.ts` — mirroring the EVM split between
`EvmLazerContract` and `EvmExecutorContract`:

- `StellarLazerContract` — the **verifier** (`pyth-lazer-stellar`) verifies signed
  price updates and holds the trusted signer set, and
- `StellarExecutorContract` — the **executor** (`wormhole-executor-stellar`)
  verifies Wormhole governance VAAs and dispatches the decoded action to the
  verifier (or upgrades itself).

Governance always enters through the executor: a Pyth governance VAA carrying a
PTGM (Pyth Target Governance Message) is submitted to the executor's
`execute_governance_action`, which invokes the named function on the verifier. The
verifier's payload builders resolve the authorized executor from the verifier's
on-chain state, the same way `EvmLazerContract` resolves its owning executor.

Because Soroban addresses are variable-length strkeys and arguments are
XDR-encoded, Stellar uses a dedicated governance module
(`MODULE_STELLAR_EXECUTOR = 4` in `xc-admin-common`) rather than the Lazer module
(3), so its `Call` / `UpgradeExecutor` action codes never collide with the Sui /
Cardano Lazer actions. A logical action such as "update trusted signer" is encoded
as `Call(target = verifier, fn = "update_trusted_signer", args = ScVec([pubkey,
expiresAt]))`. See `generate_stellar_lazer_update_trusted_signer_proposal.ts`.

The PTGM target chain id is a dedicated Pyth receiver id (`stellar_testnet` /
`stellar_mainnet`), **not** Wormhole's canonical Stellar id (which collides with
`base`). The deployed executor must be initialized with the matching `chain_id`.

> **Note:** only the **testnet** verifier is registered today. The testnet
> executor address in `store/contracts/StellarExecutorContracts.json` is a
> placeholder and must be replaced once the executor is deployed; mainnet is not
> yet deployed.

# Docs

You can generate the docs by running `pnpm exec typedoc src/index.ts` from this directory. Open the docs by opening `docs/index.html` in your browser.

# Scripts

You can run the scripts by executing `pnpm tsx scripts/<script_name>.ts` from this directory.
