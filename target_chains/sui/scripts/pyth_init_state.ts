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
} from "@optke3/sui.js";

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
    const upgradeCap = "0xf23ac8c9b43c96a1cfcd4b78929b1da0b2e184966e7ea81eaefb911eebae4196"
    const deployerCap = "0xe9d0e33aea42915a82e8ac8a4dbf015b0410afe1fcfbbd700ed820670468c9fc"

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
