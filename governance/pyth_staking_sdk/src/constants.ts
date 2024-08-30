import { PublicKey } from "@solana/web3.js";

export const EPOCH_DURATION = 60 * 60 * 24 * 7; // 1 week

export const POSITION_BUFFER_SIZE = 200;
export const POSITIONS_ACCOUNT_SIZE = 8 + 32;

export const STAKING_PROGRAM_ADDRESS = new PublicKey(
  "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ"
);
