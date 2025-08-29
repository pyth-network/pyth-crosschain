# Pyth Lazer Sui JS SDK

This package helps you build a Sui Programmable Transaction to parse and verify a Lazer price payload on Sui.

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
import { SuiLazerClient } from "@pythnetwork/pyth-lazer-sui-js";

// Prepare Mysten Sui client
const provider = new SuiClient({ url: "<sui-fullnode-url>" });

// Create SDK client
const client = new SuiLazerClient(provider);

// Obtain a Lazer leEcdsa payload using @pythnetwork/pyth-lazer-sdk.
// See examples/SuiRelay.ts for a runnable end-to-end example.
const leEcdsa: Buffer = /* fetch via @pythnetwork/pyth-lazer-sdk */ Buffer.from([]);

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

// Sign and execute the transaction using your signer.
```

## Runnable example

A runnable example is provided at `examples/SuiRelay.ts`. It:
- connects to Lazer via `@pythnetwork/pyth-lazer-sdk`,
- fetches a single `leEcdsa` payload,
- composes a Sui transaction calling `parse_and_verify_le_ecdsa_update`.

Run:

```
pnpm -F @pythnetwork/pyth-lazer-sui-js build
pnpm -F @pythnetwork/pyth-lazer-sui-js example:sui-relay -- --nodeUrl <SUI_NODE_URL> --packageId <PYTH_LAZER_PACKAGE_ID> --stateObjectId <STATE_OBJECT_ID> --lazerUrl wss://<LAZER_WS_URL> [--token <TOKEN>] [--timeoutMs <ms>]
```

## Notes

- Move signature (from this repo):
  - `public fun parse_and_verify_le_ecdsa_update(s: &State, clock: &Clock, update: vector<u8>): Update`
- You must supply:
  - `packageId`: the published `pyth_lazer` package address
  - `stateObjectId`: the shared `pyth_lazer::state::State` object id

## References

- Pyth Lazer Sui contract: `lazer/contracts/sui/`
- Lazer JS SDK (data source): `lazer/sdk/js/`
- Mysten Sui TS SDK docs: https://sdk.mystenlabs.com/typescript/transaction-building/basics
