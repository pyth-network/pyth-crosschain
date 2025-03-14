import { toNano } from "@ton/core";
import { MainConfig } from "../wrappers/Main";
import { compile, NetworkProvider, sleep } from "@ton/blueprint";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Main } from "../wrappers/Main";
import {
  GOVERNANCE_DATA_SOURCE,
  GUARDIAN_SET_0,
  MAINNET_UPGRADE_VAAS,
} from "../tests/utils/wormhole";
import { BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID } from "../tests/utils/pyth";
import { calculateUpdatePriceFeedsFee } from "@pythnetwork/pyth-ton-js";

export async function run(provider: NetworkProvider) {
  const SINGLE_UPDATE_FEE = 1;
  const DATA_SOURCES: DataSource[] = [
    {
      emitterChain: 26,
      emitterAddress:
        "e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71",
    },
  ];

  // Require CHAIN_ID environment variable
  if (!process.env.CHAIN_ID) {
    throw new Error(
      "CHAIN_ID environment variable is required. Example usage: CHAIN_ID=2 npx blueprint run ...",
    );
  }

  const chainId = parseInt(process.env.CHAIN_ID, 10);

  // Validate that chainId is a valid number
  if (isNaN(chainId)) {
    throw new Error("CHAIN_ID must be a valid number");
  }

  console.log("Chain ID:", chainId);

  const config: MainConfig = {
    singleUpdateFee: SINGLE_UPDATE_FEE,
    dataSources: DATA_SOURCES,
    guardianSetIndex: 0,
    guardianSet: GUARDIAN_SET_0,
    chainId,
    governanceChainId: 1,
    governanceContract:
      "0000000000000000000000000000000000000000000000000000000000000004",
    governanceDataSource: GOVERNANCE_DATA_SOURCE,
  };

  const main = provider.open(
    Main.createFromConfig(config, await compile("Main")),
  );

  await main.sendDeploy(provider.sender(), toNano("0.005"));

  await provider.waitForDeploy(main.address);

  console.log("Main contract deployed at:", main.address.toString());

  // Call sendUpdateGuardianSet for each VAA
  const currentGuardianSetIndex = await main.getCurrentGuardianSetIndex();
  console.log(`Current guardian set index: ${currentGuardianSetIndex}`);

  for (let i = currentGuardianSetIndex; i < MAINNET_UPGRADE_VAAS.length; i++) {
    const vaa = MAINNET_UPGRADE_VAAS[i];
    const vaaBuffer = Buffer.from(vaa, "hex");
    await main.sendUpdateGuardianSet(provider.sender(), vaaBuffer);
    console.log(
      `Successfully updated guardian set ${i + 1} with VAA: ${vaa.slice(
        0,
        20,
      )}...`,
    );

    // Wait for 30 seconds before checking the guardian set index
    console.log("Waiting for 30 seconds before checking guardian set index...");
    await sleep(30000);

    // Verify the update
    const newIndex = await main.getCurrentGuardianSetIndex();
    if (newIndex !== i + 1) {
      console.error(
        `Failed to update guardian set. Expected index ${
          i + 1
        }, got ${newIndex}`,
      );
      break;
    }
  }

  console.log("Guardian set update process completed.");

  // Initialize HermesClient
  const hermesEndpoint = "https://hermes.pyth.network";
  const hermesClient = new HermesClient(hermesEndpoint);

  // Fetch latest price updates for BTC and ETH
  const priceIds = [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID];
  const latestPriceUpdates = await hermesClient.getLatestPriceUpdates(
    priceIds,
    { encoding: "hex" },
  );
  console.log("Hermes BTC price:", latestPriceUpdates.parsed?.[0].price);
  console.log("Hermes ETH price:", latestPriceUpdates.parsed?.[1].price);
  // Combine updates into a single buffer
  const updateData = Buffer.from(latestPriceUpdates.binary.data[0], "hex");
  console.log("Update data:", latestPriceUpdates.binary.data[0]);

  const singleUpdateFee = await main.getSingleUpdateFee();
  console.log("Single update fee:", singleUpdateFee);

  // NOTE: As of 2024/10/14 There's a bug with TON Access (https://ton.access.orbs.network) RPC service where if you provide an update data buffer with length of more than ~320 then the rpc returns error 404 and the function fails
  const updateFee = await main.getUpdateFee(updateData);

  const totalFee =
    calculateUpdatePriceFeedsFee(BigInt(updateFee)) + BigInt(updateFee);

  const result = await main.sendUpdatePriceFeeds(
    provider.sender(),
    updateData,
    totalFee,
  );
  console.log("Price feeds updated successfully.");

  console.log("Waiting for 30 seconds before checking price feeds...");
  await sleep(30000);

  // Query updated price feeds
  const btcPrice = await main.getPriceUnsafe(BTC_PRICE_FEED_ID);
  console.log(
    `Updated BTC price: ${btcPrice.price}, publish time: ${btcPrice.publishTime}`,
  );

  const ethPrice = await main.getPriceUnsafe(ETH_PRICE_FEED_ID);
  console.log(
    `Updated ETH price: ${ethPrice.price}, publish time: ${ethPrice.publishTime}`,
  );
}
