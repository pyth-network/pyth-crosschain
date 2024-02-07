# Pyth Express Relay JS SDK

Utility library for interacting with the Pyth Express Relay API.

## Installation

### npm

```
$ npm install --save @pythnetwork/express-relay-evm-js
```

### Yarn

```
$ yarn add @pythnetwork/express-relay-evm-js
```

## Quickstart

```typescript
import {
  Client,
  OpportunityParams,
  BidInfo,
} from "@pythnetwork/express-relay-evm-js";

const client = new Client({ baseUrl: "https://per-staging.dourolabs.app/" });

function calculateOpportunityBid(
  opportunity: OpportunityParams
): BidInfo | null {
  // searcher implementation here
  // if the opportunity is not suitable for the searcher, return null
}
const opportunities = await client.getOpportunities();

for (const opportunity of opportunities) {
  const bidInfo = calculateOpportunityBid(order);
  if (bidInfo === null) continue;
  const opportunityBid = await client.signOpporunityBid(
    opportunity,
    bidInfo,
    privateKey // searcher private key with appropriate permissions and assets
  );
  await client.submitOpportunityBid(opportunityBid);
}
```

### Example

There is an example searcher in [examples](./src/examples/) directory.

#### SimpleSearcher

[This example](./src/examples/SimpleSearcher.ts) fetches `OpportunityParams` from the specified endpoint,
creates a fixed bid on each opportunity and signs them with the provided private key, and finally submits them back to the server. You can run it with
`npm run simple-searcher`. A full command looks like this:

```bash
npm run simple-searcher -- \
  --endpoint https://per-staging.dourolabs.app/ \
  --bid 100000 \
  --chain-id op_sepolia \
  --private-key <YOUR-PRIVATE-KEY>
```
