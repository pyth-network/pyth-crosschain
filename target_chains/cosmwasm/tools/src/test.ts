import {
  CHAINS_NETWORK_CONFIG,
  createExecutorForChain,
} from "./chains-manager/chains";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Pipeline } from "./pipeline";
import { PythWrapperExecutor, PythWrapperQuerier } from "./pyth-wrapper";
import {
  DeploymentType,
  getChainIdsForEdgeDeployment,
  getChainIdsForStableDeployment,
  getPythContractAddress,
} from "./helper";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { CosmwasmQuerier } from "./chains-manager/chain-querier";
const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run wormhole-stub -- <command>")
  .option("mnemonic", {
    type: "string",
    demandOption: "Please provide the mnemonic",
  })
  .option("deploy", {
    type: "string",
    desc: "Execute this script for the given networks.",
    choices: ["mainnet", "testnet-stable", "testnet-edge"],
    demandOption: "Please provide the deployment type",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

async function run() {
  const STORAGE_DIR = `./${argv.deploy}/test-contracts`;

  let chainIds;
  if (argv.deploy === "stable") {
    chainIds = getChainIdsForStableDeployment();
  } else {
    chainIds = getChainIdsForEdgeDeployment();
  }

  for (let chainId of chainIds) {
    let chainConfig = CHAINS_NETWORK_CONFIG[chainId];
    const pipeline = new Pipeline(
      chainId,
      `${STORAGE_DIR}/${chainId}-1.2.0.json`
    );

    const chainExecutor = createExecutorForChain(chainConfig, argv.mnemonic);
    const pythExecutor = new PythWrapperExecutor(chainExecutor);
    const chainQuerier = await CosmwasmQuerier.connect(
      chainConfig.querierEndpoint
    );
    const pythQuerier = new PythWrapperQuerier(chainQuerier);

    const priceServiceConnection = new PriceServiceConnection(
      argv.deploy === "mainnet" || argv.deploy === "testnet-stable"
        ? "https://xc-mainnet.pyth.network"
        : "https://xc-testnet.pyth.network"
    );

    const priceFeedId =
      argv.deploy === "mainnet" || argv.deploy === "testnet-stable"
        ? "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
        : "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";

    const pythContractAddr = getPythContractAddress(
      chainId,
      "1.2.0",
      argv.deploy as DeploymentType
    );

    // add stages
    // 1 push price update
    pipeline.addStage({
      id: "push-price-update",
      executor: async () => {
        const vaas = await priceServiceConnection.getLatestVaas([priceFeedId]);

        const fund = await pythQuerier.getUpdateFee(pythContractAddr, vaas);

        return pythExecutor.executeUpdatePriceFeeds({
          contractAddr: pythContractAddr,
          vaas,
          fund,
        });
      },
    });

    // 2 fetch the updated price feed
    pipeline.addStage({
      id: "fetch-price-feed-update",
      executor: () => {
        return pythQuerier.getPriceFeed(pythContractAddr, priceFeedId);
      },
    });

    await pipeline.run();
  }
}

run();
