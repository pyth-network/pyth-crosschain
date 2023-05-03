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

import dotenv from "dotenv"

import {REGISTRY, NETWORK} from "../registry"

dotenv.config({"path":"~/.env"})

// Network dependent settings
let network = NETWORK.TESTNET // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET; // <= NOTE: Update this when changing network

// Load registry and provider.
const registry = REGISTRY[network]
const provider = new JsonRpcProvider(new Connection({ fullnode: registry["RPC_URL"] }))

async function main(){
    if (walletPrivateKey === undefined) {
        throw new Error("SUI_TESTNET unset in environment");
      }
    const wallet = new RawSigner(
        Ed25519Keypair.fromSecretKey(
            Buffer.from(walletPrivateKey, "hex")
        ),
        provider
    );
    await init_wormhole(wallet, registry["WORMHOLE_PACKAGE_ID"]);
}

main()

 async function init_wormhole(
    signer: RawSigner,
    WORMHOLE_PACKAGE_ID: string
  ) {
    try {

      const tx = new TransactionBlock();

      tx.setGasBudget(2500000000);

      let DEPLOYER_CAP = "0x19f253b07e88634bfd5a3a749f60bfdb83c9748910646803f06b60b76319e7ba";
      let UPGRADE_CAP = "0x746cbe8c14f9ef163fc4e18c1edc6fc61041e118f7d6e751bcc4162b722636d4"
      let GOVERNANCE_CHAIN = 1;
      let GOVERNANCE_CONTRACT = "04";
      let GUARDIAN_SET_INDEX = 0;
      let INITIAL_GUARDIANS = ["13947bd48b18e53fdaeee77f3473391ac727c638"]
      let GUARDIAN_SECONDS_TO_LIVE = "100000000"
      let MESSAGE_FEE = 0

      tx.moveCall({
          target: `${WORMHOLE_PACKAGE_ID}::setup::complete`,
          arguments: [
              tx.object(DEPLOYER_CAP),
              tx.object(UPGRADE_CAP),
              tx.pure(GOVERNANCE_CHAIN),
              tx.pure(GOVERNANCE_CONTRACT),
              tx.pure(GUARDIAN_SET_INDEX),
              tx.pure(INITIAL_GUARDIANS.map(x=>[...Buffer.from(x, "hex")])),
              tx.pure(GUARDIAN_SECONDS_TO_LIVE),
              tx.pure(MESSAGE_FEE)
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
        console.log(res)

        // Return publish transaction info
        return res;
    } catch (e) {
      throw e;
    } finally {
    }
  };
