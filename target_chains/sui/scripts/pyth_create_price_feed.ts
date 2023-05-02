/// We build a programmable txn to create a price feed.
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
    const vaa_bytes = "AQAAAAABAMN885gNTVEako6fczJq22AOFSRWdUsUOxPQVHSnxhj3ecU2gJVDBlAcY6G9FWmGCcGcdZ/5iVXQCm+0loHvfqwAZE/kXQAAAAAAGqJ4OdZBsHdDwMtfaMUfjNMdLAdivsANxvzSVDPvGrW2AAAAAADugxEBUDJXSAADAAEAAQIABQCdWnl7akEQMaEEfYaw/fhuJFW+jn/vFq7yPbIJcj2vlB9hIm05vuoZ0zTxfC/rzifhJkbYRnWSTrsCuc2upocn4wAAAABBxD4gAAAAAAAJ2WD////4AAAAAEIrzm4AAAAAAAn/ewEAAAABAAAAAgAAAABkT+RdAAAAAGRP5F0AAAAAZE/kXAAAAABBxC0/AAAAAAAJi/EAAAAAZE/kXLWIXWbTUV6YNI7DMlk7XRbg/bhT77Ye1dzAvPgOkWCB11ZqO6f3KG7VT0rn6YP0QgrgseDziS4R+cSrEHu617kAAAAAZCplIAAAAAAAEu4I////+AAAAABkvzOKAAAAAAAQZDgBAAAAAQAAAAIAAAAAZE/kXQAAAABkT+RdAAAAAGRP5FwAAAAAZCplIAAAAAAAFIotAAAAAGRP5Fw3+21L/xkSgKfP+Av17aeofBUakdmoW6So+OLPlX5BjbMn2c8OzXk6F1+nCsjS3BCdRGJ1jlVpYsSoewLsTz8VAAAAAC1gXb0AAAAAAAdkLv////gAAAAALZa00gAAAAAABpwgAQAAAAEAAAACAAAAAGRP5F0AAAAAZE/kXQAAAABkT+RcAAAAAC1gXb0AAAAAAAdkLgAAAABkT+RcHNsaXh40VtKXfuDT1wdlI58IpChVuVCP1HnhXG3E0f7s9VN3DZsQll+Ptkdx6T9WkKGC7cMr5KMjbgyqpuBYGgAAAAewLri2AAAAAAEnq0n////4AAAAB7uEHmgAAAAAAV8hnAEAAAABAAAAAgAAAABkT+RdAAAAAGRP5F0AAAAAZE/kXAAAAAewBz2PAAAAAAE4kisAAAAAZE/kXGogZxwOP4yyGc4/RuWuCWpPL9+TbSvU2okl9wCH1R3YMAKUeVmHlykONjihcSwpveI2fQ7KeU93iyW1pHLxkt4AAAACtJQuKQAAAAAAn4lX////+AAAAAK3aIHUAAAAAACmrg4BAAAAAQAAAAIAAAAAZE/kXQAAAABkT+RdAAAAAGRP5FwAAAACtJOhZQAAAAAAnAlPAAAAAGRP5Fw=";
    create_price_feeds(wallet, registry, vaa_bytes)
}

main();

async function create_price_feeds(
    signer: RawSigner,
    registry: any,
    vaa_bytes: string
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
        tx.makeMoveVec({ objects: [verified_vaa] }), // has type vector<VAA>
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
