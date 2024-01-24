import {
  fromB64,
  MIST_PER_SUI,
  normalizeSuiObjectId,
  RawSigner,
  TransactionBlock,
} from "@mysten/sui.js";
import { execSync } from "child_process";
import { SuiPriceFeedContract } from "contract_manager";

export function buildForBytecodeAndDigest(packagePath: string) {
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

export async function upgradePyth(
  signer: RawSigner,
  modules: number[][],
  dependencies: string[],
  signedVaa: Buffer,
  contract: SuiPriceFeedContract
) {
  const pythPackage = await contract.getPackageId(contract.stateId);

  const tx = new TransactionBlock();
  const verificationReceipt = await contract.getVaaVerificationReceipt(
    tx,
    pythPackage,
    signedVaa
  );

  // Authorize upgrade.
  const [upgradeTicket] = tx.moveCall({
    target: `${pythPackage}::contract_upgrade::authorize_upgrade`,
    arguments: [tx.object(contract.stateId), verificationReceipt],
  });

  // Build and generate modules and dependencies for upgrade.
  const [upgradeReceipt] = tx.upgrade({
    modules,
    dependencies,
    packageId: pythPackage,
    ticket: upgradeTicket,
  });

  // Commit upgrade.
  tx.moveCall({
    target: `${pythPackage}::contract_upgrade::commit_upgrade`,
    arguments: [tx.object(contract.stateId), upgradeReceipt],
  });

  tx.setGasBudget(MIST_PER_SUI / 4n); // 0.25 SUI

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });
}

export async function migratePyth(
  signer: RawSigner,
  signedUpgradeVaa: Buffer,
  contract: SuiPriceFeedContract,
  pythPackageOld: string
) {
  const pythPackage = await contract.getPackageId(contract.stateId);
  const tx = new TransactionBlock();
  // The pyth package version is not updated yet, therefore we can not get the verification receipts from the new
  // package yet. We need to use the old package id to get the verification receipt in this transaction and then submit
  // it to the migrate function in the new package!
  const verificationReceipt = await contract.getVaaVerificationReceipt(
    tx,
    pythPackageOld,
    signedUpgradeVaa
  );
  tx.moveCall({
    target: `${pythPackage}::migrate::migrate`,
    arguments: [tx.object(contract.stateId), verificationReceipt],
  });

  tx.setGasBudget(MIST_PER_SUI / 10n); //0.1 SUI

  return signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });
}
