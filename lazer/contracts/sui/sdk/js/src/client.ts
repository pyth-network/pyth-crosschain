import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";

const MAX_ARGUMENT_SIZE = 16 * 1024;

export function addParseAndVerifyLeEcdsaUpdateCall(opts: {
  tx: Transaction;
  packageId: string;
  stateObjectId: string;
  updateBytes: Buffer;
}) {
  const { tx, packageId, stateObjectId, updateBytes } = opts;
  const [updateObj] = tx.moveCall({
    target: `${packageId}::pyth_lazer::parse_and_verify_le_ecdsa_update`,
    arguments: [
      tx.object(stateObjectId),
      tx.object(SUI_CLOCK_OBJECT_ID),
      tx.pure(
        bcs.vector(bcs.U8).serialize([...updateBytes], { maxSize: MAX_ARGUMENT_SIZE }).toBytes(),
      ),
    ],
  });
  return updateObj;
}
