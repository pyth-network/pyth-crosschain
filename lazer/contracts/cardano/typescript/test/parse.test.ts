import { describe, expect, it } from 'vitest';
import { parsePriceMessage, parsePriceUpdate } from '../src/parse.js';
import { Channel, SOLANA_FORMAT_MAGIC } from '../src/types.js';

// Test vector from Aiken tests
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

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

describe('parsePriceMessage', () => {
    it('correctly extracts signature, pubkey, and payload', () => {
        const msg = hexToBytes(TEST_VECTOR_HEX);
        const parsed = parsePriceMessage(msg);

        expect(parsed.signature.length).toBe(64);
        expect(bytesToHex(parsed.pubkey)).toBe(EXPECTED_PUBKEY_HEX);
        expect(parsed.payload.length).toBe(28);

        // Verify signature bytes
        const expectedSigHex =
            'e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c600';
        expect(bytesToHex(parsed.signature)).toBe(expectedSigHex);

        // Verify payload bytes
        const expectedPayloadHex =
            '75d3c7931c9773f30a240600010102000000010000e1f50500000000';
        expect(bytesToHex(parsed.payload)).toBe(expectedPayloadHex);
    });

    it('rejects bad magic', () => {
        const msg = hexToBytes(TEST_VECTOR_HEX);
        msg[0] = 0xc9; // corrupt first byte
        expect(() => parsePriceMessage(msg)).toThrow('Invalid magic');
    });

    it('rejects truncated messages', () => {
        const msg = hexToBytes('b9011a82e5cddee2c1bd364c8c57e1');
        expect(() => parsePriceMessage(msg)).toThrow('too short');
    });

    it('rejects payload size mismatch (too short)', () => {
        // Remove last byte from test vector
        const msg = hexToBytes(TEST_VECTOR_HEX.slice(0, -2));
        expect(() => parsePriceMessage(msg)).toThrow('size mismatch');
    });

    it('rejects payload size mismatch (too long)', () => {
        // Add extra bytes
        const msg = hexToBytes(TEST_VECTOR_HEX + '0000');
        expect(() => parsePriceMessage(msg)).toThrow('size mismatch');
    });
});

describe('parsePriceUpdate', () => {
    it('correctly parses timestamp, channel, feedId, and price', () => {
        const msg = hexToBytes(TEST_VECTOR_HEX);
        const parsed = parsePriceMessage(msg);
        const update = parsePriceUpdate(parsed.payload);

        // Expected values from manual decoding:
        // timestamp: 1728479312975644 (0x00062a0af3739773 LE -> 0x0006240af37397d3)
        expect(update.timestamp).toBe(1728479312975644n);
        expect(update.channel).toBe(Channel.RealTime);
        expect(update.feeds.length).toBe(1);
        expect(update.feeds[0].feedId).toBe(2);
        expect(update.feeds[0].price).toBe(100000000n);
    });

    it('rejects invalid payload magic', () => {
        const payload = hexToBytes(
            'aabbccdd1c9773f30a240600010102000000010000e1f50500000000'
        );
        expect(() => parsePriceUpdate(payload)).toThrow(
            'Invalid payload magic'
        );
    });

    it('rejects payload with extra bytes', () => {
        const msg = hexToBytes(TEST_VECTOR_HEX);
        const parsed = parsePriceMessage(msg);
        // Extend payload with extra bytes
        const extended = new Uint8Array(parsed.payload.length + 2);
        extended.set(parsed.payload);
        extended[parsed.payload.length] = 0;
        extended[parsed.payload.length + 1] = 0;
        expect(() => parsePriceUpdate(extended)).toThrow('extra bytes');
    });
});
