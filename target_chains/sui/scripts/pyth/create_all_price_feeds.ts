/// We build a programmable txn to create all price feeds.
import dotenv from "dotenv";
import axios from "axios";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as _ from "lodash";
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

// ================== Network dependent settings ==================
let network = NETWORK.MAINNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_MAINNET; // <= NOTE: Update this when changing network
const price_feed_id_url = "https://xc-mainnet.pyth.network/api/price_feed_ids"; // <= NOTE: Update this when changing network
const connection = new PriceServiceConnection(
  "https://xc-mainnet.pyth.network", // <= NOTE: Update this when changing network
  {
    priceFeedRequestConfig: {
      binary: true,
    },
  }
);
// ================================================================

const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("Wallet key unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );
  console.log("wallet address: ", wallet.getAddress());

  // Fetch all price IDs
  let { data } = await axios.get(price_feed_id_url);
  const price_feed_ids = data;
  console.log("num price feed ids: ", price_feed_ids.length);

  // Create price feeds 20 at a time
  for (let chunk of _.chunk(price_feed_ids, 20)) {
    //@ts-ignore
    const priceFeedVAAs = await connection.getLatestVaas(chunk);
    console.log("price feed VAAs len: ", priceFeedVAAs.length);
    console.log("sample vaa: ", priceFeedVAAs[0]);
    await create_price_feeds(wallet, registry, priceFeedVAAs);
  }
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
  }
}
