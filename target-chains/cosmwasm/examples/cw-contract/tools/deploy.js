import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import {
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
} from "@terra-money/terra.js";
import { readFileSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { zeroPad } from "ethers/lib/utils.js";
import axios from "axios";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import assert from "assert";

export const TERRA_GAS_PRICES_URL = "https://fcd.terra.dev/v1/txs/gas_prices";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description: "Which network to deploy to",
    choices: ["testnet"],
    required: true,
  })
  .option("artifact", {
    description: "Path to Pyth Example artifact",
    type: "string",
    required: false,
  })
  .option("mnemonic", {
    description: "Mnemonic (private key)",
    type: "string",
    required: true,
  })
  .option("instantiate", {
    description: "Instantiate contract if set (default: disabled)",
    type: "boolean",
    default: false,
    required: false,
  })
  .option("migrate", {
    description: "Migrate an existing contract if set (default: disabled)",
    type: "boolean",
    default: false,
    required: false,
  })
  .option("contract", {
    description: "Contract address, used only for migration",
    type: "string",
    required: false,
    default: "",
  })
  .option("code-id", {
    description:
      "Code Id, if provided this will be used for migrate/instantiate and no code will be uploaded",
    type: "number",
    requred: false,
  })
  .help()
  .alias("help", "h").argv;

const artifact = argv.artifact;

/* Set up terra client & wallet. It won't fail because inputs are validated with yargs */

const CONFIG = {
  testnet: {
    terraHost: {
      URL: "https://bombay-lcd.terra.dev",
      chainID: "bombay-12",
      name: "testnet",
    },
    pythContractAddress: "terra1wzs3rgzgjdde3kg7k3aaz6qx7sc5dcwxqe9fuc",
    // Change this field to change which price feed is read by the deployed contract.
    // The current value is the LUNA/USD price feed.
    pythPriceFeedId:
      "6de025a4cf28124f8ea6cb8085f860096dbc36d9c40002e221fc449337e065b2",
  },
};

const terraHost = CONFIG[argv.network].terraHost;
const pythContractAddress = CONFIG[argv.network].pythContractAddress;
const pythPriceFeedId = CONFIG[argv.network].pythPriceFeedId;

const lcd = new LCDClient(terraHost);

const feeDenoms = ["uluna"];

const gasPrices = await axios
  .get(TERRA_GAS_PRICES_URL)
  .then((result) => result.data);

const wallet = lcd.wallet(
  new MnemonicKey({
    mnemonic: argv.mnemonic,
  })
);

/* Deploy artifacts */

var codeId;

if (argv.codeId !== undefined) {
  codeId = argv.codeId;
} else {
  if (argv.artifact === undefined) {
    console.error(
      "Artifact is not provided. Please at least provide artifact or code id"
    );
    process.exit(1);
  }

  const contract_bytes = readFileSync(artifact);
  console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

  const store_code = new MsgStoreCode(
    wallet.key.accAddress,
    contract_bytes.toString("base64")
  );

  const feeEstimate = await lcd.tx.estimateFee(
    wallet.key.accAddress,
    [store_code],
    {
      feeDenoms,
      gasPrices,
    }
  );

  console.log("Deploy fee: ", feeEstimate.amount.toString());

  const tx = await wallet.createAndSignTx({
    msgs: [store_code],
    feeDenoms,
    gasPrices,
    fee: feeEstimate,
  });

  const rs = await lcd.tx.broadcast(tx);

  try {
    const ci = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)[1];
    codeId = parseInt(ci);
  } catch (e) {
    console.error(
      "Encountered an error in parsing deploy code result. Printing raw log"
    );
    console.error(rs.raw_log);
    throw e;
  }

  console.log("Code ID: ", codeId);

  if (argv.instantiate || argv.migrate) {
    console.log("Sleeping for 10 seconds for store transaction to finalize.");
    await sleep(10000);
  }
}

if (argv.instantiate) {
  console.log("Instantiating a contract");

  async function instantiate(codeId, inst_msg) {
    var address;
    await wallet
      .createAndSignTx({
        msgs: [
          new MsgInstantiateContract(
            wallet.key.accAddress,
            wallet.key.accAddress,
            codeId,
            inst_msg
          ),
        ],
      })
      .then((tx) => lcd.tx.broadcast(tx))
      .then((rs) => {
        try {
          address = /"contract_address","value":"([^"]+)/gm.exec(rs.raw_log)[1];
        } catch (e) {
          console.error(
            "Encountered an error in parsing instantiation result. Printing raw log"
          );
          console.error(rs.raw_log);
          throw e;
        }
      });
    console.log(
      `Instantiated Pyth Example at ${address} (${convert_terra_address_to_hex(
        address
      )})`
    );
    return address;
  }

  const contractAddress = await instantiate(codeId, {
    price_feed_id: pythPriceFeedId,
    pyth_contract_addr: pythContractAddress,
  });

  console.log(`Deployed pyth example contract at ${contractAddress}`);
}

if (argv.migrate) {
  if (argv.contract === "") {
    console.error(
      "Contract address is not provided. Provide it using --contract"
    );
    process.exit(1);
  }

  console.log(`Migrating contract ${argv.contract} to ${codeId}`);

  const tx = await wallet.createAndSignTx({
    msgs: [
      new MsgMigrateContract(
        wallet.key.accAddress,
        argv.contract,
        codeId,
        {
          action: "",
        },
        { uluna: 1000 }
      ),
    ],
    feeDenoms,
    gasPrices,
  });

  const rs = await lcd.tx.broadcast(tx);
  var resultCodeId;
  try {
    resultCodeId = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)[1];
    assert.equal(codeId, resultCodeId);
  } catch (e) {
    console.error(
      "Encountered an error in parsing migration result. Printing raw log"
    );
    console.error(rs.raw_log);
    throw e;
  }

  console.log(
    `Contract ${argv.contract} code_id successfully updated to ${resultCodeId}`
  );
}

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
