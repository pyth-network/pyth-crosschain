import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmPriceServiceConnection } from "../index";
import HDWalletProvider from "@truffle/hdwallet-provider";
import PythInterfaceAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description: "RPC of the network to relay on.",
    type: "string",
    required: true,
  })
  .option("endpoint", {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    required: true,
  })
  .option("pyth-contract", {
    description: "Pyth contract address.",
    type: "string",
    required: true,
  })
  .option("price-ids", {
    description:
      "Space separated price feed ids (in hex) to fetch" +
      " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "array",
    required: true,
  })
  .option("mnemonic", {
    description: "Mnemonic (private key) for sender",
    type: "string",
    required: true,
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();

const network = argv.network;
const pythContractAddr = argv.pythContract;

const connection = new EvmPriceServiceConnection(argv.endpoint);

async function run() {
  const provider = new HDWalletProvider({
    mnemonic: {
      phrase: argv.mnemonic,
    },
    providerOrUrl: network,
  });

  // @ts-ignore
  const web3 = new Web3(provider);
  const priceIds = argv.priceIds as string[];

  const priceFeeds = await connection.getLatestPriceFeeds(priceIds);
  console.log(priceFeeds);

  const priceFeedUpdateData =
    await connection.getPriceFeedsUpdateData(priceIds);
  console.log(priceFeedUpdateData);

  const pythContract = new web3.eth.Contract(
    PythInterfaceAbi as any,
    pythContractAddr,
    {
      from: provider.getAddress(0),
    },
  );

  const updateFee = await pythContract.methods
    .getUpdateFee(priceFeedUpdateData)
    .call();
  console.log(`Update fee: ${updateFee}`);

  let txHash = undefined;
  await pythContract.methods
    .updatePriceFeeds(priceFeedUpdateData)
    .send({ value: updateFee })
    .on("transactionHash", (hash: string) => {
      txHash = hash;
    })
    .on("error", (err: any, receipt: any) => {
      console.error(receipt);
      throw err;
    });

  console.log(`Tx hash: ${txHash}`);
  if (txHash === undefined) {
    console.error("Something went wrong. Could not send price update tx.");
  } else {
    console.log("Awaiting tx confirmation...");
    let receipt = undefined;
    while (!receipt) {
      receipt = await web3.eth.getTransactionReceipt(txHash);
    }

    // For on-chain use, you will typically perform the getPriceNoOlderThan call within the same transaction as updatePriceFeeds.
    // The call to getPriceNoOlderThan below simply demonstrates that the on-chain price was in fact updated.
    // Note that the code above for waiting for tx confirmation is a little flaky -- if so, you may see an old price printed here.
    for (const priceId of priceIds) {
      const [price, conf, expo, publishTime] = await pythContract.methods
        .getPriceNoOlderThan(priceId, 60) // 60 seconds staleness tolerance
        .call();
      console.log(
        `Updated ${priceId} to (${price} +- ${conf}) * 10^${expo} at unix timestamp ${publishTime}`,
      );
    }
  }

  provider.engine.stop();
}

run();
