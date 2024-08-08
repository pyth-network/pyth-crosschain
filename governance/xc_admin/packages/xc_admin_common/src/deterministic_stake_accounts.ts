import {
  PublicKey,
  StakeProgram,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { PRICE_FEED_OPS_KEY } from "./multisig";

export async function findDetermisticStakeAccountAddress(
  votePubkey: PublicKey
): Promise<[PublicKey, string]> {
  const seed: string = votePubkey.toBuffer().toString("hex").slice(0, 32);
  const address: PublicKey = await PublicKey.createWithSeed(
    PRICE_FEED_OPS_KEY,
    seed,
    StakeProgram.programId
  );
  return [address, seed];
}

export async function getInitializeDeterministicStakeAccountInstructions(
  base: PublicKey,
  votePubkey: PublicKey,
  authorizedPubkey: PublicKey
): Promise<TransactionInstruction[]> {
  const [address, seed]: [PublicKey, string] =
    await findDetermisticStakeAccountAddress(votePubkey);
  return [
    SystemProgram.allocate({
      accountPubkey: address,
      basePubkey: base,
      seed: seed,
      space: StakeProgram.space,
      programId: StakeProgram.programId,
    }),
    SystemProgram.assign({
      accountPubkey: address,
      seed,
      basePubkey: base,
      programId: StakeProgram.programId,
    }),
    StakeProgram.initialize({
      stakePubkey: address,
      authorized: {
        staker: authorizedPubkey,
        withdrawer: authorizedPubkey,
      },
    }),
  ];
}
