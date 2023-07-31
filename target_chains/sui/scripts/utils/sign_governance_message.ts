import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import dotenv from "dotenv";

import {
  RawSigner,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@mysten/sui.js";

import { REGISTRY, NETWORK } from "../registry";
import {
  SetDataSourcesInstruction,
  DataSource,
  CHAINS,
  HexString32Bytes,
  SetFeeInstruction,
  AuthorizeGovernanceDataSourceTransferInstruction,
  SetValidPeriodInstruction,
} from "../../../../governance/xc_governance_sdk_js/src/index";

dotenv.config({ path: "~/.env" });

// Network dependent settings.
let network = NETWORK.TESTNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET_ALT_KEY_BASE_64; // <= NOTE: Update this when changing network
const guardianPrivateKey = process.env.WH_TESTNET_GUARDIAN_PRIVATE_KEY; // <= NOTE: Update this when changing network

const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

const PYTH_STATE_ID = registry["PYTH_STATE_ID"];
const PYTH_PACKAGE_ID = registry["PYTH_PACKAGE_ID"];
const WORMHOLE_STATE_ID = registry["WORMHOLE_STATE_ID"];
const WORMHOLE_PACKAGE_ID = registry["WORMHOLE_PACKAGE_ID"];
console.log("WORMHOLE_STATE_ID: ", WORMHOLE_STATE_ID);
console.log("PYTH_STATE_ID: ", WORMHOLE_STATE_ID);

const GOVERNANCE_EMITTER =
  "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385";

async function main() {
  if (guardianPrivateKey === undefined) {
    throw new Error("guardianPrivateKey unset in environment");
  }
  if (walletPrivateKey === undefined) {
    throw new Error("walletPrivateKey unset in environment");
  }

  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(
      network == "MAINNET"
        ? Buffer.from(walletPrivateKey, "hex")
        : Buffer.from(walletPrivateKey, "base64")
    ),
    provider
  );

  console.log("wallet address: ", wallet.getAddress());

  // =============================== define mock emitter and guardians ===============================
  const guardians = new mock.MockGuardians(0, [guardianPrivateKey]);
  const governance = new mock.GovernanceEmitter(GOVERNANCE_EMITTER);

  // =============================== construct governance VAA payload ===============================

  // const action = 2; // set data sources
  // const chain = 21;

  // const magic = Buffer.alloc(4);
  // magic.write("PTGM", 0); // magic
  // console.log("magic buffer: ", magic);

  // let ds = new SetDataSourcesInstruction(21, [
  //   new DataSource(
  //     CHAINS.solana,
  //     new HexString32Bytes(
  //       "0xf346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0"
  //     )
  //   ),
  //   new DataSource(
  //     CHAINS.pythnet,
  //     new HexString32Bytes(
  //       "0xa27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6"
  //     )
  //   ),
  //   new DataSource(
  //     CHAINS.pythnet,
  //     new HexString32Bytes(
  //       "0xe101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71"
  //     )
  //   ),
  // ]);

  // let payload = ds.serialize();

  let payload = Buffer.from("5054474d0103001500000000000000050000000000000005", "hex");

  // =============================== construct governance message ===============================

  let msg = governance.publishMessage(0, payload, 1)
  console.log("msg: ", msg)
  // let msg = governance.publishGovernanceMessage(
  //   timestamp,
  //   "",
  //   payload,
  //   action,
  //   chain
  // );

  // // Pyth expects the module name for an action to be "0x00000000000000000000000000000001", so
  // // we write 0x1 in the right position to convert the module name from "0x00000000000000000000000000000000" -> "0x00000000000000000000000000000001"
  // msg.writeUInt8(0x1, 84 - 33 + 31);

  // console.log("governance msg: ", msg.toString("hex"));

  // =============================== sign governance message ===============================

  const signedVaa = guardians.addSignatures(msg, [0]);
  console.log("signed VAA:", signedVaa.toString("hex"));
}

main();
