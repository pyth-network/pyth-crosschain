/**
 * We explicitly cast the array of Buffers to Uint8Array[] before concatenation.
 *
 * TypeScript 5.6+ introduced Iterator helpers on Uint8Array that @types/node's
 * Buffer Iterator does not have. This causes a structural typing mismatch during
 * Vercel builds where the Node environment resolves these types differently than
 * local builds.
 */
export function safeBufferConcat(
  list: readonly Uint8Array[],
  totalLength?: number,
): Buffer {
  return Buffer.concat(list as unknown as Uint8Array[], totalLength);
}
