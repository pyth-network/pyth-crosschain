import dotenv from "dotenv";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

import {
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@mysten/sui.js";

dotenv.config({ path: "~/.env" });

import { REGISTRY, NETWORK } from "../registry";

// Network dependent settings.
let network = NETWORK.TESTNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET_ALT_KEY; // <= NOTE: Update this when changing network

const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);
async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("walletPrivateKey unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );
  console.log(wallet.getAddress());

 let set_data_sources_vaa_base64 = "AQAAAAABAOC+gEJW02mEvpVekg5IdvzJe57GL/q3DKdQzqYgFr5mKx0w3HovoKAKwaMWXB3KJMjAJafyofaTN/OgSXBfNNgAZH8RXAAAAAAAAWMnjScQmb/UkZUbPmSPCLHHFjHkpTZ0rUPo+fmAaMOFAAAAAAAAAB0BUFRHTQECAAADAAHzRhlawC831g1NuP+m73TLG+NVAEdUOkqe6az014aXsAAaong51kGwd0PAy19oxR+M0x0sB2K+wA3G/NJUM+8atbYAGuEB+u2sWFHjK5sjtflBGowrrEquPtTde4Ed0acupKpx";
 let set_data_sources_vaa_hex = Buffer.from(set_data_sources_vaa_base64, "base64").toString("hex")
 console.log("set_data_sources_vaa_hex: ", set_data_sources_vaa_hex)

 update_data_sources(wallet, registry, set_data_sources_vaa_hex)
 //update_data_sources(wallet, registry, set_data_sources_vaa_hex)
}
main();

async function update_data_sources(
  signer: RawSigner,
  registry: any,
  vaa: string,
) {
  const tx = new TransactionBlock();

  let PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"];
  let PYTH_STATE = registry["PYTH_STATE_ID"];
  let WORM_PACKAGE = registry["WORMHOLE_PACKAGE_ID"];
  let WORM_STATE = registry["WORMHOLE_STATE_ID"];
  console.log("PYTH_PACKAGE: ", PYTH_PACKAGE);
  console.log("PYTH_STATE: ", PYTH_STATE);
  console.log("WORM_PACKAGE: ", WORM_PACKAGE);
  console.log("WORM_STATE: ", WORM_STATE);
  console.log("SUI_CLOCK_OBJECT_ID: ", SUI_CLOCK_OBJECT_ID);

  let vaa_vec_u8 = new Uint8Array(Buffer.from(vaa, "hex"))
    console.log("vaa as vector<u8>: ", vaa_vec_u8)


   let [ticket] = tx.moveCall({
    target: `${PYTH_PACKAGE}::set_data_sources::authorize_governance`,
    arguments: [
      tx.object(PYTH_STATE),
      tx.pure(true)
    ],
   });

   // verify VAA (that encodes the merkle root) in accumulator message
   let [verified_vaa] = tx.moveCall({
    target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
    arguments: [
      tx.object(WORM_STATE),
      tx.pure([...vaa_vec_u8]),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
   });

   let [receipt] = tx.moveCall({
   target: `${WORM_PACKAGE}::governance_message::verify_vaa`,
   arguments: [
        tx.object(WORM_STATE),
        verified_vaa,
        ticket
    ],
    typeArguments: [`${PYTH_PACKAGE}::governance_witness::GovernanceWitness`],
   });

  // execute set data source governance instruction
  tx.moveCall({
    target: `${PYTH_PACKAGE}::governance::execute_governance_instruction`,
    arguments: [
      tx.object(PYTH_STATE),
      receipt,
    ],
  });

  tx.setGasBudget(2000000000);
//   let result = await signer.dryRunTransactionBlock({
//     transactionBlock: tx,
//   })

  let result = await signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });
  console.log(result);
  return result;
}
