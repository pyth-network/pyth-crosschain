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
import {hideBin} from "yargs/helpers";

export const TERRA_GAS_PRICES_URL = "https://fcd.terra.dev/v1/txs/gas_prices";

const argv = yargs(hideBin(process.argv))
  .option('network', {
    description: 'Which network to deploy to',
    choices: ['mainnet', 'testnet', 'localterra'],
    required: true
  })
  .option('artifact', {
    description: 'Path to Pyth artifact',
    type: 'string',
    required: true
  })
  .option('mnemonic', {
    description: 'Mnemonic (private key)',
    type: 'string',
    required: true
  })
  .option('instantiate', {
    description: 'Instantiate contract if set (default: disabled)',
    type: 'boolean',
    default: false,
    required: false
  })
  .option('migrate', {
    description: 'Migrate an existing contract if set (default: disabled)',
    type: 'boolean',
    default: false,
    required: false
  })
  .option('contract', {
    description: 'Contract address, used only for migration',
    type: 'string',
    required: false,
    default: ''
  })
  .help()
  .alias('help', 'h').argv;

const artifact = argv.artifact;

/* Set up terra client & wallet */

const terra_host =
      argv.network === "mainnet"
    ? {
        URL: "https://lcd.terra.dev",
        chainID: "columbus-5",
        name: "mainnet",
      }
    : argv.network === "testnet"
    ? {
        URL: "https://bombay-lcd.terra.dev",
        chainID: "bombay-12",
        name: "testnet",
      }
    : {
        URL: "http://localhost:1317",
        chainID: "columbus-5",
        name: "localterra",
      };

const lcd = new LCDClient(terra_host);

const feeDenoms = ["uluna"];

const gasPrices = await axios
  .get(TERRA_GAS_PRICES_URL)
  .then((result) => result.data);

const wallet = lcd.wallet(
  new MnemonicKey({
    mnemonic: argv.mnemonic
  })
);

await wallet.sequence();

/* Deploy artifacts */

let codeId;
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
    memo: "",
    feeDenoms,
    gasPrices,
  }
);

console.log("Deploy fee: ", feeEstimate.amount.toString());

const tx = await wallet.createAndSignTx({
  msgs: [store_code],
  memo: "",
  feeDenoms,
  gasPrices,
  fee: feeEstimate,
});

const rs = await lcd.tx.broadcast(tx);
const ci = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)[1];
codeId = parseInt(ci);

console.log("Code ID: ", codeId);

if (argv.instantiate) {
  console.log("Instantiating a contract");
  console.log("Sleeping for 10 seconds for store transaction to finalize.");
  await sleep(10000);

  /* Instantiate contracts.
  *
  * We instantiate the core contracts here (i.e. wormhole itself and the bridge contracts).
  * The wrapped asset contracts don't need to be instantiated here, because those
  * will be instantiated by the on-chain bridge contracts on demand.
  * */
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
        memo: "",
      })
      .then((tx) => lcd.tx.broadcast(tx))
      .then((rs) => {
        console.log(rs.raw_log);
        address = /"contract_address","value":"([^"]+)/gm.exec(rs.raw_log)[1];
      });
    console.log(`Instantiated Pyth Bridge at ${address} (${convert_terra_address_to_hex(address)})`);
    return address;
  }

  const pythEmitterAddress =
    "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0";
  const pythChain = 1;

  const contractAddress = await instantiate(codeId, {
    wormhole_contract: "terra1pd65m0q9tl3v8znnz5f5ltsfegyzah7g42cx5v",
    pyth_emitter: Buffer.from(pythEmitterAddress, "hex").toString(
      "base64"
    ),
    pyth_emitter_chain: pythChain,
  });

  console.log(`Deployed pyth contract at ${contractAddress}`);
}

if (argv.migrate) {
  if (argv.contract === '') {
    console.error("Contract address is not provided. Provide it using --contract");
    process.exit(1);
  }

  console.log(`Migrating contract ${argv.contract} to ${codeId}`);
  console.log("Sleeping for 10 seconds for store transaction to finalize.");
  await sleep(10000);

  const tx = await wallet.createAndSignTx({
    msgs: [
      new MsgMigrateContract(
        wallet.key.accAddress,
        argv.contract,
        codeId,
        {
          "action": ""
        },
        { uluna: 1000 }
      ),
    ],
    memo: "",
    feeDenoms,
    gasPrices,
  });
  
  const rs = await lcd.tx.broadcast(tx);
  console.log(rs);
}

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}