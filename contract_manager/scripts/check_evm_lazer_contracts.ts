/* eslint-disable no-console */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type {
  Channel,
  PriceFeedProperty,
} from "@pythnetwork/pyth-lazer-sdk";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";

import { EvmLazerContract } from "../src/core/contracts/evm";
import { DefaultStore } from "../src/node/utils/store";

// --- Variant configuration ---

type PayloadVariant = {
  name: string;
  properties: PriceFeedProperty[];
  priceFeedIds: number[];
  channel: Channel;
};

const PROPERTY_COMBOS: {
  name: string;
  properties: PriceFeedProperty[];
  priceFeedIds: number[];
}[] = [
  {
    name: "minimal",
    properties: ["price", "exponent"],
    priceFeedIds: [1],
  },
  {
    name: "standard",
    properties: ["price", "bestBidPrice", "bestAskPrice", "exponent"],
    priceFeedIds: [1],
  },
  {
    name: "full",
    properties: [
      "price",
      "bestBidPrice",
      "bestAskPrice",
      "exponent",
      "confidence",
      "publisherCount",
    ],
    priceFeedIds: [1],
  },
  {
    name: "multi-feed-3",
    properties: ["price", "exponent"],
    priceFeedIds: [1, 2, 3],
  },
  {
    name: "multi-feed-10",
    properties: ["price", "exponent"],
    priceFeedIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
];

const CHANNELS: Channel[] = [
  "real_time",
  "fixed_rate@50ms",
  "fixed_rate@200ms",
];

function buildVariants(): PayloadVariant[] {
  const variants: PayloadVariant[] = [];
  for (const combo of PROPERTY_COMBOS) {
    for (const channel of CHANNELS) {
      variants.push({
        name: `${combo.name}/${channel}`,
        properties: combo.properties,
        priceFeedIds: combo.priceFeedIds,
        channel,
      });
    }
  }
  return variants;
}

// --- CLI ---

const parser = yargs(hideBin(process.argv))
  .usage(
    "Checks EVM Lazer contracts by fetching multiple payload variants and verifying them on-chain\n" +
      "Usage: $0 --lazer-token <token> [--chain <chain_name>] [--testnet]",
  )
  .options({
    chain: {
      description: "Check a specific chain only (e.g. arbitrum)",
      type: "string",
    },
    "lazer-token": {
      demandOption: true,
      description: "Lazer API access token",
      type: "string",
    },
    testnet: {
      default: false,
      description: "Check testnet contracts instead of mainnet",
      type: "boolean",
    },
  });

// --- Payload fetching ---

async function fetchEvmPayload(
  lazer: PythLazerClient,
  variant: PayloadVariant,
): Promise<Buffer> {
  const response = await lazer.getLatestPrice({
    channel: variant.channel,
    formats: ["evm"],
    jsonBinaryEncoding: "hex",
    priceFeedIds: variant.priceFeedIds,
    properties: variant.properties,
    parsed: true,
  });
  const data = response.evm?.data;
  if (!data) {
    throw new Error(
      `No EVM payload returned from Lazer API for variant "${variant.name}"`,
    );
  }
  return Buffer.from(data, "hex");
}

// --- Result types ---

type ChainInfo = {
  chain: string;
  address: string;
  version: string;
  owner: string;
  fee: string;
};

type VerifyResult = {
  chain: string;
  variant: string;
  payloadBytes: number;
  gasUsed: string;
  signerValid: boolean;
  status: string;
};

// --- Main ---

async function main() {
  const argv = await parser.argv;

  if (!argv.chain) {
    console.log(
      "Warning: no --chain specified, testing all chains (this may be slow)\n",
    );
  }

  // Create Lazer client once
  const lazer = await PythLazerClient.create({ token: argv["lazer-token"] });

  // Build variant matrix
  const variants = buildVariants();
  console.log(`Fetching ${variants.length} payload variants from Lazer API...`);

  // Fetch all payloads upfront
  const payloads = new Map<string, { buffer: Buffer; variant: PayloadVariant }>();
  for (const variant of variants) {
    try {
      const buf = await fetchEvmPayload(lazer, variant);
      payloads.set(variant.name, { buffer: buf, variant });
      console.log(`  ${variant.name}: ${buf.length} bytes`);
    } catch (error) {
      console.error(
        `  ${variant.name}: FETCH ERROR - ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(`\nFetched ${payloads.size}/${variants.length} payloads\n`);

  if (payloads.size === 0) {
    console.error("No payloads fetched, exiting.");
    process.exit(1);
  }

  // Collect results
  const chainInfos: ChainInfo[] = [];
  const results: VerifyResult[] = [];

  // Iterate chains
  for (const contract of Object.values(DefaultStore.lazer_contracts)) {
    if (!(contract instanceof EvmLazerContract)) continue;
    if (contract.chain.isMainnet() === argv.testnet) continue;
    if (argv.chain && !contract.chain.getId().includes(argv.chain)) continue;

    const chainId = contract.chain.getId();
    console.log(`\nChecking ${chainId}...`);

    // Get chain info once
    let owner = "?";
    let version = "unknown";
    let fee = "?";
    let web3Contract;
    try {
      web3Contract = contract.getContract();
      owner = await contract.getOwner();
      try {
        version = await contract.getVersion();
      } catch {
        /* old deployments may not have this method */
      }
      fee = (await web3Contract.methods.verification_fee().call()).toString();

      chainInfos.push({
        chain: chainId,
        address: contract.address,
        version,
        owner,
        fee,
      });
    } catch (error) {
      console.error(
        `  ${chainId}: ERROR getting chain info - ${error instanceof Error ? error.message : String(error)}`,
      );
      chainInfos.push({
        chain: chainId,
        address: contract.address,
        version,
        owner,
        fee,
      });
      continue;
    }

    // Test each payload variant
    for (const [variantName, { buffer }] of payloads) {
      try {
        // Verify the signed payload on-chain (static call, no tx)
        const result = await web3Contract.methods
          .verifyUpdate(buffer)
          .call({ value: fee });
        const signer: string = result.signer;
        const isValid: boolean = await web3Contract.methods
          .isValidSigner(signer)
          .call();

        // Estimate gas
        let gasUsed = "?";
        try {
          const gasEstimate = await web3Contract.methods
            .verifyUpdate(buffer)
            .estimateGas({ value: fee });
          gasUsed = gasEstimate.toString();
        } catch {
          /* estimateGas may fail on some chains */
        }

        results.push({
          chain: chainId,
          variant: variantName,
          payloadBytes: buffer.length,
          gasUsed,
          signerValid: isValid,
          status: isValid ? "OK" : "SIGNER NOT VALID",
        });

        console.log(
          `  ${variantName}: ${isValid ? "OK" : "SIGNER NOT VALID"} (${buffer.length}B, gas: ${gasUsed})`,
        );
      } catch (error) {
        results.push({
          chain: chainId,
          variant: variantName,
          payloadBytes: buffer.length,
          gasUsed: "?",
          signerValid: false,
          status: `ERROR: ${error instanceof Error ? error.message : String(error)}`,
        });
        console.error(
          `  ${variantName}: ERROR - ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  // --- Summary output ---

  console.log("\n\n=== Chain Info ===");
  console.table(chainInfos);

  console.log("\n=== Detailed Results ===");
  console.table(results);

  // Final summary
  const totalChains = chainInfos.length;
  const totalVariants = payloads.size;
  const totalTests = results.length;
  const passed = results.filter((r) => r.status === "OK").length;
  const failed = totalTests - passed;

  const gasValues = results
    .map((r) => r.gasUsed)
    .filter((g) => g !== "?")
    .map(Number)
    .filter((n) => !isNaN(n));

  console.log("\n=== Summary ===");
  console.log(`Chains tested:    ${totalChains}`);
  console.log(`Variants/chain:   ${totalVariants}`);
  console.log(`Total tests:      ${totalTests}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);

  if (gasValues.length > 0) {
    const minGas = Math.min(...gasValues);
    const maxGas = Math.max(...gasValues);
    const avgGas = Math.round(
      gasValues.reduce((a, b) => a + b, 0) / gasValues.length,
    );
    console.log(`Gas (min):        ${minGas}`);
    console.log(`Gas (max):        ${maxGas}`);
    console.log(`Gas (avg):        ${avgGas}`);
  }

  if (failed > 0) {
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
