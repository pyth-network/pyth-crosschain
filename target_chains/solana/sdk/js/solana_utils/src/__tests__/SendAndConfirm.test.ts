import type { Connection } from "@solana/web3.js";
import { TransactionExpiredBlockheightExceededError } from "@solana/web3.js";

import { sendAndConfirmSerializedTransaction } from "../transaction";

it("rejects with the confirmation error when the blockhash expires", async () => {
  const signature = "expired-signature";
  const connection = {
    confirmTransaction: () =>
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new TransactionExpiredBlockheightExceededError(signature));
        }, 700);
      }),
    sendRawTransaction: () => Promise.resolve(signature),
  } as unknown as Connection;

  await expect(
    sendAndConfirmSerializedTransaction(
      new Uint8Array(),
      signature,
      { index: 0, lastIndex: 0 },
      { blockhash: "blockhash", lastValidBlockHeight: 0 },
      connection,
    ),
  ).rejects.toBeInstanceOf(TransactionExpiredBlockheightExceededError);
});
