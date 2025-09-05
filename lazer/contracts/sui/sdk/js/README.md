# Pyth Lazer Sui JS SDK

This package provides utilities to create a Sui Programmable Transaction to parse & verify a Pyth Lazer price update on-chain.

## Build

From the repository root:

```sh
pnpm turbo build -F @pythnetwork/pyth-lazer-sui-js
```

## Quickstart

A runnable example is provided at `examples/FetchAndVerifyUpdate.ts`. It:

- connects to Lazer via `@pythnetwork/pyth-lazer-sdk`,
- fetches a single `leEcdsa` payload,
- composes a Sui transaction calling `parse_and_verify_le_ecdsa_update`.

### Run the example

Install `tsx` to run TypeScript scripts:

```sh
npm install -g tsx
```

Execute the example script:

```sh
SUI_KEY=<YOUR_SUI_PRIVATE_KEY> pnpm -F @pythnetwork/pyth-lazer-sui-js example:fetch-and-verify --fullnodeUrl <SUI_FULLNODE_URL> --packageId <PYTH_LAZER_PACKAGE_ID> --stateObjectId <PYTH_LAZER_STATE_OBJECT_ID> --token <LAZER_TOKEN>
```

The script's core logic is summarized below:

```ts
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SuiLazerClient } from "@pythnetwork/pyth-lazer-sui-js";

// Prepare Mysten Sui client
const provider = new SuiClient({ url: "<sui-fullnode-url>" });

// Create SDK client
const client = new SuiLazerClient(provider);

// Obtain a Lazer leEcdsa payload using @pythnetwork/pyth-lazer-sdk.
// See examples/FetchAndVerifyUpdate.ts for a runnable end-to-end example.
const leEcdsa: Buffer = /* fetch via @pythnetwork/pyth-lazer-sdk */ Buffer.from(
  [],
);

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

## Notes

- FIXME: Automatic `packageId` management is coming soon. The Lazer contract doesn't support upgradeability yet.

## References

- Pyth Lazer Sui contract: `lazer/contracts/sui/`
- Lazer JS SDK (data source): `lazer/sdk/js/`
- Mysten Sui TS SDK docs: https://sdk.mystenlabs.com/typescript/transaction-building/basics
