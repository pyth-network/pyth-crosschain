import dotenv from "dotenv"

import {
  RawSigner,
  TransactionBlock,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@optke3/sui.js";

import {REGISTRY, NETWORK, INITIAL_DATA_SOURCES} from "../registry"
dotenv.config({"path":"~/.env"})

let network = NETWORK.MAINNET // <= Update this when changing network
const registry = REGISTRY[network]
const initial_data_sources = INITIAL_DATA_SOURCES[network]
const provider = new JsonRpcProvider(new Connection({ fullnode: registry["RPC_URL"]}))
let walletPrivateKey = process.env.SUI_MAINNET; // <= Update this when changing network

async function main() {
    if (walletPrivateKey === undefined) {
      throw new Error("SUI_MAINNET unset in environment");
    }

    const wallet = new RawSigner(
        Ed25519Keypair.fromSecretKey(
          Buffer.from(walletPrivateKey, "hex")
        ),
     provider
    );

    const PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"]

    // Note: Set these before calling init_pyth
    const upgradeCap = "0x92d51150b762fd694877b23ecaba79a3fc1032bc24914d145a393b62e1e61894"
    const deployerCap = "0x645ba70c9087d54a3e5e6abed0d506516dddb71d987b0ee503593de2677caefe"

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
