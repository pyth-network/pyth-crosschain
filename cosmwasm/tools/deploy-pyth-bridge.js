import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import {
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
} from "@terra-money/terra.js";
import { readFileSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { zeroPad } from "ethers/lib/utils.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import assert from "assert";

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
      URL: "https://phoenix-lcd.terra.dev",
      chainID: "phoenix-1",
      name: "mainnet",
    },
    pyth_config: {
      wormhole_contract:
        "terra12mrnzvhx3rpej6843uge2yyfppfyd3u9c3uq223q8sl48huz9juqffcnh",
      data_sources: [
        {
          emitter: Buffer.from(
            "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
            "hex"
          ).toString("base64"),
          chain_id: 1,
        },
        {
          emitter: Buffer.from(
            "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
            "hex"
          ).toString("base64"),
          chain_id: 26,
        },
      ],
      governance_source: {
        emitter: Buffer.from(
          "5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
      governance_source_index: 0,
      governance_sequence_number: 0,
      chain_id: 18,
      valid_time_period_secs: 60,
      fee: {
        amount: "1",
        denom: "uluna",
      },
    },
  },
  testnet: {
    terraHost: {
      URL: "https://pisco-lcd.terra.dev",
      chainID: "pisco-1",
      name: "testnet",
    },
    pyth_config: {
      wormhole_contract:
        "terra19nv3xr5lrmmr7egvrk2kqgw4kcn43xrtd5g0mpgwwvhetusk4k7s66jyv0",
      data_sources: [
        {
          emitter: Buffer.from(
            "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
            "hex"
          ).toString("base64"),
          chain_id: 1,
        },
        {
          emitter: Buffer.from(
            "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6",
            "hex"
          ).toString("base64"),
          chain_id: 26,
        },
      ],
      governance_source: {
        emitter: Buffer.from(
          "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
      governance_source_index: 0,
      governance_sequence_number: 0,
      chain_id: 18,
      valid_time_period_secs: 60,
      fee: {
        amount: "1",
        denom: "uluna",
      },
    },
  },
};

const terraHost = CONFIG[argv.network].terraHost;
const pythConfig = CONFIG[argv.network].pyth_config;
const lcd = new LCDClient(terraHost);

const feeDenoms = ["uluna"];

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

  const tx = await wallet.createAndSignTx({
    msgs: [store_code],
    feeDenoms,
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

  async function instantiate(codeId, inst_msg, label) {
    var address;
    await wallet
      .createAndSignTx({
        msgs: [
          new MsgInstantiateContract(
            wallet.key.accAddress,
            wallet.key.accAddress,
            codeId,
            inst_msg,
            undefined,
            label
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

  const contractAddress = await instantiate(codeId, pythConfig, "pyth");

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
