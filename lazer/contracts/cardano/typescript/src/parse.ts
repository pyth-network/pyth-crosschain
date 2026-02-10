import {
    Channel,
    Feed,
    MAGIC_LEN,
    MarketSession,
    MESSAGE_SIZE_LEN,
    MIN_ENVELOPE_LEN,
    PAYLOAD_FORMAT_MAGIC,
    PriceFeedProperty,
    PriceMessage,
    PriceUpdate,
    PUBKEY_LEN,
    SIGNATURE_LEN,
    SOLANA_FORMAT_MAGIC,
} from './types.js';

/** Sequential reader over a DataView with cursor tracking. */
class BufferReader {
    private view: DataView;
    private pos: number;

    constructor(buf: Uint8Array, offset = 0) {
        this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        this.pos = offset;
    }

    get remaining(): number {
        return this.view.byteLength - this.pos;
    }

    get position(): number {
        return this.pos;
    }

    readUint8(): number {
        const v = this.view.getUint8(this.pos);
        this.pos += 1;
        return v;
    }

    readUint16LE(): number {
        const v = this.view.getUint16(this.pos, true);
        this.pos += 2;
        return v;
    }

    readInt16LE(): number {
        const v = this.view.getInt16(this.pos, true);
        this.pos += 2;
        return v;
    }

    readUint32LE(): number {
        const v = this.view.getUint32(this.pos, true);
        this.pos += 4;
        return v;
    }

    readInt64LE(): bigint {
        const v = this.view.getBigInt64(this.pos, true);
        this.pos += 8;
        return v;
    }

    readUint64LE(): bigint {
        const v = this.view.getBigUint64(this.pos, true);
        this.pos += 8;
        return v;
    }

    readBytes(n: number): Uint8Array {
        const slice = new Uint8Array(
            this.view.buffer,
            this.view.byteOffset + this.pos,
            n
        );
        this.pos += n;
        return slice;
    }
}

/**
 * Parse a Solana-format envelope into its component parts.
 *
 * The envelope format is: `magic(4B LE) | signature(64B) | pubkey(32B) | payloadSize(u16 LE) | payload`.
 * Validates the magic bytes (`0x821a01b9` LE) and that the message length matches the declared payload size.
 *
 * @param msg - Raw bytes of the complete Solana-format message (e.g. from Pyth Lazer WebSocket).
 * @returns Parsed envelope with `signature`, `pubkey`, and `payload` as separate `Uint8Array` views.
 * @throws {Error} If the message is shorter than 102 bytes, the magic is wrong, or the payload size doesn't match.
 *
 * @example
 * ```ts
 * const raw = new Uint8Array([0xb9, 0x01, 0x1a, 0x82, ...]);
 * const { signature, pubkey, payload } = parsePriceMessage(raw);
 * ```
 */
export function parsePriceMessage(msg: Uint8Array): PriceMessage {
    if (msg.length < MIN_ENVELOPE_LEN) {
        throw new Error(
            `Message too short: ${msg.length} < ${MIN_ENVELOPE_LEN}`
        );
    }

    const r = new BufferReader(msg);

    // Validate magic (4 bytes LE)
    const magic = r.readUint32LE();
    if (magic !== SOLANA_FORMAT_MAGIC) {
        throw new Error(
            `Invalid magic: 0x${magic.toString(16)}, expected 0x${SOLANA_FORMAT_MAGIC.toString(16)}`
        );
    }

    const signature = r.readBytes(SIGNATURE_LEN);
    const pubkey = r.readBytes(PUBKEY_LEN);
    const payloadSize = r.readUint16LE();

    const expectedLen = MIN_ENVELOPE_LEN + payloadSize;
    if (msg.length !== expectedLen) {
        throw new Error(
            `Payload size mismatch: message is ${msg.length} bytes, expected ${expectedLen}`
        );
    }

    const payload = r.readBytes(payloadSize);

    return { signature, pubkey, payload };
}

/**
 * Parse the inner Lazer payload into a structured {@link PriceUpdate}.
 *
 * The payload format is: `magic(4B LE) | timestamp(u64 LE) | channel(u8) | numFeeds(u8) | feeds...`.
 * Each feed contains: `feedId(u32 LE) | numProps(u8) | properties...`.
 * Property value sizes vary by ID (see {@link PriceFeedProperty}).
 *
 * @param payload - The `payload` field from a parsed {@link PriceMessage} (i.e. the bytes after the envelope header).
 * @returns Structured price update with timestamp, channel, and array of feeds.
 * @throws {Error} If the payload magic is wrong, a property ID is unknown, or there are leftover bytes.
 *
 * @example
 * ```ts
 * const { signature, pubkey, payload } = parsePriceMessage(raw);
 * const update = parsePriceUpdate(payload);
 * console.log(update.feeds[0].price); // bigint
 * ```
 */
export function parsePriceUpdate(payload: Uint8Array): PriceUpdate {
    const r = new BufferReader(payload);

    // Payload magic (4 bytes LE)
    const magic = r.readUint32LE();
    if (magic !== PAYLOAD_FORMAT_MAGIC) {
        throw new Error(
            `Invalid payload magic: 0x${magic.toString(16)}, expected 0x${PAYLOAD_FORMAT_MAGIC.toString(16)}`
        );
    }

    const timestamp = r.readUint64LE();
    const channelRaw = r.readUint8();
    const channel = channelRaw as Channel;
    const numFeeds = r.readUint8();

    const feeds: Feed[] = [];

    for (let i = 0; i < numFeeds; i++) {
        const feedId = r.readUint32LE();
        const numProperties = r.readUint8();

        const feed: Feed = { feedId };

        for (let j = 0; j < numProperties; j++) {
            const propId = r.readUint8() as PriceFeedProperty;

            switch (propId) {
                case PriceFeedProperty.Price:
                    feed.price = r.readInt64LE();
                    break;
                case PriceFeedProperty.BestBidPrice:
                    feed.bestBidPrice = r.readInt64LE();
                    break;
                case PriceFeedProperty.BestAskPrice:
                    feed.bestAskPrice = r.readInt64LE();
                    break;
                case PriceFeedProperty.PublisherCount:
                    feed.publisherCount = r.readUint16LE();
                    break;
                case PriceFeedProperty.Exponent:
                    feed.exponent = r.readInt16LE();
                    break;
                case PriceFeedProperty.Confidence:
                    feed.confidence = r.readUint64LE();
                    break;
                case PriceFeedProperty.FundingRate: {
                    const exists = r.readUint8();
                    feed.fundingRate =
                        exists !== 0 ? r.readInt64LE() : null;
                    break;
                }
                case PriceFeedProperty.FundingTimestamp: {
                    const exists = r.readUint8();
                    feed.fundingTimestamp =
                        exists !== 0 ? r.readUint64LE() : null;
                    break;
                }
                case PriceFeedProperty.FundingRateInterval: {
                    const exists = r.readUint8();
                    feed.fundingRateInterval =
                        exists !== 0 ? r.readUint64LE() : null;
                    break;
                }
                case PriceFeedProperty.MarketSession: {
                    const v = r.readInt16LE();
                    feed.marketSession = v as MarketSession;
                    break;
                }
                default:
                    throw new Error(`Unknown property ID: ${propId}`);
            }
        }

        feeds.push(feed);
    }

    if (r.remaining !== 0) {
        throw new Error(
            `Payload has ${r.remaining} extra bytes after parsing`
        );
    }

    return { timestamp, channel, feeds };
}
