import { HermesClient } from "@pythnetwork/hermes-client";
import { calculateUpdatePriceFeedsFee } from "@pythnetwork/pyth-ton-js";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import type { NetworkProvider } from "@ton/blueprint";
import { compile, sleep } from "@ton/blueprint";
import { toNano } from "@ton/core";
import { BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID } from "../tests/utils/pyth";
import {
  GOVERNANCE_DATA_SOURCE,
  GUARDIAN_SET_0,
  MAINNET_UPGRADE_VAAS,
} from "../tests/utils/wormhole";
import type { MainConfig } from "../wrappers/Main";
import { Main } from "../wrappers/Main";

export async function run(provider: NetworkProvider) {
  const SINGLE_UPDATE_FEE = 1;
  const DATA_SOURCES: DataSource[] = [
    {
      emitterAddress:
        "e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71",
      emitterChain: 26,
    },
  ];

  // Require CHAIN_ID environment variable
  if (!process.env.CHAIN_ID) {
    throw new Error(
      "CHAIN_ID environment variable is required. Example usage: CHAIN_ID=2 npx blueprint run ...",
    );
  }

  const chainId = Number.parseInt(process.env.CHAIN_ID, 10);

  // Validate that chainId is a valid number
  if (isNaN(chainId)) {
    throw new Error("CHAIN_ID must be a valid number");
  }

  const config: MainConfig = {
    chainId,
    dataSources: DATA_SOURCES,
    governanceChainId: 1,
    governanceContract:
      "0000000000000000000000000000000000000000000000000000000000000004",
    governanceDataSource: GOVERNANCE_DATA_SOURCE,
    guardianSet: GUARDIAN_SET_0,
    guardianSetIndex: 0,
    singleUpdateFee: SINGLE_UPDATE_FEE,
  };

  const main = provider.open(
    Main.createFromConfig(config, await compile("Main")),
  );

  await main.sendDeploy(provider.sender(), toNano("0.005"));

  await provider.waitForDeploy(main.address);

  // Call sendUpdateGuardianSet for each VAA
  const currentGuardianSetIndex = await main.getCurrentGuardianSetIndex();

  for (let i = currentGuardianSetIndex; i < MAINNET_UPGRADE_VAAS.length; i++) {
    const vaa = MAINNET_UPGRADE_VAAS[i]!;

    const vaaBuffer = Buffer.from(vaa, "hex");
    await main.sendUpdateGuardianSet(provider.sender(), vaaBuffer);
    await sleep(30_000);

    // Verify the update
    const newIndex = await main.getCurrentGuardianSetIndex();
    if (newIndex !== i + 1) {
      break;
    }
  }

  // Initialize HermesClient
  const hermesEndpoint = "https://hermes.pyth.network";
  const hermesClient = new HermesClient(hermesEndpoint);

  // Fetch latest price updates for BTC and ETH
  const priceIds = [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID];
  const latestPriceUpdates = await hermesClient.getLatestPriceUpdates(
    priceIds,
    { encoding: "hex" },
  );

  const binaryData = latestPriceUpdates.binary.data[0];

  if (binaryData === undefined) {
    throw new Error("No price updates available from Hermes");
  }

  // Combine updates into a single buffer
  const updateData = Buffer.from(binaryData, "hex");

  const _singleUpdateFee = await main.getSingleUpdateFee();

  // NOTE: As of 2024/10/14 There's a bug with TON Access (https://ton.access.orbs.network) RPC service where if you provide an update data buffer with length of more than ~320 then the rpc returns error 404 and the function fails
  const updateFee = await main.getUpdateFee(updateData);

  const totalFee =
    calculateUpdatePriceFeedsFee(BigInt(updateFee)) + BigInt(updateFee);

  const _result = await main.sendUpdatePriceFeeds(
    provider.sender(),
    updateData,
    totalFee,
  );
  await sleep(30_000);

  // Query updated price feeds
  const _btcPrice = await main.getPriceUnsafe(BTC_PRICE_FEED_ID);

  const _ethPrice = await main.getPriceUnsafe(ETH_PRICE_FEED_ID);
}
