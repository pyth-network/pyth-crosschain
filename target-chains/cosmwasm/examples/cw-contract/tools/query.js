import { LCDClient } from "@terra-money/terra.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export const TERRA_GAS_PRICES_URL = "https://fcd.terra.dev/v1/txs/gas_prices";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description: "Which network to deploy to",
    choices: ["testnet"],
    required: true,
  })
  .option("contract", {
    description: "Contract address to query",
    type: "string",
    required: true,
  })
  .help()
  .alias("help", "h").argv;

/* Set up terra client & wallet. It won't fail because inputs are validated with yargs */

const CONFIG = {
  testnet: {
    terraHost: {
      URL: "https://bombay-lcd.terra.dev",
      chainID: "bombay-12",
      name: "testnet",
    },
  },
};

const lcd = new LCDClient(CONFIG[argv.network].terraHost);

let queryResult = await lcd.wasm.contractQuery(argv.contract, {
  fetch_price: {},
});
console.log(queryResult);
