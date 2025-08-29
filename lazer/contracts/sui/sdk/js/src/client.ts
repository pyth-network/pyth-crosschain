import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { bcs } from "@mysten/sui/bcs";
import { PythLazerClient } from "@pythnetwork/pyth-lazer-sdk";

const MAX_ARGUMENT_SIZE = 16 * 1024;

export type ObjectId = string;

export class SuiLazerClient {
  constructor(public provider: SuiClient) {}

  addParseAndVerifyLeEcdsaUpdateCall(opts: {
    tx: Transaction;
    packageId: string;
    stateObjectId: ObjectId;
    updateBytes: Buffer;
  }) {
    const { tx, packageId, stateObjectId, updateBytes } = opts;
    const [updateObj] = tx.moveCall({
      target: `${packageId}::pyth_lazer::parse_and_verify_le_ecdsa_update`,
      arguments: [
        tx.object(stateObjectId),
        tx.object(SUI_CLOCK_OBJECT_ID),
        tx.pure(
          bcs
            .vector(bcs.U8)
            .serialize(Array.from(updateBytes), { maxSize: MAX_ARGUMENT_SIZE })
            .toBytes(),
        ),
      ],
    });
    return updateObj;
  }

  static async getLeEcdsaUpdate(config: any): Promise<Buffer> {
    const lazer = await PythLazerClient.create(config);
    return new Promise<Buffer>((resolve, reject) => {
      const timeout = setTimeout(() => {
        lazer.shutdown();
        reject(new Error("Timed out waiting for leEcdsa update"));
      }, 5000);
      lazer.addMessageListener((event) => {
        if (event.type === "binary" && event.value.leEcdsa) {
          clearTimeout(timeout);
          const buf = event.value.leEcdsa;
          lazer.shutdown();
          resolve(buf);
        }
      });
    });
  }
}
