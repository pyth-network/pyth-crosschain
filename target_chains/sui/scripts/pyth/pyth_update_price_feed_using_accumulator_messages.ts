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

  // set the price_feed_id and price_info_object_id when trying to update a price feed
  // make sure that the price feed id corresponds to the price info object id
  let price_feed_id =
    "0x5a035d5440f5c163069af66062bac6c79377bf88396fa27e6067bfca8096d280";
  let price_info_object_id =
    "0x848d1c941e117f515757b77aa562eee8bb179eee6f37ec6dad97ae0279ff4bd4";

  // get accumulator msg in base 64
  let { data } = await axios.get(
    `https://hermes-beta.pyth.network/api/latest_vaas?ids[]=${price_feed_id}`
  );

  // convert accumulator msg to hex
  let accumulator_message = Buffer.from(data[0], "base64").toString("hex");

  update_price_feed_using_accumulator_message(
    wallet,
    registry,
    accumulator_message,
    price_info_object_id
  );
}
main();

async function update_price_feed_using_accumulator_message(
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
  console.log("accumulator_message: ", accumulator_message);
  console.log("price_info_object_id: ", price_info_object_id);

  console.log(
    "vaa parsed from accumulator: ",
    parse_vaa_bytes_from_accumulator_message(accumulator_message, true)
  );

  // 0. verify VAA (that encodes the merkle root) in accumulator message
  let [verified_vaa] = tx.moveCall({
    target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
    arguments: [
      tx.object(WORM_STATE),
      tx.pure(
        parse_vaa_bytes_from_accumulator_message(accumulator_message, true)
      ),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 1. obtain fee coin by splitting it off from the gas coin
  let [fee_coin] = tx.moveCall({
    target: "0x2::coin::split",
    arguments: [tx.gas, tx.pure(1)],
    typeArguments: ["0x2::sui::SUI"],
  });

  // 2. get authenticated price info vector, containing price updates
  let [authenticated_price_infos_vector] = tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::create_authenticated_price_infos_using_accumulator`,
    arguments: [
      tx.object(PYTH_STATE),
      tx.pure([...Buffer.from(accumulator_message, "hex")]),
      verified_vaa,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 3. use authenticated prices to update target price info object
  authenticated_price_infos_vector = tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::update_single_price_feed`,
    arguments: [
      tx.object(PYTH_STATE),
      authenticated_price_infos_vector,
      tx.object(price_info_object_id),
      fee_coin,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // 4. clean-up (destroy authenticated vector)
  tx.moveCall({
    target: `${PYTH_PACKAGE}::hot_potato_vector::destroy`,
    arguments: [authenticated_price_infos_vector],
    typeArguments: [`${PYTH_PACKAGE}::price_info::PriceInfo`],
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

// parse_vaa_bytes_from_accumulator_message obtains the vaa bytes embedded in an accumulator message,
// which can either be hex or base64.
// If isHex==false, then the accumulator_message is assumed to be in base64.
function parse_vaa_bytes_from_accumulator_message(
  accumulator_message: string,
  isHex: boolean
): number[] {
  let b = isHex
    ? [...Buffer.from(accumulator_message, "hex")]
    : [...Buffer.from(accumulator_message, "base64")];
  // the bytes at offsets 0-5 in the accumulator msg encode the header, major, minor bytes
  // we ignore them, since we are only interested in the VAA bytes
  let trailing_size = b.slice(6, 7)[0];
  let vaa_size_offset =
    7 /* initial bytes (header, major, minor, trailing stuff size) */ +
    trailing_size /* trailing stuff (variable number of bytes) */ +
    1; /* proof_type (1 byte) */
  let vaa_size_bytes = b.slice(vaa_size_offset, vaa_size_offset + 2);
  let vaa_size = vaa_size_bytes[1] + 16 * vaa_size_bytes[0];
  let vaa_offset = vaa_size_offset + 2;
  let vaa = b.slice(vaa_offset, vaa_offset + vaa_size);
  return vaa;
}
