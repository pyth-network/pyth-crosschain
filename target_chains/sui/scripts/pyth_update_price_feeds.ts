/// We build a programmable transaction to look up a PriceInfoObject ID
/// from a price feed ID, update the price feed, and finally fetch
/// the updated price.
///
/// https://pyth.network/developers/price-feed-ids#pyth-evm-testnet
import dotenv from "dotenv"

import {
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
  fromB64,
  normalizeSuiObjectId,
  JsonRpcProvider,
  Ed25519Keypair,
  testnetConnection,
  Connection,
  TypeTag
} from "@mysten/sui.js";

dotenv.config({"path":"~/.env"})

import {REGISTRY, NETWORK} from "./registry"

let network = NETWORK.TESTNET
const registry = REGISTRY[network]
const provider = new JsonRpcProvider(new Connection({ fullnode: registry["RPC_URL"] }))
const walletPrivateKey = process.env.SUI_TESTNET_BASE_64;

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
    let price_feed_id = "0x61226d39beea19d334f17c2febce27e12646d84675924ebb02b9cdaea68727e3"; // ATOM/USD
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

    let [price_info_object_id] = tx.moveCall({
      target: `${PYTH_PACKAGE}::pyth::`,
      arguments: [
        tx.object(PYTH_STATE),
        tx.makeMoveVec({ type: '0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7::vaa::VAA', objects: [verified_vaa] }), // has type vector<VAA>
        tx.object(SUI_CLOCK_OBJECT_ID)
      ],
    });

    let [verified_vaa] = tx.moveCall({
        target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
        arguments: [
          tx.object(WORM_STATE),
          tx.pure([...Buffer.from(vaa_bytes, "base64")]),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
    });

    tx.moveCall({
      target: `${PYTH_PACKAGE}::pyth::create_price_feeds`,
      arguments: [
        tx.object(PYTH_STATE),
        tx.makeMoveVec({ type: '0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7::vaa::VAA', objects: [verified_vaa] }), // has type vector<VAA>
        tx.object(SUI_CLOCK_OBJECT_ID)
      ],
    });

    // tx.moveCall({
    //   target: `${PYTH_PACKAGE}::state::get_fee_recipient`,
    //   arguments: [
    //     tx.pure(PYTH_STATE),
    //     //tx.makeMoveVec({ objects: [verified_vaa] }), // has type vector<VAA>
    //     //tx.object(SUI_CLOCK_OBJECT_ID)
    //   ],
    // });

    tx.setGasBudget(1_000_000_000n);

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
