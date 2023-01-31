import { PublicKey } from "@solana/web3.js";

/**
 * Address of the remote executor (same on all networks)
 */
export const REMOTE_EXECUTOR_ADDRESS = new PublicKey(
  "exe6S3AxPVNmy46L4Nj6HrnnAVQUhwyYzMSNcnRn3qq"
);

/**
 * Map key to the key that a remote executor will use when it receives a message from `key`
 * @param key the key to map
 * @returns the key that the remote executor will use
 */
export function mapKey(key: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("EXECUTOR_KEY"), key.toBytes()],
    REMOTE_EXECUTOR_ADDRESS
  )[0];
}
