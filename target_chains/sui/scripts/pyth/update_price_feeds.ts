/// Build a programmable txn for updating multiple price feeds.
import dotenv from "dotenv";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import fs from "fs";

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

// ================== Network dependent settings ==================
let network = NETWORK.MAINNET;
const walletPrivateKey = process.env.SUI_MAINNET;
const price_connection_url = "https://xc-mainnet.pyth.network";
const PATH_TO_PRICE_ID_TO_OBJECT_MAP =
  "./generated/price_id_to_object_id.mainnet.json";
// ================================================================

const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

const connection = new PriceServiceConnection(price_connection_url, {
  priceFeedRequestConfig: {
    binary: true,
  },
});

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("Wallet key unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );
  console.log(wallet.getAddress());

  // Price feeds IDs of feeds we are interested in updating.
  // For a full list of testnet price feed ids, see:
  // https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
  const price_feed_ids = [
    "0x63f341689d98a12ef60a5cff1d7f85c70a9e17bf1575f0e7c0b2512d48b1c8b3",
    // INSERT YOUR PRICE FEED ID HERE!
  ];

  // Batch attestation VAA for price feed IDs above.
  const vaas = await connection.getLatestVaas(price_feed_ids);

  const price_feed_id_to_price_info_map = JSON.parse(
    fs.readFileSync(PATH_TO_PRICE_ID_TO_OBJECT_MAP, "utf8")
  );
  // Price info objects corresponding to the price feeds we want to update.
  let price_info_object_ids = [];
  for (let id of price_feed_ids) {
    let sliced_id = id.slice(2); // removed 0x prefix
    price_info_object_ids = price_info_object_ids.concat(
      price_feed_id_to_price_info_map[sliced_id]
    );
  }

  console.log("price info objects to be updated: ", price_info_object_ids);
  update_price_feeds(wallet, registry, vaas, price_info_object_ids);
}

main();

// Example on updating a price feed and then getting
// the updated price.
async function update_price_feeds(
  signer: RawSigner,
  registry: any,
  vaas: Array<string>,
  price_info_object_ids: Array<string>
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

  // Parse our batch price attestation VAA bytes using Wormhole.
  // Check out the Wormhole cross-chain bridge and generic messaging protocol here:
  //     https://github.com/wormhole-foundation/wormhole
  let verified_vaas = [];
  for (let vaa of vaas) {
    let [verified_vaa] = tx.moveCall({
      target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
      arguments: [
        tx.object(WORM_STATE),
        tx.pure([...Buffer.from(vaa, "base64")]),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    verified_vaas = verified_vaas.concat(verified_vaa);
  }

  // Create a hot potato vector of price feed updates that will
  // be used to update price feeds.
  let [price_updates_hot_potato] = tx.moveCall({
    target: `${PYTH_PACKAGE}::pyth::create_price_infos_hot_potato`,
    arguments: [
      tx.object(PYTH_STATE),
      tx.makeMoveVec({
        type: `${WORM_PACKAGE}::vaa::VAA`,
        objects: verified_vaas,
      }),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // Update each price info object (containing our price feeds of interest)
  // using the hot potato vector.
  for (let price_info_object of price_info_object_ids) {
    let coin = tx.splitCoins(tx.gas, [tx.pure(1)]);
    [price_updates_hot_potato] = tx.moveCall({
      target: `${PYTH_PACKAGE}::pyth::update_single_price_feed`,
      arguments: [
        tx.object(PYTH_STATE),
        price_updates_hot_potato,
        tx.object(price_info_object),
        coin,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
  }

  // Explicitly destroy the hot potato vector, since it can't be dropped
  // automatically.
  tx.moveCall({
    target: `${PYTH_PACKAGE}::hot_potato_vector::destroy`,
    arguments: [price_updates_hot_potato],
    typeArguments: [`${PYTH_PACKAGE}::price_info::PriceInfo`],
  });

  // Get newly updated prices.
  for (let price_info_object of price_info_object_ids) {
    // The returned price is dropped in this example, but can be consumed by
    // another downstream smart contract.
    let [price] = tx.moveCall({
      target: `${PYTH_PACKAGE}::pyth::get_price`,
      arguments: [
        tx.object(PYTH_STATE),
        tx.object(price_info_object),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
  }

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
