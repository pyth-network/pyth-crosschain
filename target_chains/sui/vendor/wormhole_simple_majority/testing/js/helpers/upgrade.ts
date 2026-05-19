import type { RawSigner } from "@mysten/sui.js";
import { SUI_CLOCK_OBJECT_ID, TransactionBlock } from "@mysten/sui.js";
import { buildForBytecode } from "./build";
import { getPackageId } from "./utils";

export async function buildAndUpgradeWormhole(
  signer: RawSigner,
  signedVaa: Buffer,
  wormholePath: string,
  wormholeStateId: string,
) {
  const wormholePackage = await getPackageId(signer.provider, wormholeStateId);

  const tx = new TransactionBlock();

  // Authorize upgrade.
  const [upgradeTicket] = tx.moveCall({
    arguments: [
      tx.object(wormholeStateId),
      tx.pure(Array.from(signedVaa)),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
    target: `${wormholePackage}::upgrade_contract::authorize_upgrade`,
  });

  // Build and generate modules and dependencies for upgrade.
  const { modules, dependencies } = buildForBytecode(wormholePath);
  const [upgradeReceipt] = tx.upgrade({
    dependencies,
    modules,
    packageId: wormholePackage,
    ticket: upgradeTicket,
  });

  // Commit upgrade.
  tx.moveCall({
    arguments: [tx.object(wormholeStateId), upgradeReceipt],
    target: `${wormholePackage}::upgrade_contract::commit_upgrade`,
  });

  // Cannot auto compute gas budget, so we need to configure it manually.
  // Gas ~215m.
  tx.setGasBudget(215_000_000n);

  return signer.signAndExecuteTransactionBlock({
    options: {
      showEffects: true,
      showEvents: true,
    },
    transactionBlock: tx,
  });
}

export async function migrate(signer: RawSigner, stateId: string) {
  const contractPackage = await getPackageId(signer.provider, stateId);

  const tx = new TransactionBlock();
  tx.moveCall({
    arguments: [tx.object(stateId)],
    target: `${contractPackage}::migrate::migrate`,
  });

  return signer.signAndExecuteTransactionBlock({
    options: {
      showEffects: true,
      showEvents: true,
    },
    transactionBlock: tx,
  });
}
