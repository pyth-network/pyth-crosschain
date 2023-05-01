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
import { Console } from "console";

const provider = new JsonRpcProvider(new Connection({ fullnode: "http://0.0.0.0:9000" }))
dotenv.config({"path":"~/.env"})

async function main() {
    // const guardianPrivateKey = process.env.TESTNET_GUARDIAN_PRIVATE_KEY;
    // if (guardianPrivateKey === undefined) {
    //   throw new Error("TESTNET_GUARDIAN_PRIVATE_KEY unset in environment");
    // }
    const walletPrivateKey = process.env.SUI_DEVNET;
    //const walletPrivateKey = "AARb87p4OlmRjUBCZOBy8iLGTWt1PVZ6gowPx7Lit+Tn";
    if (walletPrivateKey === undefined) {
      throw new Error("SUI_DEVNET unset in environment");
    }

    const wallet = new RawSigner(
        Ed25519Keypair.fromSecretKey(
         Buffer.from(walletPrivateKey, "base64").subarray(1)
        ),
     provider
    );
    console.log(wallet)

    // Note: set these before calling init_pyth
    const deployerCap = "0x480cb17f5776ef3bdf6d83cca798d8a34f5fba29ae701487b56ce0955af249f8"
    const upgradeCap = "0x558bc846ca736cd69ddf6769402c1509f74c41200ecb635f0ec0cd3acf3feeb7"

    init_pyth(wallet, deployerCap, upgradeCap)
}

main();

/// Use a programmable transaction block to call
/// the Pyth setup::init_and_share_state function.
async function init_pyth(
    signer: RawSigner,
    deployerCap: string,
    upgradeCap: string
  ) {
    const PythPackage = "0x147415b6d9215a2233649ca24f5d51b94bb9a249b381b03fb4a639fc506ebbc6"

    const tx = new TransactionBlock();

    // init_and_share_state(
    //     deployer: DeployerCap,
    //     upgrade_cap: UpgradeCap,
    //     stale_price_threshold: u64,
    //     base_update_fee: u64,
    //     governance_data_source: DataSource,
    //     sources: vector<DataSource>,
    //     ctx: &mut TxContext
    // )

    // // fun new(emitter_chain: u64, emitter_address: ExternalAddress)

    let [governance_data_source] = tx.moveCall({
        target: `${PythPackage}::data_source::new`,
        arguments: [
            tx.pure(5), // emitter chain
            tx.pure("0x0000000000000000000000000000000000000000000000000000000000000002") // emitter address
        ]
    })

    tx.moveCall({
      target: `${PythPackage}::setup::init_and_share_state`,
      arguments: [
        tx.object(deployerCap),
        tx.object(upgradeCap),
        tx.pure(1000), // stale price threshold
        tx.pure(0), // base update fee
        governance_data_source, // governance data source
        governance_data_source // vec<DataSources>
      ],
    });

    return signer.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });
  }