# Pyth Lazer IOTA JS SDK

This package provides utilities to create an IOTA programmable transaction that
parses and verifies a Pyth Lazer price update on-chain.

## Build

From the repository root:

```sh
pnpm turbo build -F @pythnetwork/pyth-lazer-iota-js
```

## Quickstart

A runnable example is provided at `src/examples/fetch-and-verify.ts`. It:

- connects to Lazer via `@pythnetwork/pyth-lazer-sdk`,
- fetches a single `leEcdsa` payload,
- composes an IOTA transaction calling `parse_and_verify_le_ecdsa_update`.

### Run the example

```sh
# Your IOTA private key in Bech32 format
# export IOTA_KEY=

# Lazer contract state ID
# STATE_ID=

# Your Lazer API token
# LAZER_TOKEN=

IOTA_FULLNODE_URL="https://api.testnet.iota.cafe/"

pnpm run example:fetch-and-verify \
  --base-url "$IOTA_FULLNODE_URL" \
  --state-id "$STATE_ID" \
  --lazer-token "$LAZER_TOKEN"
```

The script's core logic is summarized below:

```ts
import { Buffer } from "node:buffer";
import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import { addParseAndVerifyLeEcdsaUpdateCall } from "@pythnetwork/pyth-lazer-iota-js";

// 1. Fetch the price update from Pyth Lazer in "leEcdsa" format:
const lazer = await PythLazerClient.create({ token: LAZER_TOKEN });
const latestPrice = await lazer.getLatestPrice({
  channel: "fixed_rate@200ms",
  formats: ["leEcdsa"],
  jsonBinaryEncoding: "hex",
  priceFeedIds: [1],
  properties: ["price", "bestBidPrice", "bestAskPrice", "exponent"],
});
const update = Buffer.from(latestPrice.leEcdsa?.data ?? "", "hex");

// 2. Create a new IOTA transaction:
const signer = Ed25519Keypair.fromSecretKey(IOTA_KEY);
const client = new IotaClient({ url: IOTA_FULLNODE_URL });
const tx = new Transaction();

// 3. Add the parse and verify call:
const verifiedUpdate = await addParseAndVerifyLeEcdsaUpdateCall({
  client,
  stateObjectId: STATE_ID,
  tx,
  update,
});

// 4. Consume `verifiedUpdate` in your own contract with additional calls...

// 5. Sign and execute the transaction:
const result = await client.signAndExecuteTransaction({
  signer,
  transaction: tx,
});
```

## References

- Pyth Lazer IOTA contract: `lazer/contracts/iota/`
- Lazer JS SDK: https://www.npmjs.com/package/@pythnetwork/pyth-lazer-sdk
- IOTA TypeScript SDK: https://www.npmjs.com/package/@iota/iota-sdk
