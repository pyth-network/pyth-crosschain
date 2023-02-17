"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const web3_1 = __importDefault(require("web3"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const index_1 = require("../index");
const hdwallet_provider_1 = __importDefault(
  require("@truffle/hdwallet-provider")
);
const IPyth_json_1 = __importDefault(
  require("@pythnetwork/pyth-sdk-solidity/abis/IPyth.json")
);
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
const connection = new index_1.EvmPriceServiceConnection(argv.endpoint);
async function run() {
  const provider = new hdwallet_provider_1.default({
    mnemonic: {
      phrase: argv.mnemonic,
    },
    providerOrUrl: network,
  });
  const web3 = new web3_1.default(provider);
  const priceIds = argv.priceIds;
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
    IPyth_json_1.default,
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
    .on("transactionHash", (hash) => {
      console.log(`Tx hash: ${hash}`);
    })
    .on("error", (err, receipt) => {
      console.error(receipt);
      throw err;
    });
  provider.engine.stop();
}
run();
