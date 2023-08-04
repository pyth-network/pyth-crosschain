"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const index_1 = require("../index");
const aptos_1 = require("aptos");
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .option("price-ids", {
    description: "Space separated price feed ids (in hex) to fetch" +
        " e.g: 0xf9c0172ba10dfa4d19088d...",
    type: "array",
    required: true,
})
    .option("price-service", {
    description: "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    required: true,
})
    .option("full-node", {
    description: "URL of the full Aptos node RPC endpoint.",
    type: "string",
    required: true,
})
    .option("pyth-contract", {
    description: "Pyth contract address.",
    type: "string",
    required: true,
})
    .help()
    .alias("help", "h")
    .parserConfiguration({
    "parse-numbers": false,
})
    .parseSync();
async function run() {
    // Fetch the latest price feed update data from the Price Service
    const connection = new index_1.AptosPriceServiceConnection(argv.priceService);
    const priceFeedUpdateData = await connection.getPriceFeedsUpdateData(argv.priceIds);
    // Update the Pyth Contract using this update data
    if (process.env.APTOS_KEY === undefined) {
        throw new Error(`APTOS_KEY environment variable should be set.`);
    }
    const sender = new aptos_1.AptosAccount(Buffer.from(process.env.APTOS_KEY, "hex"));
    const client = new aptos_1.AptosClient(argv.fullNode);
    const result = await client.generateSignSubmitWaitForTransaction(sender, new aptos_1.TxnBuilderTypes.TransactionPayloadEntryFunction(aptos_1.TxnBuilderTypes.EntryFunction.natural(argv.pythContract + "::pyth", "update_price_feeds_with_funder", [], [index_1.AptosPriceServiceConnection.serializeUpdateData(priceFeedUpdateData)])));
    console.dir(result, { depth: null });
}
run();
