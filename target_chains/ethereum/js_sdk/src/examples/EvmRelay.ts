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

  const web3 = new Web3(provider);
  const priceIds = argv.priceIds as string[];

  const priceFeeds = await connection.getLatestPriceFeeds(priceIds);
  console.log(priceFeeds);

  const [priceFeedUpdate, timestamp] = await connection.getVaa(
    priceIds[0],
    1676478812
  );
  const priceFeedUpdateData = [
    "0x" + Buffer.from(priceFeedUpdate, "base64").toString("hex"),
  ];

  /*
  const priceFeedUpdateData = await connection.getPriceFeedsUpdateData(
    priceIds
    );
    */
  console.log(priceFeedUpdateData);

  const pythContract = new web3.eth.Contract(
    PythInterfaceAbi as any,
    pythContractAddr,
    {
      from: provider.getAddress(0),
    }
  );

  const updateFee = await pythContract.methods
    .getUpdateFee(priceFeedUpdateData)
    .call();
  console.log(`Update fee: ${updateFee}`);

  /*
  pythContract.methods
    .parsePriceFeedUpdates(priceFeedUpdateData, priceIds, 0, 1776318382)
    .estimateGas({
       value: updateFee,
       gas: 1000000
     }, function (error: any, g: any) {
     console.log(`error: ${JSON.stringify(error)}`);
     console.log(`gas: ${g}`);
    });
  */

  pythContract.methods
    .parsePriceFeedUpdates(priceFeedUpdateData, priceIds, 0, 1776318382)
    .send({ value: updateFee, gas: 1000000 })
    .on("transactionHash", (hash: string) => {
      console.log(`Tx hash: ${hash}`);
    })
    .on("error", (err: any, receipt: any) => {
      console.error(receipt);
      throw err;
    });
  provider.engine.stop();
}

run();
