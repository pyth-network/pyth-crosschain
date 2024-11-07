# Pyth Express Relay JS SDK

Utility library for interacting with the Pyth Express Relay API.

## Installation

### npm

```
$ npm install --save @pythnetwork/express-relay-js
```

### Yarn

```
$ yarn add @pythnetwork/express-relay-js
```

## Development

To generate the latest type declarations from the server openapi schema, run:

```bash
npm run generate-api-types
```

You can generate the SVM Typescript declaration files from the IDLs via:

```bash
npm run generate-anchor-types
```

## Quickstart

```typescript
import {
  Client,
  OpportunityParams,
  BidParams,
} from "@pythnetwork/express-relay-js";

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

[This example](./src/examples/simpleSearcherEvm.ts) fetches `OpportunityParams` from the specified endpoint,
creates a fixed bid on each opportunity and signs them with the provided private key, and finally submits them back to the server. You can run it with
`npm run simple-searcher`. A full command looks like this:

```bash
npm run simple-searcher-evm -- \
  --endpoint https://per-staging.dourolabs.app/ \
  --chain-id op_sepolia \
  --private-key <YOUR-PRIVATE-KEY>
```

#### SimpleSearcherSvm

The SimpleSearcherSvm example submits a dummy SVM transaction to the auction server after appending the appropriate `SubmitBid` instruction that permissions the transaction. You can run it with `npm run simple-searcher-svm`, and the full command looks like:

```bash
npm run simple-searcher-svm -- \
  --endpoint-express-relay https://per-staging.dourolabs.app/ \
  --chain-id development-solana \
  --private-key <YOUR-PRIVATE-KEY> \
  --endpoint-svm "https://api.mainnet-beta.solana.com"
```

Note that if you are using a localhost server at `http://127.0.0.1`, you should specify `--endpoint http://127.0.0.1:{PORT}` rather than `http://localhost:{PORT}`, as Typescript maps `localhost` to `::1` in line with IPv6 rather than to `127.0.0.1` as with IPv4.
