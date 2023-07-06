import * as mock from "@certusone/wormhole-sdk/lib/cjs/mock";
import dotenv from "dotenv";

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
import { execSync } from "child_process";
import { resolve } from "path";
import * as fs from "fs";

import { REGISTRY, NETWORK } from "../registry";

dotenv.config({ path: "~/.env" });

// Network dependent settings.
let network = NETWORK.TESTNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET_ALT_KEY_BASE_64 // <= NOTE: Update this when changing network

const guardianPrivateKey = process.env.WH_TESTNET_GUARDIAN_PRIVATE_KEY

const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

const PYTH_STATE_ID = registry["PYTH_STATE_ID"]
const PYTH_PACKAGE_ID = registry["PYTH_PACKAGE_ID"]
const WORMHOLE_STATE_ID = registry["WORMHOLE_STATE_ID"]
const WORMHOLE_PACKAGE_ID = registry["WORMHOLE_PACKAGE_ID"]
console.log("WORMHOLE_STATE_ID: ", WORMHOLE_STATE_ID)
console.log("PYTH_STATE_ID: ", WORMHOLE_STATE_ID)

const GOVERNANCE_EMITTER =
  //"0000000000000000000000000000000000000000000000000000000000000004";
  "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385";

async function main() {
  if (guardianPrivateKey === undefined) {
    throw new Error("TESTNET_GUARDIAN_PRIVATE_KEY unset in environment");
  }
  if (walletPrivateKey === undefined) {
    throw new Error("TESTNET_WALLET_PRIVATE_KEY unset in environment");
  }
  console.log("priv key: ", walletPrivateKey)

  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(
      network == "MAINNET"
        ? Buffer.from(walletPrivateKey, "hex")
        : Buffer.from(walletPrivateKey, "base64")
    ),
    provider
  );

  console.log("wallet address: ", wallet.getAddress());

  const pythContractsPath = resolve(`${__dirname}/../../contracts`);

  // Build for digest.
  const { modules, dependencies, digest } =
    buildForBytecodeAndDigest(pythContractsPath);
  console.log("dependencies", dependencies);
  console.log("digest", digest.toString("hex"));

  // We will use the signed VAA when we execute the upgrade.
  const guardians = new mock.MockGuardians(0, [guardianPrivateKey]);
  const timestamp = 12345678;
  const governance = new mock.GovernanceEmitter(GOVERNANCE_EMITTER);

  //const module = Buffer.alloc(32)
  //module.write("1", 31)
  const module = "1"
  const action = 0
  const chain = 21

  // construct payload

  const magic = Buffer.alloc(4);
  magic.write("PTGM", 0); // magic
  console.log("magic buffer: ", magic)
  let inner_payload = Buffer.alloc(100)
  inner_payload.write(magic.toString(), 0) // magic = "PTGM"
  inner_payload.writeUInt8(1, 4); // moduleName = 1
  inner_payload.writeUInt8(0, 5); // action = 0
  inner_payload.writeUInt16BE(21, 6); // target chain = 21

  // create governance message
  let msg = governance.publishGovernanceMessage(timestamp, module, inner_payload, action, chain)

  // const published = governance.publishWormholeUpgradeContract(
  //   timestamp,
  //   2,
  //   "0x" + digest.toString("hex") // where is contract address (digest) used, if at all?
  // );

  // sign governance message
  const signedVaa = guardians.addSignatures(msg, [0]);
  console.log("Upgrade VAA:", signedVaa.toString("hex"));

  // // And execute upgrade with governance VAA.
  const upgradeResults = await upgradePyth(
    wallet,
    PYTH_STATE_ID,
    WORMHOLE_STATE_ID,
    modules,
    dependencies,
    signedVaa
  );

  console.log("tx digest", upgradeResults.digest);
  console.log("tx effects", JSON.stringify(upgradeResults.effects!));
  console.log("tx events", JSON.stringify(upgradeResults.events!));

//   const migrateResults = await migratePyth(
//     wallet,
//     PYTH_STATE_ID,
//     WORMHOLE_STATE_ID,
//     signedVaa
//   );
//   console.log("tx digest", migrateResults.digest);
//   console.log("tx effects", JSON.stringify(migrateResults.effects!));
//   console.log("tx events", JSON.stringify(migrateResults.events!));
}

main();

function buildForBytecodeAndDigest(packagePath: string) {
  const buildOutput: {
    modules: string[];
    dependencies: string[];
    digest: number[];
  } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 -p ${packagePath} 2> /dev/null`,
      { encoding: "utf-8" }
    )
  );
  return {
    modules: buildOutput.modules.map((m: string) => Array.from(fromB64(m))),
    dependencies: buildOutput.dependencies.map((d: string) =>
      normalizeSuiObjectId(d)
    ),
    digest: Buffer.from(buildOutput.digest),
  };
}

async function getPackageId(
  provider: JsonRpcProvider,
  stateId: string
): Promise<string> {
  const state = await provider
    .getObject({
      id: stateId,
      options: {
        showContent: true,
      },
    })
    .then((result) => {
      if (result.data?.content?.dataType == "moveObject") {
        return result.data.content.fields;
      }

      throw new Error("not move object");
    });

  if ("upgrade_cap" in state) {
    return state.upgrade_cap.fields.package;
  }

  throw new Error("upgrade_cap not found");
}

async function upgradePyth(
  signer: RawSigner,
  pythStateId: string,
  wormholeStateId: string,
  modules: number[][],
  dependencies: string[],
  signedVaa: Buffer
) {
  const pythPackage = await getPackageId(
    signer.provider,
    pythStateId
  );
  const wormholePackage = await getPackageId(signer.provider, wormholeStateId);

  console.log("pythPackage: ", pythPackage)
  console.log("wormholePackage: ", wormholePackage)

  const tx = new TransactionBlock();

  // this works
  const [verifiedVaa] = tx.moveCall({
    target: `${wormholePackage}::vaa::parse_and_verify`,
    arguments: [
      tx.object(wormholeStateId),
      tx.pure(Array.from(signedVaa)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  // does this work?
  const [decreeTicket] = tx.moveCall({
    target: `${pythPackage}::contract_upgrade::authorize_governance`,
    arguments: [tx.object(pythStateId)],
  });

  const [decreeReceipt] = tx.moveCall({
    target: `${wormholePackage}::governance_message::verify_vaa`,
    arguments: [tx.object(wormholeStateId), verifiedVaa, decreeTicket],
    typeArguments: [
      `${pythPackage}::governance_witness::GovernanceWitness`,
    ],
  });

  // // Authorize upgrade.
  // const [upgradeTicket] = tx.moveCall({
  //   target: `${pythPackage}::contract_upgrade::authorize_upgrade`,
  //   arguments: [tx.object(pythStateId), decreeReceipt],
  // });

  // // Build and generate modules and dependencies for upgrade.
  // const [upgradeReceipt] = tx.upgrade({
  //   modules,
  //   dependencies,
  //   packageId: pythPackage,
  //   ticket: upgradeTicket,
  // });

  // // Commit upgrade.
  // tx.moveCall({
  //   target: `${pythPackage}::contract_upgrade::commit_upgrade`,
  //   arguments: [tx.object(pythStateId), upgradeReceipt],
  // });

  tx.setGasBudget(2_000_000_000n);

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });
}

async function migratePyth(
  signer: RawSigner,
  pythStateId: string,
  wormholeStateId: string,
  signedUpgradeVaa: Buffer
) {
  const pythPackage = await getPackageId(
    signer.provider,
    pythStateId
  );
  const wormholePackage = await getPackageId(signer.provider, wormholeStateId);

  const tx = new TransactionBlock();

  const [verifiedVaa] = tx.moveCall({
    target: `${wormholePackage}::vaa::parse_and_verify`,
    arguments: [
      tx.object(wormholeStateId),
      tx.pure(Array.from(signedUpgradeVaa)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  const [decreeTicket] = tx.moveCall({
    target: `${pythPackage}::contract_upgrade::authorize_governance`,
    arguments: [tx.object(pythStateId)],
  });
  const [decreeReceipt] = tx.moveCall({
    target: `${wormholePackage}::governance_message::verify_vaa`,
    arguments: [tx.object(wormholeStateId), verifiedVaa, decreeTicket],
    typeArguments: [
      `${pythPackage}::governance_witness::GovernanceWitness`,
    ],
  });
  tx.moveCall({
    target: `${pythPackage}::migrate::migrate`,
    arguments: [tx.object(pythStateId), decreeReceipt],
  });

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });
}
