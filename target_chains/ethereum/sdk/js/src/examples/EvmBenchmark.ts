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
  .option("price-id", {
    description:
      "Price feed id (in hex) to fetch" + " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "string",
    required: true,
  })
  .option("timestamp", {
    description: "Timestamp of the prices to fetch" + " e.g., 2022-", // TODO
    type: "string",
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
  const priceId = argv.priceId as string;
  // The unix timestamp in seconds
  const unixTimestamp = Date.parse(argv.timestamp) / 1000;

  console.log(`Querying unix timestamp: ${unixTimestamp}`);

  const [priceFeedUpdateVaa, updateTimestamp] = await connection.getVaa(
    priceId,
    unixTimestamp,
  );
  console.log(`Next pyth update was at: ${updateTimestamp}`);
  console.log(priceFeedUpdateVaa);

  const priceFeedUpdate =
    "0x" + Buffer.from(priceFeedUpdateVaa, "base64").toString("hex");

  const pythContract = new web3.eth.Contract(
    PythInterfaceAbi as any,
    pythContractAddr,
    {
      from: provider.getAddress(0),
    },
  );

  const updateFee = await pythContract.methods
    .getUpdateFee([priceFeedUpdate])
    .call();
  console.log(`Update fee: ${updateFee}`);

  // In real use cases, you would pass the update to your contract, then call parsePriceFeedUpdates within your contract.
  // When invoked on-chain, this function will return a PriceFeed struct containing the data in the price update
  // (such as the current price).
  await pythContract.methods
    .parsePriceFeedUpdates(
      [priceFeedUpdate],
      [priceId],
      // parsePriceFeedUpdates will reject any price update outside of the time window provided in the following
      // two arguments. Integrators can use this to specify the timestamp of the update they are expecting.
      unixTimestamp,
      unixTimestamp + 5,
    )
    .send({ value: updateFee })
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
