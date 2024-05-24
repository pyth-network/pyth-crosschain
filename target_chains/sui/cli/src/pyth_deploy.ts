import { TransactionBlock } from "@mysten/sui.js/transactions";

import {
  MIST_PER_SUI,
  normalizeSuiObjectId,
  fromB64,
} from "@mysten/sui.js/utils";

import { Ed25519Keypair } from "@mysten/sui.js/dist/cjs/keypairs/ed25519";
import { execSync } from "child_process";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { SuiClient } from "@mysten/sui.js/client";

export async function publishPackage(
  keypair: Ed25519Keypair,
  provider: SuiClient,
  packagePath: string
): Promise<{ packageId: string; upgradeCapId: string; deployerCapId: string }> {
  // Build contracts
  const buildOutput: {
    modules: string[];
    dependencies: string[];
  } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 --path ${__dirname}/${packagePath} 2> /dev/null`,
      {
        encoding: "utf-8",
      }
    )
  );

  console.log("buildOutput: ", buildOutput);

  // Publish contracts
  const transactionBlock = new TransactionBlock();

  transactionBlock.setGasBudget(MIST_PER_SUI / 2n); // 0.5 SUI

  const [upgradeCap] = transactionBlock.publish({
    modules: buildOutput.modules.map((m: string) => Array.from(fromB64(m))),
    dependencies: buildOutput.dependencies.map((d: string) =>
      normalizeSuiObjectId(d)
    ),
  });

  // Transfer upgrade capability to deployer
  transactionBlock.transferObjects(
    [upgradeCap],
    transactionBlock.pure(keypair.toSuiAddress())
  );

  // Execute transactions
  const result = await provider.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock,
    options: {
      showInput: true,
      showObjectChanges: true,
    },
  });

  const publishedChanges = result.objectChanges?.filter(
    (change) => change.type === "published"
  );

  if (
    publishedChanges?.length !== 1 ||
    publishedChanges[0].type !== "published"
  ) {
    throw new Error(
      "No publish event found in transaction:" +
        JSON.stringify(result.objectChanges, null, 2)
    );
  }

  const packageId = publishedChanges[0].packageId;

  console.log("Published with package id: ", packageId);
  console.log("Tx digest", result.digest);
  let upgradeCapId: string | undefined;
  let deployerCapId: string | undefined;
  for (const objectChange of result.objectChanges!) {
    if (objectChange.type === "created") {
      if (objectChange.objectType === "0x2::package::UpgradeCap") {
        upgradeCapId = objectChange.objectId;
      }
      if (objectChange.objectType === `${packageId}::setup::DeployerCap`) {
        deployerCapId = objectChange.objectId;
      }
    }
  }
  if (!upgradeCapId || !deployerCapId) {
    throw new Error("Could not find upgrade cap or deployer cap");
  }
  console.log("UpgradeCapId: ", upgradeCapId);
  console.log("DeployerCapId: ", deployerCapId);
  return {
    packageId,
    upgradeCapId: upgradeCapId,
    deployerCapId: deployerCapId,
  };
}

export async function initPyth(
  keypair: Ed25519Keypair,
  provider: SuiClient,
  pythPackageId: string,
  deployerCapId: string,
  upgradeCapId: string,
  config: {
    dataSources: DataSource[];
    governanceDataSource: DataSource;
  }
) {
  const tx = new TransactionBlock();

  const baseUpdateFee = tx.pure(1);
  const dataSourceEmitterAddresses = tx.pure(
    config.dataSources.map((dataSource) => [
      ...Buffer.from(dataSource.emitterAddress, "hex"),
    ])
  );
  const dataSourceEmitterChainIds = tx.pure(
    config.dataSources.map((dataSource) => dataSource.emitterChain)
  );
  const governanceEmitterAddress = tx.pure([
    ...Buffer.from(config.governanceDataSource.emitterAddress, "hex"),
  ]);
  const governanceEmitterChainId = tx.pure(
    config.governanceDataSource.emitterChain
  );
  const stalePriceThreshold = tx.pure(60);
  tx.moveCall({
    target: `${pythPackageId}::pyth::init_pyth`,
    arguments: [
      tx.object(deployerCapId),
      tx.object(upgradeCapId),
      stalePriceThreshold,
      governanceEmitterChainId,
      governanceEmitterAddress,
      dataSourceEmitterChainIds,
      dataSourceEmitterAddresses,
      baseUpdateFee,
    ],
  });

  tx.setGasBudget(MIST_PER_SUI / 10n); // 0.1 sui

  let result = await provider.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: tx,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });
  if (!result.effects || !result.objectChanges) {
    throw new Error("No effects or object changes found in transaction");
  }
  if (result.effects.status.status === "success") {
    console.log("Pyth init successful");
    console.log("Tx digest", result.digest);
  }
  for (const objectChange of result.objectChanges) {
    if (objectChange.type === "created") {
      if (objectChange.objectType === `${pythPackageId}::state::State`) {
        console.log("Pyth state id: ", objectChange.objectId);
      }
    }
  }
  return result;
}
