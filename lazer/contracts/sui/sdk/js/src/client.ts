import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";

export function addParseAndVerifyLeEcdsaUpdateCall({
  tx,
  packageId,
  stateObjectId,
  updateBytes,
}: {
  tx: Transaction;
  packageId: string;
  stateObjectId: string;
  updateBytes: Uint8Array;
}) {
  const [updateObj] = tx.moveCall({
    target: `${packageId}::pyth_lazer::parse_and_verify_le_ecdsa_update`,
    arguments: [
      tx.object(stateObjectId),
      tx.object(SUI_CLOCK_OBJECT_ID),
      tx.pure(bcs.vector(bcs.U8).serialize(updateBytes).toBytes()),
    ],
  });
  return updateObj;
}
