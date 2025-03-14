import { getPythProgramKeyForCluster, PythCluster } from "@pythnetwork/client";
import { PublicKey } from "@solana/web3.js";

/**
 * Address of the message buffer program.
 */
export const MESSAGE_BUFFER_PROGRAM_ID: PublicKey = new PublicKey(
  "7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffRHUM",
);

export const MESSAGE_BUFFER_BUFFER_SIZE = 2048;

export function isMessageBufferAvailable(cluster: PythCluster): boolean {
  return cluster === "pythtest-crosschain" || cluster === "pythnet";
}

export function getPythOracleMessageBufferCpiAuth(
  cluster: PythCluster,
): PublicKey {
  const pythOracleProgramId = getPythProgramKeyForCluster(cluster);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("upd_price_write"), MESSAGE_BUFFER_PROGRAM_ID.toBuffer()],
    pythOracleProgramId,
  )[0];
}

// TODO: We can remove this when createBuffer takes message buffer account
// as a named account because Anchor can automatically find the address.
export function getMessageBufferAddressForPrice(
  cluster: PythCluster,
  priceAccount: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      getPythOracleMessageBufferCpiAuth(cluster).toBuffer(),
      Buffer.from("message"),
      priceAccount.toBuffer(),
    ],
    MESSAGE_BUFFER_PROGRAM_ID,
  )[0];
}
