/// Deploy Pyth to Sui testnet (devnet deploy can be done via CLI)
import {
  fromB64,
  getPublishedObjectChanges,
  normalizeSuiObjectId,
  RawSigner,
  TransactionBlock,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@mysten/sui.js";
import { execSync } from "child_process";

import dotenv from "dotenv";

import { REGISTRY, NETWORK } from "../registry";

dotenv.config({ path: "~/.env" });

// Network dependent settings.
let network = NETWORK.MAINNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_MAINNET; // <= NOTE: Update this when changing network

const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("SUI_MAINNET unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );
  await publishPackage(wallet, "../../contracts");
}

main();

async function publishPackage(signer: RawSigner, packagePath: string) {
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

    transactionBlock.setGasBudget(4000000000);

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

    const publishEvents = getPublishedObjectChanges(res);
    if (publishEvents.length !== 1) {
      throw new Error(
        "No publish event found in transaction:" +
          JSON.stringify(res.objectChanges, null, 2)
      );
    }

    return res;
  } catch (e) {
    throw e;
  } finally {
  }
}
