import { PublicKey } from "@solana/web3.js";

/**
 * Seed for the claim PDA of the remote executor
 */
export const CLAIM_RECORD_SEED: string = "CLAIM_RECORD";

/**
 * Seed for the executor PDA of the remote executor
 */
const EXECUTOR_KEY_SEED: string = "EXECUTOR_KEY";

/**
 * Address of the remote executor (same on all networks)
 */
export const REMOTE_EXECUTOR_ADDRESS: PublicKey = new PublicKey(
  "exe6S3AxPVNmy46L4Nj6HrnnAVQUhwyYzMSNcnRn3qq",
);

/**
 * Map key to the key that a remote executor will use when it receives a message from `key`
 * @param key the key to map
 * @returns the key that the remote executor will use
 */
export function mapKey(key: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(EXECUTOR_KEY_SEED), key.toBytes()],
    REMOTE_EXECUTOR_ADDRESS,
  )[0];
}
