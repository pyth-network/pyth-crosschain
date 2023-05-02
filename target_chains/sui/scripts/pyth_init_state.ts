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

let network = NETWORK.TESTNET // <= Update this when changing network
const registry = REGISTRY[network]
const initial_data_sources = INITIAL_DATA_SOURCES[network]
const provider = new JsonRpcProvider(new Connection({ fullnode: registry["RPC_URL"]}))
let walletPrivateKey = process.env.SUI_TESTNET_BASE_64; // <= Update this when changing network

async function main() {
    if (walletPrivateKey === undefined) {
      throw new Error("SUI_TESTNET unset in environment");
    }

    const wallet = new RawSigner(
        Ed25519Keypair.fromSecretKey(
          Buffer.from(walletPrivateKey, "base64").subarray(1)
        ),
     provider
    );

    const PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"]

    // Note: Set these before calling init_pyth
    const upgradeCap = "0xf253b931426f2aba0b0150b86323a41061b6e6e34e7f88f07a80c01d8903d442"
    const deployerCap = "0x26a3696ca84a81f0545c66093b63245cc32f2907c823d89d7eb1146ae12f27ca"

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
    console.log("GOVERNANCE_CHAIN: ", initial_data_sources["GOVERNANCE_CHAIN"])
    console.log("GOVERNANCE_ADDRESS: ", [...Buffer.from(initial_data_sources["GOVERNANCE_ADDRESS"], "hex")])
    console.log("DATA_SOURCE_CHAINS: ", initial_data_sources["DATA_SOURCE_CHAINS"])
    console.log("DATA_SOURCE_ADDRESSES: ", initial_data_sources["DATA_SOURCE_ADDRESSES"].map( x => [...Buffer.from(x, "hex")]))
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
