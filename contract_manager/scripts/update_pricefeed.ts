/** biome-ignore-all lint/suspicious/noConsole: CLI script */

/**
 * Pushes a price update to a price feed contract, proving the contract can verify what the given
 * endpoint serves.
 *
 * `--access-token` is what makes this usable against a Pyth Pro endpoint: Hermes accepts a token as
 * a `Bearer` header, and the client attaches it to every request. So the same command tests both
 * sides of a Pro cutover — the legacy endpoint before it, the Pro endpoint after — by changing only
 * `--endpoint` and `--access-token`.
 *
 * The on-chain price is read before and after, because a successful transaction is not by itself
 * proof: `updatePriceFeeds` accepts an update the contract already has and silently keeps the newer
 * value. A publish time that moved is the proof that this update was verified and stored.
 *
 * Usage: $0 --contract <contract_id> --feed-id <feed-id> --private-key <key> [--endpoint <url>]
 *          [--access-token <token>]
 */

import { HermesClient } from "@pythnetwork/hermes-client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PriceFeed, PriceFeedContract } from "../src/core/base";
import { toPrivateKey } from "../src/core/base";
import { DefaultStore } from "../src/node/utils/store";

const DEFAULT_ENDPOINT = "https://hermes.pyth.network";

const parser = yargs(hideBin(process.argv))
  .scriptName("update_pricefeed.ts")
  .usage(
    "Pushes a price update from a Hermes-compatible endpoint to a price feed contract.\n" +
      "Usage: $0 --contract <contract_id> --feed-id <feed-id> --private-key <private-key> " +
      "[--endpoint <url>] [--access-token <token>]",
  )
  .options({
    "access-token": {
      demandOption: false,
      desc: "Access token for the endpoint, sent as a Bearer token. Required by Pyth Pro endpoints",
      type: "string",
    },
    contract: {
      demandOption: true,
      desc: "Contract to update price feeds for (e.g sepolia_0xff1a0f4744e8582DF1aE09D5611b887B6a12925C)",
      type: "string",
    },
    "dry-run": {
      default: false,
      desc: "Fetch the update and read the contract, but send no transaction. Does not need a key",
      type: "boolean",
    },
    endpoint: {
      default: DEFAULT_ENDPOINT,
      desc: "Endpoint to fetch updates from",
      type: "string",
    },
    "feed-id": {
      demandOption: true,
      desc: "Price feed ids to update, with or without the leading 0x (e.g ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace). Can be provided multiple times",
      type: "array",
    },
    "private-key": {
      demandOption: false,
      desc: "Private key to sign the transaction with. Required unless --dry-run",
      type: "string",
    },
  });

function strip(feedId: string): string {
  return feedId.replace(/^0x/, "");
}

function describePriceFeed(feed: PriceFeed | undefined): string {
  if (feed === undefined) return "not present on this contract";
  const { price, expo, publishTime } = feed.price;
  return `price ${price} expo ${expo} publishTime ${publishTime}`;
}

/**
 * Reads and prints the stored price for each feed.
 * @param {PriceFeedContract} contract The price feed contract.
 * @param {string[]} feedIds The feeds to read, without a leading 0x.
 * @returns The publish time of each feed, keyed by feed id, for comparing before with after.
 */
async function printPrices(
  contract: PriceFeedContract,
  feedIds: string[],
): Promise<Record<string, string | undefined>> {
  const publishTimes: Record<string, string | undefined> = {};
  for (const feedId of feedIds) {
    const feed = await contract.getPriceFeed(feedId);
    publishTimes[feedId] = feed?.price.publishTime;
    console.log(`  ${feedId}: ${describePriceFeed(feed)}`);
  }
  return publishTimes;
}

async function main() {
  const argv = await parser.argv;

  if (!argv.dryRun && argv.privateKey === undefined) {
    throw new Error("--private-key is required unless --dry-run is set.");
  }

  const contract = DefaultStore.contracts[argv.contract];
  if (!contract) {
    throw new Error(
      `Contract ${argv.contract} not found. Contracts found: ${Object.keys(
        DefaultStore.contracts,
      ).join(" ")}`,
    );
  }
  const feedIds = (argv.feedId as string[]).map((feedId) => strip(feedId));

  console.log(`Contract ${contract.getId()}`);
  console.log(
    `Endpoint ${argv.endpoint}${argv.accessToken === undefined ? "" : " (with access token)"}`,
  );

  // Built conditionally: `exactOptionalPropertyTypes` rejects an explicit `accessToken: undefined`.
  const client = new HermesClient(
    argv.endpoint,
    argv.accessToken === undefined ? {} : { accessToken: argv.accessToken },
  );
  const update = await client.getLatestPriceUpdates(feedIds, {
    encoding: "base64",
    parsed: false,
  });
  const updateData = update.binary.data.map((data) =>
    Buffer.from(data, "base64"),
  );
  console.log(
    `\nFetched ${updateData.length} update(s), ${updateData.reduce((total, data) => total + data.length, 0)} bytes total`,
  );

  console.log("\nOn chain before:");
  const before = await printPrices(contract, feedIds);

  if (argv.dryRun) {
    console.log("\n--dry-run set, no transaction sent.");
    return;
  }
  if (argv.privateKey === undefined) {
    throw new Error("unreachable: no private key");
  }

  console.log("\nSubmitting...");
  const result = await contract.executeUpdatePriceFeed(
    toPrivateKey(argv.privateKey),
    updateData,
  );
  console.log(`Transaction ${result.id}`);

  console.log("\nOn chain after:");
  const after = await printPrices(contract, feedIds);

  // A transaction that reverts throws above, so reaching here means the contract verified the
  // update. An unmoved publish time means it was verified but not newer than what was stored.
  const unchanged = feedIds.filter(
    (feedId) => before[feedId] === after[feedId] && after[feedId] !== undefined,
  );
  if (unchanged.length > 0) {
    console.log(
      `\n! Publish time did not move for ${unchanged.join(", ")}. The update verified, but the ` +
        `contract already held a price at least as new.`,
    );
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
