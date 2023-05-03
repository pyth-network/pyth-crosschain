/// We build a programmable txn to create a price feed.
import dotenv from "dotenv"
import axios from 'axios';
import { PriceServiceConnection } from '@pythnetwork/price-service-client';

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
  TypeTagSerializer
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

    // Fetch all price IDs
    let {data} = await axios.get("https://xc-testnet.pyth.network/api/price_feed_ids")
    console.log("all price feed ids: ", data)

    console.log(data.slice(0, 3))
    const priceFeedVAAs = await connection.getLatestVaas(data.slice(0, 30));
    console.log("price feed VAAs: ", priceFeedVAAs)

    //create_price_feeds(wallet, registry, data.slice(0, 10))
}

main();

async function create_price_feeds(
    signer: RawSigner,
    registry: any,
    priceFeedVAAs: Array<string>
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

    // let [verified_vaa] = tx.moveCall({
    //     target: `${WORM_PACKAGE}::vaa::parse_and_verify`,
    //     arguments: [
    //       tx.object(WORM_STATE),
    //       tx.pure([...Buffer.from(vaa_bytes, "base64")]),
    //       tx.object(SUI_CLOCK_OBJECT_ID),
    //     ],
    // });

    // tx.moveCall({
    //   target: `${PYTH_PACKAGE}::pyth::create_price_feeds`,
    //   arguments: [
    //     tx.object(PYTH_STATE),
    //     //tx.makeMoveVec({ type: TypeTagSerializer.tagToString(TypeTagSerializer.parseFromStr('0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7::vaa::VAA')), objects: [verified_vaa] }), // has type vector<VAA>
    //     //@ts-ignore
    //     tx.makeMoveVec({ type: `${WORM_PACKAGE}::vaa::VAA`, objects: [verified_vaa] }), // has type vector<VAA>,
    //     tx.object(SUI_CLOCK_OBJECT_ID)
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
