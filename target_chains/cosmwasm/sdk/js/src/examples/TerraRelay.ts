import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import axios from "axios";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { TerraPriceServiceConnection, CONTRACT_ADDR } from "../index";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description:
      "Network to relay on. Provide node url if you are using localterra",
    required: true,
    default: "testnet",
  })
  .option("endpoint", {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    required: true,
  })
  .option("pyth-contract", {
    description:
      "Pyth contract address. You should provide this value if you are using localterra",
    type: "string",
    required: false,
  })
  .option("price-ids", {
    description:
      "Space separated price feed ids (in hex) to fetch." +
      " e.g: f9c0172ba10dfa4d19088d...",
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

const CONFIG: Record<string, any> = {
  testnet: {
    terraHost: {
      URL: "https://bombay-lcd.terra.dev",
      chainID: "bombay-12",
      name: "testnet",
    },
  },
};

export const TERRA_GAS_PRICES_URL = "https://fcd.terra.dev/v1/txs/gas_prices";

let terraHost;
let pythContractAddr: string;

if (CONFIG[argv.network] !== undefined) {
  terraHost = CONFIG[argv.network].terraHost;
  pythContractAddr = CONTRACT_ADDR[argv.network];
} else {
  terraHost = {
    URL: argv.network,
    chainID: "localterra",
    name: "localterra",
  };
  if (argv.pythContract === undefined) {
    throw new Error(
      "You should provide pyth contract address when using localterra"
    );
  }
  pythContractAddr = argv.pythContract;
}

const feeDenoms = ["uluna"];

const connection = new TerraPriceServiceConnection(argv.endpoint);
const lcd = new LCDClient(terraHost);
const wallet = lcd.wallet(
  new MnemonicKey({
    mnemonic: argv.mnemonic,
  })
);
const priceIds = argv.priceIds as string[];

async function run() {
  const priceFeeds = await connection.getLatestPriceFeeds(priceIds);
  console.log(priceFeeds);

  const gasPrices = await axios
    .get(TERRA_GAS_PRICES_URL)
    .then((result) => result.data);

  const msgs = await connection.getPriceUpdateMessages(
    priceIds,
    pythContractAddr,
    wallet.key.accAddress
  );
  console.log(msgs);

  const feeEstimate = await lcd.tx.estimateFee(
    [
      {
        sequenceNumber: await wallet.sequence(),
      },
    ],
    {
      msgs: msgs,
      feeDenoms,
      gasPrices,
    }
  );

  const tx = await wallet.createAndSignTx({
    msgs: msgs,
    feeDenoms,
    gasPrices,
    fee: feeEstimate,
  });

  const rs = await lcd.tx.broadcastSync(tx);
  console.log("Relay successful.", rs.txhash);
}

run();
