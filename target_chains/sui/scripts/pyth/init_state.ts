import dotenv from "dotenv";

import {
  RawSigner,
  TransactionBlock,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@mysten/sui.js";

import { REGISTRY, NETWORK, INITIAL_DATA_SOURCES } from "../registry";
dotenv.config({ path: "~/.env" });

// ================== Network dependent settings ==================
let network = NETWORK.MAINNET; // <= NOTE: Update this when changing network
let walletPrivateKey = process.env.SUI_MAINNET; // <= NOTE: Update this when changing network
// ================================================================

const registry = REGISTRY[network];
const initial_data_sources = INITIAL_DATA_SOURCES[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("Wallet key unset in environment");
  }

  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );

  const PYTH_PACKAGE = registry["PYTH_PACKAGE_ID"];

  // NOTE: Set these before calling init_pyth
  const upgradeCap =
    "0x82d5b1ab3bd40d121f1a9b073815f241ccd696edf324d2a386d38477f0834082";
  const deployerCap =
    "0x5bc07a9e7627534680313a2a0499cbbaa76c4b50db30eb86e85ae211c26fc911";

  init_pyth(wallet, PYTH_PACKAGE, deployerCap, upgradeCap);
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
  console.log("GOVERNANCE_CHAIN: ", initial_data_sources["GOVERNANCE_CHAIN"]);
  console.log("GOVERNANCE_ADDRESS: ", [
    ...Buffer.from(initial_data_sources["GOVERNANCE_ADDRESS"], "hex"),
  ]);
  console.log(
    "DATA_SOURCE_CHAINS: ",
    initial_data_sources["DATA_SOURCE_CHAINS"]
  );
  console.log(
    "DATA_SOURCE_ADDRESSES: ",
    initial_data_sources["DATA_SOURCE_ADDRESSES"].map((x) => [
      ...Buffer.from(x, "hex"),
    ])
  );
  const tx = new TransactionBlock();

  tx.moveCall({
    target: `${pythPackage}::pyth::init_pyth`,
    arguments: [
      tx.object(deployerCap),
      tx.object(upgradeCap),
      tx.pure(60), // stale price threshold
      tx.pure(initial_data_sources["GOVERNANCE_CHAIN"]), // governance emitter chain id
      tx.pure([
        ...Buffer.from(initial_data_sources["GOVERNANCE_ADDRESS"], "hex"),
      ]), // governance emitter chain address
      tx.pure(initial_data_sources["DATA_SOURCE_CHAINS"]), // data source emitter chain ids
      tx.pure(
        initial_data_sources["DATA_SOURCE_ADDRESSES"].map((x) => [
          ...Buffer.from(x, "hex"),
        ])
      ), // data source addresses
      tx.pure(1), // base update fee
    ],
  });

  tx.setGasBudget(2_000_000_000n);

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
  console.log(result);
  return result;
}
