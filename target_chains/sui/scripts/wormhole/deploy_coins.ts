/// Deploy Pyth to Sui testnet (devnet deploy can be done via CLI)
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

  // Network dependent settings.
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
    await publishPackage(wallet, "~/developer/wormhole/sui/examples/coins");
  }

  main();

  async function publishPackage(
    signer: RawSigner,
    //network: Network,
    packagePath: string
  ) {
    try {
      // Build contracts
      const buildOutput: {
        modules: string[];
        dependencies: string[];
      } = JSON.parse(
        execSync(
          `sui move build --dump-bytecode-as-base64 --path ${packagePath} 2> /dev/null`,
          {
            encoding: "utf-8",
          }
        )
      );
  
      console.log("buildOutput: ", buildOutput);
  
      // Publish contracts
      const transactionBlock = new TransactionBlock();
  
      // important
      transactionBlock.setGasBudget(5000000000);
  
      const [upgradeCap] = transactionBlock.publish({
        modules: buildOutput.modules.map((m: string) => Array.from(fromB64(m))),
        dependencies: buildOutput.dependencies.map((d: string) =>
          normalizeSuiObjectId(d)
        ),
      });
  
      // Transfer upgrade capability to deployer
      transactionBlock.transferObjects(
        [upgradeCap],
        transactionBlock.pure(await signer.getAddress())
      );
  
      // Execute transactions
      const res = await signer.signAndExecuteTransactionBlock({
        transactionBlock,
        options: {
          showInput: true,
          showObjectChanges: true,
        },
      });
  
      // Update network-specific Move.toml with package ID
      const publishEvents = getPublishedObjectChanges(res);
      if (publishEvents.length !== 1) {
        throw new Error(
          "No publish event found in transaction:" +
            JSON.stringify(res.objectChanges, null, 2)
        );
      }
  
      // Return publish transaction info
      return res;
    } catch (e) {
      throw e;
    } finally {
    }
  }
  