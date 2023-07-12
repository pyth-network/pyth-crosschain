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
import axios from "axios";

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

  // make sure that the price feed id corresponds to the price info object id!
  let price_feed_id = "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"
  let price_info_object_id =  "0x878b118488aeb5763b5f191675c3739a844ce132cb98150a465d9407d7971e7c";

  // get accumulator msg in base 64
  let {data} = await axios.get(`https://hermes-beta.pyth.network/api/latest_vaas?ids[]=${price_feed_id}`)
  //let accumulator_message = data[0]
  let accumulator_message = "504e41550100000000a0010000000001000c8a0725e651012b232cec63e33511502b6fbae413fd9b289132c07765b440f1231d2390dbdb3a5922c2ea104e065b2f048cf2c45360a5ba07bde3fcac651de70064aef35900000000001ae101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71000000000093e5020141555756000000000004ef51310000271053fe324f96fed4a65bf488cd8f3fb3013c9682c201005500f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b000002c6eb94fd3f0000000030fbd300fffffff80000000064aef3580000000064aef356000002c5c2cfa140000000002aeae87a095c1bd32561d27add4f59cf4dc2a8b36d38f7eaab8c6b699d546dde8cadd614565ed4428382eae7febc76f5ac8f777e9e1d617539f965b3e4531fe60f8097d21ffd8b803e67200e416c14ef1dfd2bee45115af802d65322ad2f3cd882fc1b60975ce13af3d6c098464baf0e014734e59b139ca788b2ff54b34459858f08908707a29c60ff56f4f1e4f2be3d47dd38f0da18fcb0f7ead4d1de56db6c0442b948835ef5ff868a4e22b03ce5239adf63beba03a40da8";
  console.log("accumulator_message: ", accumulator_message)
  //parse_vaa_bytes_from_accumulator_message(accumulator_message)
  //console.log(data);
  update_price_feeds(wallet, registry, accumulator_message, price_info_object_id)
}
main();

async function update_price_feeds(
  signer: RawSigner,
  registry: any,
  accumulator_message: string,
  price_info_object_id: string
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

  console.log("vaa parsed from accumulator: ", parse_vaa_bytes_from_accumulator_message(accumulator_message, true))

  // verify VAA (that encodes the merkle root) in accumulator message
  let [verified_vaa] = tx.moveCall({
    target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
    arguments: [
      tx.object(WORM_STATE),
      tx.pure(parse_vaa_bytes_from_accumulator_message(accumulator_message, true)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // obtain fee coin by splitting it off from the gas coin
  let [fee_coin] = tx.moveCall({
    target: "0x2::coin::split",
    arguments: [
      tx.gas,
      tx.pure(1),
    ],
    typeArguments: ["0x2::sui::SUI"],
  });

  let [authenticated_price_infos_vector] = tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::create_authenticated_price_infos_using_accumulator`,
    arguments: [
      tx.object(PYTH_STATE),
      tx.pure([...Buffer.from(accumulator_message, "hex")]),
      verified_vaa,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ]
  })

  authenticated_price_infos_vector = tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::update_single_price_feed`,
    arguments: [
      tx.object(PYTH_STATE),
      authenticated_price_infos_vector,
      tx.object(price_info_object_id),
      fee_coin,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ]
  })

  tx.moveCall({
    target: `${PYTH_PACKAGE}::hot_potato_vector::destroy`,
    arguments: [
      authenticated_price_infos_vector
    ]
  })

  // tx.moveCall({
  //   target: `${PYTH_PACKAGE}::pyth::update_price_feeds`,
  //   arguments: [
  //     tx.object(PYTH_STATE),
  //     tx.makeMoveVec({
  //       type: `${WORM_PACKAGE}::vaa::VAA`,
  //       objects: [verified_vaa],
  //     }),
  //     tx.makeMoveVec({
  //       type: `${PYTH_PACKAGE}::price_info::PriceInfoObject`,
  //       objects: [tx.object(object_id)],
  //     }),
  //     coin,
  //     tx.object(SUI_CLOCK_OBJECT_ID),
  //   ],
  // });

  tx.setGasBudget(2000000000);
  // let result = await signer.dryRunTransactionBlock({
  //   transactionBlock: tx,
  // })

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

// parse_vaa_bytes_from_accumulator_message parses the vaa bytes from an accumulator message,
// which can either be in hex or base64 format.
function parse_vaa_bytes_from_accumulator_message(accumulator_message: string, isHex: boolean){
  console.log("parse_vaa_bytes_from_accumulator_message msg: ", accumulator_message)
  let b = []
  if (isHex) {
    b = [...Buffer.from(accumulator_message, "hex")]
  } else {
    b = [...Buffer.from(accumulator_message, "base64")]
  }
  let trailing_size = b.slice(6,7)[0]
  let vaa_size_offset = 7 + trailing_size + 1
  let vaa_size_bytes = b.slice(vaa_size_offset, vaa_size_offset+2)
  console.log("vaa_size_bytes: ", vaa_size_bytes)
  let vaa_size = vaa_size_bytes[1] + 16*vaa_size_bytes[0]
  let vaa_offset = vaa_size_offset + 2
  console.log("vaa_size: ", vaa_size)
  let vaa = b.slice(vaa_offset, vaa_offset + vaa_size)
  console.log("vaa from acc msg: ", Buffer.from(vaa).toString("hex"))
  return vaa
}
