import { DISCRIMINATOR_SIZE } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const ONE_MINUTE_IN_SECONDS = 60n;
const ONE_HOUR_IN_SECONDS = 60n * ONE_MINUTE_IN_SECONDS;
const ONE_DAY_IN_SECONDS = 24n * ONE_HOUR_IN_SECONDS;
const ONE_WEEK_IN_SECONDS = 7n * ONE_DAY_IN_SECONDS;
export const ONE_YEAR_IN_SECONDS = 365n * ONE_DAY_IN_SECONDS;

export const EPOCH_DURATION = ONE_WEEK_IN_SECONDS;

export const MAX_VOTER_WEIGHT = 10_000_000_000_000_000n; // 10 Billion with 6 decimals

export const FRACTION_PRECISION = 1_000_000;
export const FRACTION_PRECISION_N = 1_000_000n;

export const POSITION_BUFFER_SIZE = 200;
export const POSITIONS_ACCOUNT_HEADER_SIZE = DISCRIMINATOR_SIZE + 32;
export const POSITIONS_ACCOUNT_SIZE = DISCRIMINATOR_SIZE + 32;

export const STAKING_PROGRAM_ADDRESS = new PublicKey(
  "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ",
);

export const INTEGRITY_POOL_PROGRAM_ADDRESS = new PublicKey(
  "pyti8TM4zRVBjmarcgAPmTNNAXYKJv7WVHrkrm6woLN",
);

export const PUBLISHER_CAPS_PROGRAM_ADDRESS = new PublicKey(
  "pytcD8uUjPxSLMsNqoVnm9dXQw9tKJJf3CQnGwa8oL7",
);

export const GOVERNANCE_ADDRESS = new PublicKey(
  "pytGY6tWRgGinSCvRLnSv4fHfBTMoiDGiCsesmHWM6U",
);

export const STAKE_CAPS_PARAMETERS_PROGRAM_ADDRESS = new PublicKey(
  "ujSFv8q8woXW5PUnby52PQyxYGUudxkrvgN6A631Qmm",
);
