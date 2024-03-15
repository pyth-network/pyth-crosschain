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

## Development

To generate the latest type declarations from the server openapi schema, run:

```bash
npm run generate-api-types
```

## Quickstart

```typescript
import {
  Client,
  OpportunityParams,
  BidParams,
} from "@pythnetwork/express-relay-evm-js";

function calculateOpportunityBid(opportunity: Opportunity): BidParams | null {
  // searcher implementation here
  // if the opportunity is not suitable for the searcher, return null
}

async function bidStatusCallback(bidStatus: BidStatusUpdate) {
  console.log(`Bid status for bid ${bidStatus.id}: ${bidStatus.status.status}`);
}

async function opportunityCallback(opportunity: Opportunity) {
  const bidParams = calculateOpportunityBid(opportunity);
  if (bidParams === null) return;
  const opportunityBid = await client.signOpportunityBid(
    opportunity,
    bidParams,
    privateKey // searcher private key with appropriate permissions and assets
  );
  await client.submitOpportunityBid(opportunityBid);
}

const client = new Client(
  { baseUrl: "https://per-staging.dourolabs.app/" },
  bidStatusCallback,
  opportunityCallback
);

await client.subscribeChains([chain_id]); // chain id you want to subscribe to
```

### Example

There is an example searcher in [examples](./src/examples/) directory.

#### SimpleSearcher

[This example](./src/examples/simpleSearcher.ts) fetches `OpportunityParams` from the specified endpoint,
creates a fixed bid on each opportunity and signs them with the provided private key, and finally submits them back to the server. You can run it with
`npm run simple-searcher`. A full command looks like this:

```bash
npm run simple-searcher -- \
  --endpoint https://per-staging.dourolabs.app/ \
  --chain-id op_sepolia \
  --private-key <YOUR-PRIVATE-KEY>
```
