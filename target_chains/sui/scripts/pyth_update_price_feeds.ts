/// We build a programmable transaction to look up a PriceInfoObject ID
/// from a price feed ID, update the price feed, and finally fetch
/// the updated price.
///
/// https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
import dotenv from "dotenv"
import { PriceServiceConnection } from '@pythnetwork/price-service-client';

import {
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@optke3/sui.js";

dotenv.config({"path":"~/.env"})

import {REGISTRY, NETWORK} from "./registry"

let network = NETWORK.TESTNET
const registry = REGISTRY[network]
const provider = new JsonRpcProvider(new Connection({ fullnode: registry["RPC_URL"] }))
const walletPrivateKey = process.env.SUI_TESTNET_BASE_64;

const connection = new PriceServiceConnection("https://xc-testnet.pyth.network", {
  priceFeedRequestConfig: {
    binary: true,
  },
})

async function main() {
    if (walletPrivateKey === undefined) {
      throw new Error("SUI_TESTNET unset in environment");
    }
    const wallet = new RawSigner(
        Ed25519Keypair.fromSecretKey(
            network == "MAINNET" ?
            Buffer.from(walletPrivateKey, "hex")
                :
            Buffer.from(walletPrivateKey, "base64").subarray(1)
        ),
        provider
    );
    console.log(wallet.getAddress())

    // update a single price feed
    let price_feed_id = "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"; // BTC/USD
    update_price_feeds(wallet, registry, price_feed_id)
}

main();

async function update_price_feeds(
    signer: RawSigner,
    registry: any,
    price_feed_id: string
) {
    const tx = new TransactionBlock();

    let PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"]
    let PYTH_STATE = registry["PYTH_STATE_ID"]
    let WORM_PACKAGE = registry["WORMHOLE_PACKAGE_ID"]
    let WORM_STATE = registry["WORMHOLE_STATE_ID"]
    console.log("PYTH_PACKAGE: ", PYTH_PACKAGE)
    console.log("PYTH_STATE: ", PYTH_STATE)
    console.log("WORM_PACKAGE: ", WORM_PACKAGE)
    console.log("WORM_STATE: ", WORM_STATE)
    console.log("SUI_CLOCK_OBJECT_ID: ", SUI_CLOCK_OBJECT_ID)

    let [ID] = tx.moveCall({
      target: `${PYTH_PACKAGE}::state::get_price_info_object_id`,
      arguments: [
        tx.object(PYTH_STATE),
        tx.pure([...Buffer.from(price_feed_id, "hex")]), // price identifier
      ],
    });

    // TODO

    // get VAA for price attestation
    const priceFeedVAAs = await connection.getLatestVaas([price_feed_id]);

    let [verified_vaa] = tx.moveCall({
      target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
      arguments: [
        tx.object(WORM_STATE),
        tx.pure([...Buffer.from(priceFeedVAAs[0], "base64")]),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    let [ID] = tx.moveCall({
      target: `${PYTH_PACKAGE}::pyth::update_price_feeds`,
      arguments: [
        tx.object(PYTH_STATE),
        tx.pure([...Buffer.from(price_feed_id, "hex")]), // price identifier
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
    console.log(result)
    return result
}
