import { describe, expect, it } from 'vitest';
import { parsePriceMessage, parsePriceUpdate } from '../src/parse.js';
import { Channel, SOLANA_FORMAT_MAGIC } from '../src/types.js';
import { bytesToHex, hexToBytes } from '../src/hex.js';

// Test vector from Aiken tests
const TEST_VECTOR_HEX =
    'b9011a82e5cddee2c1bd364c8c57e1c98a6a28d194afcad410ff412226c8b2ae931ff59a57147cb47c7307afc2a0a1abec4dd7e835a5b7113cf5aeac13a745c6bed6c60074313a6525edf99936aa1477e94c72bc5cc617b21745f5f03296f3154461f2141c0075d3c7931c9773f30a240600010102000000010000e1f50500000000';

describe('parsePriceMessage', () => {
    it('correctly extracts signature, pubkey, and payload', () => {
        const msg = hexToBytes(TEST_VECTOR_HEX);
        const parsed = parsePriceMessage(msg);

        // Solana envelope layout (hex char offsets):
        // magic(8) + signature(128) + pubkey(64) + payloadSize(4) + payload(...)
        expect(bytesToHex(parsed.signature)).toBe(TEST_VECTOR_HEX.slice(8, 8 + 128));
        expect(bytesToHex(parsed.pubkey)).toBe(TEST_VECTOR_HEX.slice(8 + 128, 8 + 128 + 64));
        expect(bytesToHex(parsed.payload)).toBe(TEST_VECTOR_HEX.slice(8 + 128 + 64 + 4));
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
        expect(update.feeds).toEqual([
            {
                feedId: 2,
                price: 100000000n,
            },
        ]);
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
