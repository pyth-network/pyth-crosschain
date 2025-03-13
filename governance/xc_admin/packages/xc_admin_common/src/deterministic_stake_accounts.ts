import { PublicKey, StakeProgram } from "@solana/web3.js";

export async function findDetermisticStakeAccountAddress(
  basePubkey: PublicKey,
  votePubkey: PublicKey,
): Promise<[PublicKey, string]> {
  const seed: string = votePubkey.toBuffer().toString("hex").slice(0, 32);
  const address: PublicKey = await PublicKey.createWithSeed(
    basePubkey,
    seed,
    StakeProgram.programId,
  );
  return [address, seed];
}
