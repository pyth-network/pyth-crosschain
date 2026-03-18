/**
 * Concatenates an array of Buffers/Uint8Arrays into a single Buffer.
 *
 * Note: With the buffer-types.d.ts declaration file, Buffer is now properly
 * assignable to Uint8Array without requiring type casts.
 */
export function safeBufferConcat(
  list: readonly (Buffer | Uint8Array)[],
  totalLength?: number,
): Buffer {
  return Buffer.concat(list, totalLength);
}
