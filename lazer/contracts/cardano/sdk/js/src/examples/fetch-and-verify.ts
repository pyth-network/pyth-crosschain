/** biome-ignore-all lint/suspicious/noConsole: code example */

import process from "node:process";
import type { ProviderOnlyClient } from "@evolution-sdk/evolution";
import {
  createClient,
  ScriptHash,
  TransactionHash,
} from "@evolution-sdk/evolution";
import type { NetworkId } from "@evolution-sdk/evolution/sdk/client/Client";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getPythScriptHash, getPythState } from "../index.js";

/** Cardano network identifier. */
export type Network = Exclude<NetworkId, number>;

/** Provider configuration for connecting to a Cardano node. */
export type Provider =
  | {
      type: "blockfrost";
      projectId: string;
    }
  | {
      type: "koios";
      token?: string;
    }
  | {
      type: "maestro";
      apiKey: string;
    };

function resolveBaseUrl(network: Network, provider: Provider): string {
  switch (provider.type) {
    case "blockfrost": {
      return `https://cardano-${network}.blockfrost.io/api/v0`;
    }
    case "koios": {
      return `https://${
        {
          mainnet: "api",
          preprod: "preprod",
          preview: "preview",
        }[network]
      }.koios.rest/api/v1`;
    }
    case "maestro": {
      return `https://${network}.gomaestro-api.org/v1`;
    }
  }
}

/**
 * Create Cardano client using Evolution SDK.
 * @param network public network to use
 * @param provider API provider and token
 * @returns
 */
export function createEvolutionClient(
  network: Network,
  provider: Provider,
): ProviderOnlyClient {
  return createClient({
    network,
    provider: { ...provider, baseUrl: resolveBaseUrl(network, provider) },
  });
}

const {
  network,
  policyId: POLICY_ID,
  lazerToken: LAZER_TOKEN,
  provider: providerType,
  providerToken,
} = await yargs(hideBin(process.argv))
  .option("network", {
    choices: ["mainnet", "preprod", "preview"] as const,
    default: "preprod" as const,
    description: "Cardano network name, e.g. 'preprod'",
  })
  .option("policy-id", {
    demandOption: true,
    description: "Hex-encoded policy ID of the Cardano Pyth deployment",
    type: "string",
  })
  .option("lazer-token", {
    demandOption: true,
    description: "Lazer authentication token",
    type: "string",
  })
  .option("provider", {
    choices: ["blockfrost", "koios", "maestro"] as const,
    default: "koios" as const,
    description: "Cardano data provider used by Evolution SDK",
  })
  .option("provider-token", {
    description:
      "Provider credential. Required for Blockfrost and Maestro, optional for Koios.",
    type: "string",
  })
  .help()
  .parseAsync();

let provider: Provider;
switch (providerType) {
  case "blockfrost": {
    if (!providerToken) {
      throw new Error("missing --provider-token");
    }
    provider = {
      projectId: providerToken,
      type: providerType,
    };
    break;
  }
  case "koios": {
    provider = {
      type: providerType,
      ...(providerToken ? { token: providerToken } : {}),
    };
    break;
  }
  case "maestro": {
    if (!providerToken) {
      throw new Error("missing --provider-token");
    }
    provider = {
      apiKey: providerToken,
      type: providerType,
    };
    break;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////

// Steps for fetching and verifying the price update:

// 1. Fetch the price update from Pyth Lazer in the "solana" format - this is a
// little-endian format signed by an Ed25519 key, which we use for both Cardano and
// Solana integrations:
const lazer = await PythLazerClient.create({ token: LAZER_TOKEN });
const latestPrice = await lazer.getLatestPrice({
  channel: "fixed_rate@200ms",
  formats: ["solana"],
  jsonBinaryEncoding: "hex",
  priceFeedIds: [1],
  properties: ["price", "bestBidPrice", "bestAskPrice", "exponent"],
});

if (!latestPrice.solana?.data) {
  throw new Error("Missing update payload");
}

const update = Buffer.from(latestPrice.solana.data, "hex");

console.log("Fetched update bytes:", update.toString("hex"));

// 2. Resolve the active Pyth State UTxO and withdraw script hash from
// on-chain state. Evolution SDK is used under the hood by `getPythState`.
if (!process.env.CARDANO_MNEMONIC) {
  throw new Error("CARDANO_MNEMONIC environment variable not set");
}
const client = createEvolutionClient(network, provider);

const pythState = await getPythState(POLICY_ID, client);
const pythScript = getPythScriptHash(pythState);

console.log("Active withdraw script hash:", pythScript);

// 3. In your own transaction, include Pyth State UTxO as a reference input, and
// trigger 0-withdrawal on the verification script, together with the price
// update as a redeemer, to perform price verification on-chain.

const wallet = client.attachWallet({
  mnemonic: process.env.CARDANO_MNEMONIC,
  type: "seed",
});

const now = BigInt(Date.now());
const tx = wallet
  .newTx()
  .setValidity({ from: now - 60_000n, to: now + 60_000n })
  .readFrom({ referenceInputs: [pythState] })
  .withdraw({
    amount: 0n,
    redeemer: [update],
    stakeCredential: ScriptHash.fromHex(pythScript),
  });

// 4. Add your own scripts and transaction data...

// 5. Sign and execute the transaction:
const builtTx = await tx.build();
const digest = await builtTx.signAndSubmit();

console.log("Transaction Hash:", TransactionHash.toHex(digest));

await client.awaitTx(digest);

console.log("Transaction successful.");
