// biome-ignore-all lint/suspicious/noExplicitAny: Legacy code uses any for flexibility
import { execSync } from "node:child_process";
import type { SuiClient } from "@mysten/sui/client";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromB64, MIST_PER_SUI, normalizeSuiObjectId } from "@mysten/sui/utils";
import type { SuiPriceFeedContract } from "@pythnetwork/contract-manager/core/contracts/sui";

export function buildForBytecodeAndDigest(packagePath: string) {
  const buildOutput: {
    modules: string[];
    dependencies: string[];
    digest: number[];
  } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 -p ${packagePath} 2> /dev/null`,
      { encoding: "utf-8" },
    ),
  );
  return {
    dependencies: buildOutput.dependencies.map((d: string) =>
      normalizeSuiObjectId(d),
    ),
    digest: Buffer.from(buildOutput.digest),
    modules: buildOutput.modules.map((m: string) => Array.from(fromB64(m))),
  };
}

export async function upgradePyth(
  keypair: Ed25519Keypair,
  provider: SuiClient,
  modules: number[][],
  dependencies: string[],
  signedVaa: Buffer,
  contract: SuiPriceFeedContract,
) {
  const pythPackage = await contract.getPackageId(contract.stateId);

  const tx = new Transaction();

  const verificationReceipt = await contract.getVaaVerificationReceipt(
    tx as any,
    pythPackage,
    signedVaa,
  );

  // Authorize upgrade.
  const [upgradeTicket] = tx.moveCall({
    arguments: [tx.object(contract.stateId), verificationReceipt as any],
    target: `${pythPackage}::contract_upgrade::authorize_upgrade`,
  });

  // Build and generate modules and dependencies for upgrade.
  const [upgradeReceipt] = tx.upgrade({
    dependencies,
    modules,
    package: pythPackage,
    ticket: upgradeTicket!,
  });

  // Commit upgrade.
  tx.moveCall({
    arguments: [tx.object(contract.stateId), upgradeReceipt!],
    target: `${pythPackage}::contract_upgrade::commit_upgrade`,
  });

  tx.setGasBudget(MIST_PER_SUI / 4n); // 0.25 SUI

  return provider.signAndExecuteTransaction({
    options: {
      showEffects: true,
      showEvents: true,
    },
    signer: keypair,
    transaction: tx,
  });
}

export async function migratePyth(
  keypair: Ed25519Keypair,
  provider: SuiClient,
  signedUpgradeVaa: Buffer,
  contract: SuiPriceFeedContract,
  pythPackageOld: string,
) {
  const pythPackage = await contract.getPackageId(contract.stateId);
  const tx = new Transaction();
  // The pyth package version is not updated yet, therefore we can not get the verification receipts from the new
  // package yet. We need to use the old package id to get the verification receipt in this transaction and then submit
  // it to the migrate function in the new package!
  const verificationReceipt = await contract.getVaaVerificationReceipt(
    tx,
    pythPackageOld,
    signedUpgradeVaa,
  );
  tx.moveCall({
    arguments: [tx.object(contract.stateId), verificationReceipt as any],
    target: `${pythPackage}::migrate::migrate`,
  });

  tx.setGasBudget(MIST_PER_SUI / 10n); //0.1 SUI

  return provider.signAndExecuteTransaction({
    options: {
      showEffects: true,
      showEvents: true,
    },
    signer: keypair,
    transaction: tx,
  });
}
