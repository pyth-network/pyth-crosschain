import type { TransactionBlock } from "@mysten/sui.js";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui.js";

export function addPrepareMessageAndPublishMessage(
  tx: TransactionBlock,
  wormholePackage: string,
  wormholeStateId: string,
  emitterCapId: string,
  nonce: number,
  payload: number[] | string,
): TransactionBlock {
  const [feeAmount] = tx.moveCall({
    arguments: [tx.object(wormholeStateId)],
    target: `${wormholePackage}::state::message_fee`,
  });
  const [wormholeFee] = tx.splitCoins(tx.gas, [feeAmount]);
  const [messageTicket] = tx.moveCall({
    arguments: [tx.object(emitterCapId), tx.pure(nonce), tx.pure(payload)],
    target: `${wormholePackage}::publish_message::prepare_message`,
  });
  tx.moveCall({
    arguments: [
      tx.object(wormholeStateId),
      wormholeFee,
      messageTicket,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
    target: `${wormholePackage}::publish_message::publish_message`,
  });

  return tx;
}
