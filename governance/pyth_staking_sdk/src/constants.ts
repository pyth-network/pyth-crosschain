import { PublicKey } from "@solana/web3.js";

export const EPOCH_DURATION = 60n * 60n * 24n * 7n; // 1 week

export const POSITION_BUFFER_SIZE = 200;
export const POSITIONS_ACCOUNT_SIZE = 8 + 32;

export const STAKING_PROGRAM_ADDRESS = new PublicKey(
  "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ"
);

export const INTEGRITY_POOL_PROGRAM_ADDRESS = new PublicKey(
  "pyti8TM4zRVBjmarcgAPmTNNAXYKJv7WVHrkrm6woLN"
);

export const PUBLISHER_CAPS_PROGRAM_ADDRESS = new PublicKey(
  "pytcD8uUjPxSLMsNqoVnm9dXQw9tKJJf3CQnGwa8oL7"
);
