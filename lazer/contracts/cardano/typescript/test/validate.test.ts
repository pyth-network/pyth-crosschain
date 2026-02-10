import { describe, expect, it } from 'vitest';
import { parsePriceMessage } from '../src/parse.js';
import {
    validatePriceMessage,
    validateRawPriceMessage,
    validateSignature,
} from '../src/validate.js';
import type { SigningPolicy } from '../src/types.js';

const TEST_VECTOR_HEX =
    'b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000';

const EXPECTED_PUBKEY_HEX =
    '74313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f214';

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

describe('validateSignature', () => {
    it('accepts valid signature from test vector', () => {
        const msg = parsePriceMessage(hexToBytes(TEST_VECTOR_HEX));
        expect(validateSignature(msg)).toBe(true);
    });

    it('rejects tampered payload', () => {
        const raw = hexToBytes(TEST_VECTOR_HEX);
        // Tamper with last byte of payload (same as Aiken test)
        raw[raw.length - 1] = 0x01;
        const msg = parsePriceMessage(raw);
        expect(validateSignature(msg)).toBe(false);
    });
});

describe('validatePriceMessage', () => {
    const validPolicy: SigningPolicy = [
        {
            pubkey: hexToBytes(EXPECTED_PUBKEY_HEX),
            validFrom: 0,
            validTo: Number.MAX_SAFE_INTEGER,
        },
    ];

    it('accepts message with valid signer within time window', () => {
        const msg = parsePriceMessage(hexToBytes(TEST_VECTOR_HEX));
        expect(validatePriceMessage(msg, validPolicy, 1000)).toBe(true);
    });

    it('rejects message with unknown signer', () => {
        const unknownPolicy: SigningPolicy = [
            {
                pubkey: hexToBytes(
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                ),
                validFrom: 0,
                validTo: Number.MAX_SAFE_INTEGER,
            },
        ];
        const msg = parsePriceMessage(hexToBytes(TEST_VECTOR_HEX));
        expect(validatePriceMessage(msg, unknownPolicy, 1000)).toBe(false);
    });

    it('rejects message with expired signer', () => {
        const expiredPolicy: SigningPolicy = [
            {
                pubkey: hexToBytes(EXPECTED_PUBKEY_HEX),
                validFrom: 0,
                validTo: 500,
            },
        ];
        const msg = parsePriceMessage(hexToBytes(TEST_VECTOR_HEX));
        expect(validatePriceMessage(msg, expiredPolicy, 1000)).toBe(false);
    });

    it('rejects message before signer validity starts', () => {
        const futurePolicy: SigningPolicy = [
            {
                pubkey: hexToBytes(EXPECTED_PUBKEY_HEX),
                validFrom: 2000,
                validTo: Number.MAX_SAFE_INTEGER,
            },
        ];
        const msg = parsePriceMessage(hexToBytes(TEST_VECTOR_HEX));
        expect(validatePriceMessage(msg, futurePolicy, 1000)).toBe(false);
    });
});

describe('validateRawPriceMessage', () => {
    const validPolicy: SigningPolicy = [
        {
            pubkey: hexToBytes(EXPECTED_PUBKEY_HEX),
            validFrom: 0,
            validTo: Number.MAX_SAFE_INTEGER,
        },
    ];

    it('validates correct raw message', () => {
        const raw = hexToBytes(TEST_VECTOR_HEX);
        expect(validateRawPriceMessage(raw, validPolicy, 1000)).toBe(true);
    });

    it('returns false for truncated message', () => {
        const raw = hexToBytes('b9011a82aabb');
        expect(validateRawPriceMessage(raw, validPolicy, 1000)).toBe(false);
    });
});
