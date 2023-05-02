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

import {REGISTRY, NETWORK, INITIAL_DATA_SOURCES} from "./registry"
dotenv.config({"path":"~/.env"})

let network = NETWORK.DEVNET
const registry = REGISTRY[network]
const initial_data_sources = INITIAL_DATA_SOURCES[network]
const provider = new JsonRpcProvider(new Connection({ fullnode: registry["RPC_URL"]}))
let walletPrivateKey = process.env.SUI_DEVNET; // <= Update this with the right private key

async function main() {
    if (walletPrivateKey === undefined) {
      throw new Error("SUI_DEVNET unset in environment");
    }

    const wallet = new RawSigner(
        Ed25519Keypair.fromSecretKey(
          Buffer.from(walletPrivateKey, "base64").subarray(1)
        ),
     provider
    );

    const PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"]

    // Note: Set these before calling init_pyth
    const upgradeCap = "0x83d655518f83d791b9617d6ec5bd62c4ef369d08e0cfd737902b4ca8f2a4695d"
    const deployerCap = "0x272d403533abb081e0fd1fd53c5a9c1526bb10e75f7f2b6154953bee7ebe5f55"

    init_pyth(wallet, PYTH_PACKAGE, deployerCap, upgradeCap)
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
        tx.pure(60), // stale price threshold
        tx.pure(initial_data_sources["GOVERNANCE_CHAIN"]), // governance emitter chain id
        tx.pure([...Buffer.from(initial_data_sources["GOVERNANCE_ADDRESS"], "hex")]), // governance emitter chain address
        tx.pure(initial_data_sources["DATA_SOURCE_CHAINS"]), // data source emitter chain ids
        tx.pure(initial_data_sources["DATA_SOURCE_ADDRESSES"].map( x => [...Buffer.from(x, "hex")])), // data source addresses
        tx.pure(1), // base update fee
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
