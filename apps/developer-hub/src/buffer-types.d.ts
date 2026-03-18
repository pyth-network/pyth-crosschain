/**
 * TypeScript 5.6+ introduced stricter typing for Buffer vs Uint8Array.
 * The @types/node Buffer type now has an incompatible `.buffer` property
 * (ArrayBufferLike vs ArrayBuffer) which causes type errors when libraries
 * like @solana/buffer-layout expect Uint8Array parameters.
 *
 * This declaration file makes Buffer assignable to Uint8Array by augmenting
 * the global Buffer interface. This fixes Vercel build failures while maintaining
 * runtime compatibility (Buffer is always a valid Uint8Array at runtime).
 */

declare global {
  interface Buffer extends Uint8Array {
    // Override the buffer property to be compatible with Uint8Array's ArrayBuffer requirement
    readonly buffer: ArrayBuffer;
  }
}

export {};
