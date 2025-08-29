# Pyth Lazer Sui JS SDK

This package helps you build a Sui Programmable Transaction that calls the Lazer contract function `pyth_lazer::pyth_lazer::parse_and_verify_le_ecdsa_update` with a Lazer `leEcdsa` payload.

- Compose with `SuiClient` from `@mysten/sui/client`
- Fetch Lazer updates from `@pythnetwork/pyth-lazer-sdk`
- No package upgrade handling; you must provide `packageId` and `stateObjectId`

## Install (in monorepo)

From the repository root:

```
pnpm install
pnpm turbo build
```

## Quickstart

```ts
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import type { WebSocketPoolConfig } from "@pythnetwork/pyth-lazer-sdk";
import { SuiLazerClient } from "@pythnetwork/pyth-lazer-sui-js";

// Prepare Mysten Sui client
const provider = new SuiClient({ url: "<sui-fullnode-url>" });

// Create SDK client
const client = new SuiLazerClient(provider);

// Get a Lazer leEcdsa payload (example using a single sample)
const config: WebSocketPoolConfig = {
  urls: ["wss://lazer.example.ws/stream"],
  token: "<optional-token>",
  numConnections: 3,
};
const leEcdsa: Buffer = await SuiLazerClient.getLeEcdsaUpdate(config);

// Build transaction calling parse_and_verify_le_ecdsa_update
const tx = new Transaction();
const packageId = "<pyth_lazer_package_id>";
const stateObjectId = "<pyth_lazer_state_object_id>";

const updateVal = client.addParseAndVerifyLeEcdsaUpdateCall({
  tx,
  packageId,
  stateObjectId,
  updateBytes: leEcdsa,
});

// You can now chain more Move calls that consume `updateVal` if desired.
// Sign and execute the transaction using your signer.

// Example (pseudocode):
// const result = await provider.signAndExecuteTransaction({
//   signer,
//   transaction: tx,
//   options: { showEffects: true, showEvents: true },
// });
```

## Notes

- Move signature (from this repo):
  - `public fun parse_and_verify_le_ecdsa_update(s: &State, clock: &Clock, update: vector<u8>): Update`
- You must supply:
  - `packageId`: the published `pyth_lazer` package address
  - `stateObjectId`: the shared `pyth_lazer::state::State` object id
- We intentionally do not resolve the latest package id automatically.

## References

- Pyth Lazer Sui contract: `lazer/contracts/sui/`
- Lazer JS SDK (data source): `lazer/sdk/js/`
- Pyth Sui JS SDK (reference patterns): `target_chains/sui/sdk/js`
- Mysten Sui TS SDK docs: https://sdk.mystenlabs.com/typescript/transaction-building/basics
