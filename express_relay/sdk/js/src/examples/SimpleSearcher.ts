import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Client } from "../index";
import { privateKeyToAccount } from "viem/accounts";
import { isHex } from "viem";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const argv = yargs(hideBin(process.argv))
  .option("endpoint", {
    description:
      "Express relay endpoint. e.g: https://per-staging.dourolabs.app/",
    type: "string",
    demandOption: true,
  })
  .option("chain-id", {
    description: "Chain id to fetch opportunities for. e.g: sepolia",
    type: "string",
  })
  .option("bid", {
    description: "Bid amount in wei",
    type: "string",
    default: "100",
  })
  .option("private-key", {
    description:
      "Private key to sign the bid with in hex format with 0x prefix. e.g: 0xdeadbeef...",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function run() {
  const client = new Client({ baseUrl: argv.endpoint });
  if (isHex(argv.privateKey)) {
    const account = privateKeyToAccount(argv.privateKey);
    console.log(`Using account: ${account.address}`);
  } else {
    throw new Error(`Invalid private key: ${argv.privateKey}`);
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const opportunities = await client.getOpportunities(argv.chainId);
    console.log(`Fetched ${opportunities.length} opportunities`);
    for (const opportunity of opportunities) {
      const bid = BigInt(argv.bid);
      const bidInfo = {
        amount: bid,
        valid_until: BigInt(Math.round(Date.now() / 1000 + 60 * 60 * 24)),
      };
      const opportunityBid = await client.signOpporunityBid(
        opportunity,
        bidInfo,
        argv.privateKey
      );
      try {
        await client.submitOpportunityBid(opportunityBid);
        console.log(
          `Successful bid ${bid} on opportunity ${opportunity.opportunity_id}`
        );
      } catch (error) {
        console.error(
          `Failed to bid on opportunity ${opportunity.opportunity_id}: ${error}`
        );
      }
    }
    await sleep(5000);
  }
}

run();
