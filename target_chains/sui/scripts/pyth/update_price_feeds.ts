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
} from "@optke3/sui.js";

dotenv.config({ path: "~/.env" });

import { REGISTRY, NETWORK } from "../registry";

// Network dependent settings.
let network = NETWORK.TESTNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET; // <= NOTE: Update this when changing network
const price_connection_url = "https://xc-mainnet.pyth.network"; // <= NOTE: Update this when changing network
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

  // update a single price feed
  const _deployer =
    "0xf0bd738bf137f4cb0601713e95bb9307a5efe8d27f34c9e34f419e17b4e74099"; // testnet

  // Price feeds IDs of feeds we are interested in updating.
  const _price_feed_ids = [
    "0x8b62866fcd3a25ff9118506444e9fe5171e67c61a049f4b4fdacdbc31ae862bb",
    "0x0e60a64dcbd660e87a08eb2cc95e8d84d1126fd7354d377b3fc5730352f4b8b2",
    "0x651071f8c7ab2321b6bdd3bc79b94a50841a92a6e065f9e3b8b9926a8fb5a5d1",
  ];

  // Batch attestation VAA for price feed IDs above.
  const vaas = [
    "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",
  ];

  // Price info objects corresponding to the price feeds we want to update.
  const price_info_object_ids = [
    "0x0d2fbbf69315c2bf139ef2db39fa9290944b714aaf651924be1206fa66a076e7",
    "0xacfd46e1f0fccfe3b5b2c7959ab628f9543b590555286e6ed7b351bc66a18688",
    "0x8e0d74c3364b0be0b805fab72974edb9872451737848cf6a28a948e5ade1c8ee",
  ];

  update_price_feeds(wallet, registry, vaas, price_info_object_ids);
}

main();

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

  tx.moveCall({
    target: `${PYTH_PACKAGE}::hot_potato_vector::destroy`,
    arguments: [price_updates_hot_potato],
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
