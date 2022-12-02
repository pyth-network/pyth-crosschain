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
    choices: ["mainnet", "testnet"],
    required: true,
  })
  .option("artifact", {
    description: "Path to Pyth artifact",
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
  mainnet: {
    terraHost: {
      URL: "https://lcd.terra.dev",
      chainID: "columbus-5",
      name: "mainnet",
    },
    wormholeContract: "terra1dq03ugtd40zu9hcgdzrsq6z2z4hwhc9tqk2uy5",
    pythEmitterAddress:
      "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
  },
  testnet: {
    terraHost: {
      URL: "https://bombay-lcd.terra.dev",
      chainID: "bombay-12",
      name: "testnet",
    },
    wormholeContract: "terra1pd65m0q9tl3v8znnz5f5ltsfegyzah7g42cx5v",
    pythEmitterAddress:
      "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
  },
};

const terraHost = CONFIG[argv.network].terraHost;
const wormholeContract = CONFIG[argv.network].wormholeContract;
const pythEmitterAddress = CONFIG[argv.network].pythEmitterAddress;

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
      `Instantiated Pyth at ${address} (${convert_terra_address_to_hex(
        address
      )})`
    );
    return address;
  }

  const pythChain = 1;

  const contractAddress = await instantiate(codeId, {
    wormhole_contract: wormholeContract,
    pyth_emitter: Buffer.from(pythEmitterAddress, "hex").toString("base64"),
    pyth_emitter_chain: pythChain,
  });

  console.log(`Deployed Pyth contract at ${contractAddress}`);
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
