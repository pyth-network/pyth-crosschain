/// We build a programmable transaction to look up a PriceInfoObject ID
/// from a price feed ID, update the price feed, and finally fetch
/// the updated price.
///
/// https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
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
let network = NETWORK.MAINNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_MAINNET; // <= NOTE: Update this when changing network

const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

const connection = new PriceServiceConnection(
  "https://xc-mainnet.pyth.network",
  {
    priceFeedRequestConfig: {
      binary: true,
    },
  }
);

//
// NOTE: this function is a WIP
//
async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("SUI_TESTNET unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(
      network == "MAINNET"
        ? Buffer.from(walletPrivateKey, "hex")
        : Buffer.from(walletPrivateKey, "base64").subarray(1)
    ),
    provider
  );
  console.log(wallet.getAddress());

  // update a single price feed
  const price_feed_id =
    "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d";
  const vaa =
    "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";
  const object_id =
    "0x9a6d328a6ebd906ed842e6e874e14bea69efa1c421fbfe7f689c33412a43c41c";
  update_price_feeds(wallet, registry, vaa, object_id);
}

main();

async function update_price_feeds(
  signer: RawSigner,
  registry: any,
  vaa: string,
  object_id: string
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

  let [verified_vaa] = tx.moveCall({
    target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
    arguments: [
      tx.object(WORM_STATE),
      tx.pure([...Buffer.from(vaa, "base64")]),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  let [coin] = tx.moveCall({
    target: "0x2::coin::split",
    arguments: [
      tx.object(
        "0xab59f054a27f97adb14c4d5eca7ee4dbccade998285b9c5c5400ab00f8ee672d"
      ),
      tx.pure(1),
    ],
    typeArguments: ["0x2::sui::SUI"],
  });

  tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::update_price_feeds`,
    arguments: [
      tx.object(PYTH_STATE),
      tx.makeMoveVec({
        type: `${WORM_PACKAGE}::vaa::VAA`,
        objects: [verified_vaa],
      }),
      tx.makeMoveVec({
        type: `${PYTH_PACKAGE}::price_info::PriceInfoObject`,
        objects: [tx.object(object_id)],
      }),
      coin,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
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
