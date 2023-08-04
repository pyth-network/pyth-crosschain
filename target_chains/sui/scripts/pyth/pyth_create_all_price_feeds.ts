/// We build a programmable txn to create all price feeds.
import dotenv from "dotenv";
import axios from "axios";
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

const connection = new PriceServiceConnection(
  "https://xc-testnet.pyth.network", // <= NOTE: Update this when changing network
  {
    priceFeedRequestConfig: {
      binary: true,
    },
  }
);

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("SUI_MAINNET unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );
  console.log("wallet address: ", wallet.getAddress());

  // Fetch all price IDs
  let { data } = await axios.get(
    "https://xc-testnet.pyth.network/api/price_feed_ids" // <= NOTE: Update this when changing network
  );
  const price_feed_ids = data;
  console.log("num price feed ids: ", price_feed_ids.length);

  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(0, 20));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(20, 40));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(40, 60));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(60, 80));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(80, 100));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(100, 120));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(120, 140));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(140, 160));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(160, 180));
  //const priceFeedVAAs = await connection.getLatestVaas(price_feed_ids.slice(180, 200));
  const priceFeedVAAs = await connection.getLatestVaas(
    price_feed_ids.slice(200, 220)
  );

  console.log("price feed VAAs len: ", priceFeedVAAs.length);

  create_price_feeds(wallet, registry, priceFeedVAAs);
}

main();

async function create_price_feeds(
  signer: RawSigner,
  registry: any,
  priceFeedVAAs: Array<string>
) {
  let PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"];
  let PYTH_STATE = registry["PYTH_STATE_ID"];
  let WORM_PACKAGE = registry["WORMHOLE_PACKAGE_ID"];
  let WORM_STATE = registry["WORMHOLE_STATE_ID"];
  console.log("PYTH_PACKAGE: ", PYTH_PACKAGE);
  console.log("PYTH_STATE: ", PYTH_STATE);
  console.log("WORM_PACKAGE: ", WORM_PACKAGE);
  console.log("WORM_STATE: ", WORM_STATE);
  console.log("SUI_CLOCK_OBJECT_ID: ", SUI_CLOCK_OBJECT_ID);

  for (let vaa of priceFeedVAAs) {
    const tx = new TransactionBlock();

    let [verified_vaa] = tx.moveCall({
      target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
      arguments: [
        tx.object(WORM_STATE),
        tx.pure([...Buffer.from(vaa, "base64")]),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    tx.moveCall({
      target: `${PYTH_PACKAGE}::pyth::create_price_feeds`,
      arguments: [
        tx.object(PYTH_STATE),
        tx.makeMoveVec({
          type: `${WORM_PACKAGE}::vaa::VAA`,
          objects: [verified_vaa],
        }),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    tx.setGasBudget(1000000000);

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
  }
}
