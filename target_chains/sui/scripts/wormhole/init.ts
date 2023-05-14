/// Initialize Wormhole on Sui testnet
import {
  fromB64,
  getPublishedObjectChanges,
  normalizeSuiObjectId,
  RawSigner,
  TransactionBlock,
  SUI_CLOCK_OBJECT_ID,
  JsonRpcProvider,
  Ed25519Keypair,
  testnetConnection,
  Connection,
} from "@mysten/sui.js";
import { execSync } from "child_process";
import fs from "fs";
import { resolve } from "path";

import dotenv from "dotenv";

import { REGISTRY, NETWORK } from "../registry";

dotenv.config({ path: "~/.env" });

// Network dependent settings
let network = NETWORK.TESTNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET; // <= NOTE: Update this when changing network

// Load registry and provider.
const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("SUI_TESTNET unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );
  await init_wormhole(wallet, registry["WORMHOLE_PACKAGE_ID"]);
}

main();

async function init_wormhole(signer: RawSigner, WORMHOLE_PACKAGE_ID: string) {
  try {
    const tx = new TransactionBlock();

    tx.setGasBudget(2500000000);

    let DEPLOYER_CAP =
      "0x922ff3519eb0e71afaa7c6a7a8a1d074a2269d8ace73e8147bee286dd2d122a1";
    let UPGRADE_CAP =
      "0x21a346dae01e5f57829f8a2a0bf744b6be4e6d1131faf218b82f0f96708be99f";
    let GOVERNANCE_CHAIN = 1;
    let GOVERNANCE_CONTRACT = "04";
    let GUARDIAN_SET_INDEX = 0; // this should be 3 or higher for mainnet (can check by parsing VAA)
    let INITIAL_GUARDIANS = ["13947bd48b18e53fdaeee77f3473391ac727c638"]; // testnet guardian
    // Ordered mainnet guardians
    //   let INITIAL_MAINNET_GUARDIANS =
    //   [
    //     "58CC3AE5C097b213cE3c81979e1B9f9570746AA5",
    //     "fF6CB952589BDE862c25Ef4392132fb9D4A42157",
    //     "114De8460193bdf3A2fCf81f86a09765F4762fD1",
    //     "107A0086b32d7A0977926A205131d8731D39cbEB",
    //     "8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2",
    //     "11b39756c042441be6d8650b69b54ebe715e2343",
    //     "54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd",
    //     "15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20",
    //     "74a3bf913953D695260D88BC1aA25A4eeE363ef0",
    //     "000aC0076727b35FBea2dAc28fEE5cCB0fEA768e",
    //     "AF45Ced136b9D9e24903464AE889F5C8a723FC14",
    //     "f93124b7c738843CBB89E864c862c38cddCccF95",
    //     "D2CC37A4dc036a8D232b48f62cDD4731412f4890",
    //     "DA798F6896A3331F64b48c12D1D57Fd9cbe70811",
    //     "71AA1BE1D36CaFE3867910F99C09e347899C19C3",
    //     "8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf",
    //     "178e21ad2E77AE06711549CFBB1f9c7a9d8096e8",
    //     "5E1487F35515d02A92753504a8D75471b9f49EdB",
    //     "6FbEBc898F403E4773E95feB15E80C9A99c8348d"
    // ]

    let GUARDIAN_SECONDS_TO_LIVE = "1000000000";
    let MESSAGE_FEE = 0;

    tx.moveCall({
      target: `${WORMHOLE_PACKAGE_ID}::setup::complete`,
      arguments: [
        tx.object(DEPLOYER_CAP),
        tx.object(UPGRADE_CAP),
        tx.pure(GOVERNANCE_CHAIN),
        tx.pure(GOVERNANCE_CONTRACT),
        tx.pure(GUARDIAN_SET_INDEX),
        tx.pure(INITIAL_GUARDIANS.map((x) => [...Buffer.from(x, "hex")])),
        tx.pure(GUARDIAN_SECONDS_TO_LIVE),
        tx.pure(MESSAGE_FEE),
      ],
    });

    let res = await signer.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: {
        showInput: true,
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
        showBalanceChanges: true,
      },
    });
    console.log(res);

    // Return publish transaction info
    return res;
  } catch (e) {
    throw e;
  } finally {
  }
}
