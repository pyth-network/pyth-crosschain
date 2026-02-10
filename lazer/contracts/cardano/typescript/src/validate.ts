import { ed25519 } from '@noble/curves/ed25519';
import { parsePriceMessage } from './parse.js';
import type { PriceMessage, SigningPolicy } from './types.js';

/**
 * Verify the Ed25519 signature on a parsed {@link PriceMessage}.
 *
 * Uses the `@noble/curves` library (audited, pure-JS) for cryptographic verification.
 * Returns `false` (rather than throwing) if the key or signature bytes are malformed.
 *
 * @param msg - A parsed price message containing `signature`, `pubkey`, and `payload`.
 * @returns `true` if the signature is valid for the given payload and pubkey, `false` otherwise.
 */
export function validateSignature(msg: PriceMessage): boolean {
    try {
        return ed25519.verify(msg.signature, msg.payload, msg.pubkey);
    } catch {
        return false;
    }
}

/**
 * Validate a {@link PriceMessage} against an off-chain {@link SigningPolicy}.
 *
 * Performs three checks in order:
 * 1. The message's pubkey matches a signer in the policy (byte-for-byte comparison).
 * 2. `currentTimeMs` falls within the matching signer's `[validFrom, validTo]` window.
 * 3. The Ed25519 signature is valid.
 *
 * @param msg - A parsed price message (from {@link parsePriceMessage}).
 * @param policy - Array of trusted signers with their validity windows.
 * @param currentTimeMs - Current time in milliseconds since epoch, used to check signer validity.
 * @returns `true` if all three checks pass, `false` otherwise.
 *
 * @example
 * ```ts
 * const policy: SigningPolicy = [{
 *     pubkey: hexToBytes('74313a65...'),
 *     validFrom: 0,
 *     validTo: Number.MAX_SAFE_INTEGER,
 * }];
 * const msg = parsePriceMessage(rawBytes);
 * const ok = validatePriceMessage(msg, policy, Date.now());
 * ```
 */
export function validatePriceMessage(
    msg: PriceMessage,
    policy: SigningPolicy,
    currentTimeMs: number
): boolean {
    const signer = policy.find((s) => {
        if (s.pubkey.length !== msg.pubkey.length) return false;
        for (let i = 0; i < s.pubkey.length; i++) {
            if (s.pubkey[i] !== msg.pubkey[i]) return false;
        }
        return true;
    });

    if (!signer) return false;
    if (currentTimeMs < signer.validFrom || currentTimeMs > signer.validTo)
        return false;

    return validateSignature(msg);
}

/**
 * Parse a raw Solana-format message and validate it against a {@link SigningPolicy} in one call.
 *
 * Combines {@link parsePriceMessage} and {@link validatePriceMessage}. Returns `false`
 * (rather than throwing) if parsing fails — useful when you want a simple boolean check
 * without separate error handling.
 *
 * @param rawMsg - Raw bytes of the complete Solana-format message.
 * @param policy - Array of trusted signers with their validity windows.
 * @param currentTimeMs - Current time in milliseconds since epoch.
 * @returns `true` if the message parses successfully and passes all validation checks, `false` otherwise.
 */
export function validateRawPriceMessage(
    rawMsg: Uint8Array,
    policy: SigningPolicy,
    currentTimeMs: number
): boolean {
    try {
        const msg = parsePriceMessage(rawMsg);
        return validatePriceMessage(msg, policy, currentTimeMs);
    } catch {
        return false;
    }
}
