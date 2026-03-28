/** biome-ignore-all lint/suspicious/noConsole: e2e test script */

import { execSync } from "node:child_process";
import process from "node:process";

import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const NETWORK = "testnet";

const { contractId, secret } = await yargs(hideBin(process.argv))
  .option("contract-id", {
    demandOption: true,
    description: "Lazer contract ID on Stellar testnet",
    type: "string",
  })
  .option("secret", {
    description:
      "Stellar secret key (S...). If omitted, a new keypair is generated and funded.",
    type: "string",
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
  const out = execSync(cmd, { encoding: "utf-8", timeout: 120_000 }).trim();
  if (out) console.log(`  ${out}`);
  return out;
}

// --- Step 1: Set up Stellar keypair ---
let stellarSecret: string;
if (secret) {
  stellarSecret = secret;
  console.log("=== Using provided keypair ===");
} else {
  const { Keypair } = await import("@stellar/stellar-sdk");
  console.log("=== Generating Stellar test keypair ===");
  const kp = Keypair.random();
  stellarSecret = kp.secret();
  const accountId = kp.publicKey();
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

// --- Step 2: Fetch real price update from Pyth Lazer ---
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
} finally {
  lazer.close?.();
}

// --- Step 3: Verify the real update on-chain ---
console.log("\n=== Calling verify_update with real Lazer payload ===");
const result = stellarCmd(
  `contract invoke --id ${contractId} --network ${NETWORK} --source ${stellarSecret} -- verify_update --data ${updateHex}`,
);

console.log("\n=========================================");
console.log("=== END-TO-END TEST PASSED ===");
console.log("=========================================");
console.log(`\nLazer contract: ${contractId}`);
console.log(`Verified payload (hex): ${result}`);
console.log(
  "\nThe real Pyth Lazer price update was successfully verified on Stellar testnet!",
);
