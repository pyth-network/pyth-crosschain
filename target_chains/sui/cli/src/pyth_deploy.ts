/* biome-ignore-all lint/suspicious/noConsole: pre-existing; CLI deploy script prints progress */
/* biome-ignore-all lint/style/noNonNullAssertion: pre-existing */

import { execSync } from "node:child_process";
import { bcs } from "@mysten/sui/bcs";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, normalizeSuiObjectId } from "@mysten/sui/utils";
import { executeSuiTransaction } from "@pythnetwork/contract-manager/core/chains";
import type { DataSource } from "@pythnetwork/xc-admin-common/governance_payload/SetDataSources";

export async function publishPackage(
  keypair: Ed25519Keypair,
  provider: ClientWithCoreApi,
  packagePath: string,
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
      },
    ),
  );

  console.log("buildOutput: ", buildOutput);

  // Publish contracts
  const txb = new Transaction();

  const [upgradeCap] = txb.publish({
    dependencies: buildOutput.dependencies.map((d: string) =>
      normalizeSuiObjectId(d),
    ),
    modules: buildOutput.modules.map((m: string) => Array.from(fromBase64(m))),
  });

  // Transfer upgrade capability to deployer
  txb.transferObjects([upgradeCap!], txb.pure.address(keypair.toSuiAddress()));

  // Execute transaction over the transport-agnostic `.core` API.
  const executed = await executeSuiTransaction(provider, txb, keypair);

  const packageId = executed.effects.changedObjects.find(
    (change) => change.outputState === "PackageWrite",
  )?.objectId;
  if (!packageId) {
    throw new Error("No published package found in transaction effects");
  }

  console.log("Published with package id: ", packageId);
  console.log("Tx digest", executed.digest);
  // Match object types by suffix: the package address in the type string is
  // normalised differently across transports, but the module/struct suffix is
  // stable.
  let upgradeCapId: string | undefined;
  let deployerCapId: string | undefined;
  for (const change of executed.effects.changedObjects) {
    if (change.idOperation !== "Created") continue;
    const objectType = executed.objectTypes[change.objectId];
    if (objectType?.endsWith("::package::UpgradeCap")) {
      upgradeCapId = change.objectId;
    }
    if (objectType?.endsWith("::setup::DeployerCap")) {
      deployerCapId = change.objectId;
    }
  }
  if (!upgradeCapId || !deployerCapId) {
    throw new Error("Could not find upgrade cap or deployer cap");
  }
  console.log("UpgradeCapId: ", upgradeCapId);
  console.log("DeployerCapId: ", deployerCapId);
  return {
    deployerCapId: deployerCapId,
    packageId,
    upgradeCapId: upgradeCapId,
  };
}

export async function initPyth(
  keypair: Ed25519Keypair,
  provider: ClientWithCoreApi,
  pythPackageId: string,
  deployerCapId: string,
  upgradeCapId: string,
  config: {
    dataSources: DataSource[];
    governanceDataSource: DataSource;
    initialSingleUpdateFee: number;
  },
) {
  const tx = new Transaction();

  const baseUpdateFee = tx.pure.u64(config.initialSingleUpdateFee);
  const dataSourceEmitterAddresses = tx.pure(
    bcs
      .vector(bcs.vector(bcs.u8()))
      .serialize(
        config.dataSources.map((dataSource) => [
          ...Buffer.from(dataSource.emitterAddress, "hex"),
        ]),
      ),
  );
  const dataSourceEmitterChainIds = tx.pure(
    bcs
      .vector(bcs.u64())
      .serialize(
        config.dataSources.map((dataSource) => dataSource.emitterChain),
      ),
  );
  const governanceEmitterAddress = tx.pure(
    bcs
      .vector(bcs.u8())
      .serialize([
        ...Buffer.from(config.governanceDataSource.emitterAddress, "hex"),
      ]),
  );
  const governanceEmitterChainId = tx.pure(
    bcs.u64().serialize(config.governanceDataSource.emitterChain),
  );
  const stalePriceThreshold = tx.pure.u64(60);
  tx.moveCall({
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
    target: `${pythPackageId}::pyth::init_pyth`,
  });

  // `executeSuiTransaction` throws on simulation / on-chain failure, so a
  // successful return means the init succeeded.
  const executed = await executeSuiTransaction(provider, tx, keypair);
  console.log("Pyth init successful");
  console.log("Tx digest", executed.digest);

  const stateId = executed.effects.changedObjects.find(
    (change) =>
      change.idOperation === "Created" &&
      executed.objectTypes[change.objectId]?.endsWith("::state::State"),
  )?.objectId;
  if (stateId) {
    console.log("Pyth state id: ", stateId);
  }
  return executed;
}
