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
  getTestPythContractFileName,
} from "./helper";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { CosmwasmQuerier } from "./chains-manager/chain-querier";
const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run test -- <command>")
  .option("mnemonic", {
    type: "string",
    demandOption: "Please provide the mnemonic",
  })
  .option("contract-version", {
    type: "string",
    description: `Please input the contract-version of the pyth contract.`,
    default: "1.2.0",
  })
  .option("deploy", {
    type: "string",
    desc: "test the following deployment type.",
    choices: ["stable", "edge"],
    demandOption: "Please provide the deployment type",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

async function run() {
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
      getTestPythContractFileName(
        chainId,
        argv.contractVersion,
        argv.deploy as DeploymentType
      )
    );

    const chainExecutor = await createExecutorForChain(
      chainConfig,
      argv.mnemonic
    );
    const pythExecutor = new PythWrapperExecutor(chainExecutor);
    const chainQuerier = await CosmwasmQuerier.connect(
      chainConfig.querierEndpoint
    );
    const pythQuerier = new PythWrapperQuerier(chainQuerier);

    const priceServiceConnection = new PriceServiceConnection(
      argv.deploy === "stable"
        ? "https://xc-mainnet.pyth.network"
        : "https://xc-testnet.pyth.network"
    );

    const priceFeedId =
      argv.deploy === "stable"
        ? "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
        : "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";

    const pythContractAddr = getPythContractAddress(
      chainId,
      argv.contractVersion,
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
