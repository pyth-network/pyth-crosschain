import dotenv from "dotenv";

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

  // set governance vaa to be executed
  let set_data_sources_vaa_hex =
    "01000000000100ac52663a7e50ab23db4f00f0607d930ffd438c5a214b3013418b57117590f76c32d2f790ec62be5f6e69d96273b1a567b8a698a8f5069c1ccd27a6874af2adc00100bc614e00000000000163278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c38500000000000000010100000000000000000000000000000000000000000000000000000000000000010200155054474d01020015030001f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0001aa27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71";

  console.log("set_data_sources_vaa_hex: ", set_data_sources_vaa_hex);

  update_data_sources(wallet, registry, set_data_sources_vaa_hex);
}
main();

async function update_data_sources(
  signer: RawSigner,
  registry: any,
  vaa: string
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

  let vaa_vec_u8 = new Uint8Array(Buffer.from(vaa, "hex"));

  // 0. obtain ticket authorizing governance action
  let [ticket] = tx.moveCall({
    target: `${PYTH_PACKAGE}::set_data_sources::authorize_governance`,
    arguments: [
      tx.object(PYTH_STATE),
      tx.pure(false /* whether or not action is global (as opposed to local)*/),
    ],
  });

  // 1. verify VAA (that encodes the merkle root) in accumulator message
  let [verified_vaa] = tx.moveCall({
    target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
    arguments: [
      tx.object(WORM_STATE),
      tx.pure([...vaa_vec_u8]),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 2. verify that the governance vaa and govrnance ticket match up
  let [receipt] = tx.moveCall({
    target: `${WORM_PACKAGE}::governance_message::verify_vaa`,
    arguments: [tx.object(WORM_STATE), verified_vaa, ticket],
    typeArguments: [`${PYTH_PACKAGE}::governance_witness::GovernanceWitness`],
  });

  // 3. execute governance instruction
  tx.moveCall({
    target: `${PYTH_PACKAGE}::governance::execute_governance_instruction`,
    arguments: [tx.object(PYTH_STATE), receipt],
  });

  tx.setGasBudget(2000000000);

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
