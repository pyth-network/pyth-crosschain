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
  TypeTagSerializer
} from "@optke3/sui.js";

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
    const vaa_bytes = "AQAAAAABAD8FwBwewFlgIZEo0t7Dpu8mz9i+bPEJ5PfOWLUbxFX7AMvugmXM9tX9k+r/QxC8kIXNgMhL73KSydo2GSUstSAAZFHbwAAAAAAAGqJ4OdZBsHdDwMtfaMUfjNMdLAdivsANxvzSVDPvGrW2AAAAAAETHVsBUDJXSAADAAEAAQIABQCdKP4F0nCMZXEYKnydH/RXoiG0Ze316prxNz+VYtFrjRX5wBcroQ36TRkIjZT1v2HTtU1b10g6MiqYLhNz7o6jGwAAAphd6NU9AAAAAB6Wb4P////4AAACmAbWa0AAAAAAJefHvAEAAAABAAAAAgAAAABkUdvAAAAAAGRR28AAAAAAZFHbvwAAAphbwUynAAAAAB3wzlkAAAAAZFHbv4s423AOizRkDmgeyac+iWCL2ilBVUeiJPllhRkrS53HlLzkruiP36W1jYEJC9azeEcX+m34VBnZ8EQzuz1hXVwAAAAABWEWZgAAAAAAAKsd////+AAAAAAFXhNiAAAAAAAAw3EBAAAAAQAAAAIAAAAAZFHbwAAAAABkUdvAAAAAAGRR278AAAAABWEWZgAAAAAAAKsdAAAAAGRR2787aaPPB1ZGxf2BSLcFuBB+YaGiU9XYqENV3LYos/HRIDF3Xh1olxKeioTuupdXePtQAVuIA56bwUC72DlpSsCuAAAAAAB3mT0AAAAAAAAPk/////gAAAAAAHeFVwAAAAAAABJyAQAAAAEAAAACAAAAAGRR28AAAAAAZFHbwAAAAABkUdu/AAAAAAB3mTAAAAAAAAANrgAAAABkUdu/SGZ95ESKIEFTqpC4mv1o8FTA5ZWWxNrHr0W+iuWp6c0FqTTLO7re+TtSWXirW9PVzjuPxnF7nqGCpojF2O6OAgAAAAAO3VLRAAAAAAACEbH////4AAAAAA61qRQAAAAAAAGV1wEAAAABAAAAAgAAAABkUdvAAAAAAGRR278AAAAAZFHbvwAAAAAO3VLRAAAAAAACEbEAAAAAZFHbv1bQch5gfcAz/wK+4huZGOE7zOuX4nmi0fooiPAFat09tWItMvNtyCCvKIqrd5Ez7xIF0xI7viVmA4Sbgg3ki4cAAAAAH0BMAQAAAAAAAvAf////+AAAAAAfVHCKAAAAAAAC2YABAAAAAQAAAAIAAAAAZFHbwAAAAABkUdu/AAAAAGRR278AAAAAH0BMAQAAAAAAAvAfAAAAAGRR278="
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
        //tx.makeMoveVec({ type: TypeTagSerializer.tagToString(TypeTagSerializer.parseFromStr('0x80c60bff35fe5026e319cf3d66ae671f2b4e12923c92c45df75eaf4de79e3ce7::vaa::VAA')), objects: [verified_vaa] }), // has type vector<VAA>
        //@ts-ignore
        tx.makeMoveVec({ type: `${WORM_PACKAGE}::vaa::VAA`, objects: [verified_vaa] }), // has type vector<VAA>,
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
