/** biome-ignore-all lint/suspicious/noConsole: e2e test script */

import { execSync } from "node:child_process";
import process from "node:process";

import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const NETWORK = "testnet";
const PAYLOAD_MAGIC = 0x93c7d375;

const CHANNEL_NAMES: Record<number, string> = {
  1: "RealTime",
  2: "FixedRate50ms",
  3: "FixedRate200ms",
  4: "FixedRate1000ms",
};

const { secret, "contract-id": contractIdArg } = await yargs(
  hideBin(process.argv),
)
  .option("secret", {
    description:
      "Stellar secret key (S...). If omitted, a new keypair is generated and funded.",
    type: "string",
  })
  .option("contract-id", {
    description:
      "Lazer contract ID to test against. Deploy separately using deploy.sh first.",
    type: "string",
    demandOption: true,
  })
  .help()
  .parseAsync();

const { PYTH_LAZER_TOKEN } = process.env;
if (!PYTH_LAZER_TOKEN) {
  throw new Error(
    "'PYTH_LAZER_TOKEN' environment variable must be set to your Lazer auth token.",
  );
}

function stellarCmd(args: string): string {
  const cmd = `stellar ${args}`;
  console.log(`  $ ${cmd}`);
  const out = execSync(cmd, {
    encoding: "utf-8",
    timeout: 120_000,
  }).trim();
  if (out) console.log(`  ${out}`);
  return out;
}

function readLeU16(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

function readLeU32(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

function readLeI64(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

function readLeU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

/** Parse the verified payload and print price feed data. */
function parseAndPrintPayload(hexPayload: string): void {
  const buf = Buffer.from(hexPayload, "hex");
  let offset = 0;

  // Magic
  const magic = readLeU32(buf, offset);
  offset += 4;
  if (magic !== PAYLOAD_MAGIC) {
    throw new Error(
      `Invalid payload magic: 0x${magic.toString(16)} (expected 0x${PAYLOAD_MAGIC.toString(16)})`,
    );
  }
  console.log(`  Payload magic: 0x${magic.toString(16)} (valid)`);

  // Timestamp (microseconds since epoch)
  const timestampUs = readLeU64(buf, offset);
  offset += 8;
  const timestampMs = Number(timestampUs / 1000n);
  console.log(
    `  Timestamp: ${timestampUs} us (${new Date(timestampMs).toISOString()})`,
  );

  // Channel
  const channelId = buf[offset];
  offset += 1;
  console.log(
    `  Channel: ${channelId} (${CHANNEL_NAMES[channelId] ?? "Unknown"})`,
  );

  // Number of feeds
  const numFeeds = buf[offset];
  offset += 1;
  console.log(`  Number of feeds: ${numFeeds}`);

  if (numFeeds === 0) {
    throw new Error("Payload contains zero feeds");
  }

  for (let f = 0; f < numFeeds; f++) {
    const feedId = readLeU32(buf, offset);
    offset += 4;
    const numProps = buf[offset];
    offset += 1;
    console.log(`\n  Feed #${f}: id=${feedId}, properties=${numProps}`);

    for (let p = 0; p < numProps; p++) {
      const propId = buf[offset];
      offset += 1;

      switch (propId) {
        case 0: {
          // Price (i64)
          const price = readLeI64(buf, offset);
          offset += 8;
          console.log(
            `    [${propId}] Price: ${price}${price === 0n ? " (absent)" : ""}`,
          );
          break;
        }
        case 1: {
          // BestBidPrice (i64)
          const val = readLeI64(buf, offset);
          offset += 8;
          console.log(`    [${propId}] BestBidPrice: ${val}`);
          break;
        }
        case 2: {
          // BestAskPrice (i64)
          const val = readLeI64(buf, offset);
          offset += 8;
          console.log(`    [${propId}] BestAskPrice: ${val}`);
          break;
        }
        case 3: {
          // PublisherCount (u16)
          const val = readLeU16(buf, offset);
          offset += 2;
          console.log(`    [${propId}] PublisherCount: ${val}`);
          break;
        }
        case 4: {
          // Exponent (i16)
          const val = buf.readInt16LE(offset);
          offset += 2;
          console.log(`    [${propId}] Exponent: ${val}`);
          break;
        }
        case 5: {
          // Confidence (u64)
          const val = readLeU64(buf, offset);
          offset += 8;
          console.log(`    [${propId}] Confidence: ${val}`);
          break;
        }
        case 6: {
          // FundingRate (bool + i64)
          const exists = buf[offset];
          offset += 1;
          if (exists) {
            const val = readLeI64(buf, offset);
            offset += 8;
            console.log(`    [${propId}] FundingRate: ${val}`);
          } else {
            console.log(`    [${propId}] FundingRate: (absent)`);
          }
          break;
        }
        case 7: {
          // FundingTimestamp (bool + u64)
          const exists = buf[offset];
          offset += 1;
          if (exists) {
            const val = readLeU64(buf, offset);
            offset += 8;
            console.log(`    [${propId}] FundingTimestamp: ${val}`);
          } else {
            console.log(`    [${propId}] FundingTimestamp: (absent)`);
          }
          break;
        }
        case 8: {
          // FundingRateInterval (bool + u64)
          const exists = buf[offset];
          offset += 1;
          if (exists) {
            const val = readLeU64(buf, offset);
            offset += 8;
            console.log(`    [${propId}] FundingRateInterval: ${val}`);
          } else {
            console.log(`    [${propId}] FundingRateInterval: (absent)`);
          }
          break;
        }
        case 9: {
          // MarketSession (u16)
          const val = readLeU16(buf, offset);
          offset += 2;
          const sessions = [
            "Regular",
            "PreMarket",
            "PostMarket",
            "OverNight",
            "Closed",
          ];
          console.log(
            `    [${propId}] MarketSession: ${sessions[val] ?? val}`,
          );
          break;
        }
        case 10: {
          // EmaPrice (i64)
          const val = readLeI64(buf, offset);
          offset += 8;
          console.log(`    [${propId}] EmaPrice: ${val}`);
          break;
        }
        case 11: {
          // EmaConfidence (u64)
          const val = readLeU64(buf, offset);
          offset += 8;
          console.log(`    [${propId}] EmaConfidence: ${val}`);
          break;
        }
        case 12: {
          // FeedUpdateTimestamp (bool + u64)
          const exists = buf[offset];
          offset += 1;
          if (exists) {
            const val = readLeU64(buf, offset);
            offset += 8;
            console.log(`    [${propId}] FeedUpdateTimestamp: ${val}`);
          } else {
            console.log(`    [${propId}] FeedUpdateTimestamp: (absent)`);
          }
          break;
        }
        default:
          console.log(`    [${propId}] Unknown property`);
      }
    }
  }
}

// --- Step 1: Set up Stellar keypair ---
let stellarSecret: string;
let accountId: string;
if (secret) {
  stellarSecret = secret;
  console.log("=== Using provided keypair ===");
  const { Keypair } = await import("@stellar/stellar-sdk");
  accountId = Keypair.fromSecret(stellarSecret).publicKey();
  console.log(`  Account: ${accountId}`);
} else {
  const { Keypair } = await import("@stellar/stellar-sdk");
  console.log("=== Generating Stellar test keypair ===");
  const kp = Keypair.random();
  stellarSecret = kp.secret();
  accountId = kp.publicKey();
  console.log(`  Account: ${accountId}`);

  console.log("\n=== Funding account via Stellar friendbot ===");
  const fundResp = await fetch(
    `https://friendbot.stellar.org?addr=${accountId}`,
  );
  if (fundResp.ok) {
    console.log("  Account funded.");
  } else {
    console.log(
      `  Friendbot returned ${fundResp.status} (account may already be funded).`,
    );
  }
}

// --- Step 2: Use the provided contract ID ---
const contractId = contractIdArg;
console.log(`\n=== Using Lazer contract: ${contractId} ===`);

// --- Step 3: Fetch real price update from Pyth Lazer ---
console.log("\n=== Fetching real price update from Pyth Lazer ===");
const lazer = await PythLazerClient.create({ token: PYTH_LAZER_TOKEN });
let updateHex: string;

try {
  const response = await lazer.getLatestPrice({
    channel: "fixed_rate@200ms",
    formats: ["leEcdsa"],
    jsonBinaryEncoding: "hex",
    priceFeedIds: [1],
    properties: ["price"],
  });

  const hex = response.leEcdsa?.data;
  if (!hex) {
    console.error("  Response:", JSON.stringify(response, null, 2));
    throw new Error("No leEcdsa data in response");
  }
  updateHex = hex;

  const update = Buffer.from(updateHex, "hex");
  console.log(`  Update size: ${update.length} bytes`);
  console.log(`  Update hex (first 80 chars): ${updateHex.slice(0, 80)}...`);
} finally {
  lazer.close?.();
}

// --- Step 4: Verify the real update on-chain ---
console.log("\n=== Calling verify_update with real Lazer payload ===");
const result = stellarCmd(
  `contract invoke --id ${contractId} --network ${NETWORK} --source ${stellarSecret} --send=yes -- verify_update --data ${updateHex}`,
);

// --- Step 5: Validate the result ---
console.log("\n=== Validating verify_update result ===");
if (!result || result.length === 0) {
  console.error("ERROR: verify_update returned empty result");
  process.exit(1);
}

// The result from stellar CLI for a Bytes return type is typically a hex string or JSON.
// Strip any surrounding quotes if present.
let payloadHex = result.replace(/^["']|["']$/g, "");
// If the result looks like a JSON string, parse it
if (payloadHex.startsWith('"')) {
  payloadHex = JSON.parse(payloadHex) as string;
}

console.log(`  Result length: ${payloadHex.length} hex chars`);
console.log(`  Result (first 80 chars): ${payloadHex.slice(0, 80)}...`);

if (payloadHex.length < 28) {
  // Minimum: 4 (magic) + 8 (timestamp) + 1 (channel) + 1 (num_feeds) = 14 bytes = 28 hex chars
  console.error(
    `ERROR: Payload too short (${payloadHex.length} hex chars, need at least 28)`,
  );
  process.exit(1);
}

// --- Step 6: Parse and print payload data ---
console.log("\n=== Parsing verified payload ===");
parseAndPrintPayload(payloadHex);

// --- Step 7: Get transaction hash from Horizon ---
console.log("\n=== Fetching transaction hash from Horizon ===");
try {
  const horizonUrl = `https://horizon-testnet.stellar.org/accounts/${accountId}/transactions?order=desc&limit=1`;
  const txResp = await fetch(horizonUrl);
  if (txResp.ok) {
    const txData = (await txResp.json()) as {
      _embedded?: { records?: Array<{ hash?: string }> };
    };
    const records = txData._embedded?.records;
    if (records && records.length > 0) {
      const txHash = records[0].hash;
      console.log(`  Transaction hash: ${txHash}`);
      console.log(
        `  Stellar Explorer: https://stellar.expert/explorer/testnet/tx/${txHash}`,
      );
    } else {
      console.log("  Warning: No transactions found for account on Horizon");
    }
  } else {
    console.log(
      `  Warning: Horizon returned ${txResp.status} when fetching transactions`,
    );
  }
} catch (err) {
  console.log(`  Warning: Could not fetch transaction hash: ${err}`);
}

// --- Done ---
console.log("\n=========================================");
console.log("=== END-TO-END TEST PASSED ===");
console.log("=========================================");
console.log(`\nLazer contract: ${contractId}`);
console.log(`Verified payload (hex): ${payloadHex}`);
console.log(
  "\nThe real Pyth Lazer price update was successfully verified on Stellar testnet!",
);
