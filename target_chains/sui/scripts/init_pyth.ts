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

const provider = new JsonRpcProvider(new Connection({ fullnode: "http://0.0.0.0:9000" }))
dotenv.config({"path":"~/.env"})

async function main() {
    const walletPrivateKey = process.env.SUI_DEVNET;
    if (walletPrivateKey === undefined) {
      throw new Error("SUI_DEVNET unset in environment");
    }

    const wallet = new RawSigner(
        Ed25519Keypair.fromSecretKey(
         Buffer.from(walletPrivateKey, "base64").subarray(1)
        ),
     provider
    );

    // Note: set these before calling init_pyth
    const pythPackage = "0xb94d0d4a7ce7934e6bae2e430d5d7d5ba58c25d229aa1338ad543f0445bdfc7f"
    const deployerCap = "0x80bbb9430366fcd6d8b22769988612e202055f12787cc2abdafed5e51f78f756"
    const upgradeCap = "0xffdc98c07d8cd0d5327209153bd01fedb0b15862da99eb3a837931a44202d48b"

    init_pyth(wallet, pythPackage, deployerCap, upgradeCap)
}

main();

/// Use a programmable transaction block to call
/// the Pyth pyth::pyth::init_pyth function.
async function init_pyth(
    signer: RawSigner,
    pythPackage: string,
    deployerCap: string,
    upgradeCap: string
) {

    const tx = new TransactionBlock();

    tx.moveCall({
      target: `${pythPackage}::pyth::init_pyth`,
      arguments: [
        tx.object(deployerCap),
        tx.object(upgradeCap),
        tx.pure(1000), // stale price threshold
        tx.pure(121), // governance emitter chain id
        tx.pure("3"), // governance emitter chain address
        tx.pure([121]), // data source emitter chain ids
        tx.pure(["3"]), // data source addresses
        tx.pure(0), // base update fee
      ],
    });

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
