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

```sh
# Your Sui private key in Bech32 format
# export SUI_KEY=

# Lazer contract state ID
# STATE_ID=

# Your Lazer API token
# LAZER_TOKEN=

SUI_FULLNODE_URL="https://fullnode.mainnet.sui.io:443"

pnpm run example:fetch-and-verify \
  --fullnode-url "$SUI_FULLNODE_URL" \
  --state-id "$STATE_ID" \
  --lazer-token "$LAZER_TOKEN"
```

The script's core logic is summarized below:

```ts
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import { addParseAndVerifyLeEcdsaUpdateCall } from "@pythnetwork/pyth-lazer-sui-js";

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

// 2. Create a new Sui transaction:
const signer = Ed25519Keypair.fromSecretKey(SUI_KEY);
const client = new SuiGrpcClient({ baseUrl, network });
const tx = new Transaction();

// 3. Add the parse and verify call:
const verifiedUpdate = await addParseAndVerifyLeEcdsaUpdateCall({
  client: client.core,
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

- Pyth Lazer Sui contract: `lazer/contracts/sui/`
- Lazer JS SDK: https://www.npmjs.com/package/@pythnetwork/pyth-lazer-sdk
- Mysten Sui TS SDK docs: https://sdk.mystenlabs.com/typescript/transaction-building/basics
