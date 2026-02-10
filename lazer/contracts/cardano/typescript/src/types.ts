/** Solana envelope format magic (little-endian) */
export const SOLANA_FORMAT_MAGIC = 0x821a01b9;
/** LE bytes for SOLANA_FORMAT_MAGIC */
export const SOLANA_FORMAT_MAGIC_LE = new Uint8Array([0xb9, 0x01, 0x1a, 0x82]);

/** Lazer payload format magic (little-endian) */
export const PAYLOAD_FORMAT_MAGIC = 0x93c7d375;

/** Length of the magic field in bytes. */
export const MAGIC_LEN = 4;
/** Length of the Ed25519 signature in bytes. */
export const SIGNATURE_LEN = 64;
/** Length of the Ed25519 public key in bytes. */
export const PUBKEY_LEN = 32;
/** Length of the payload size field in bytes (uint16 LE). */
export const MESSAGE_SIZE_LEN = 2;
/** Minimum envelope length: magic + signature + pubkey + size field */
export const MIN_ENVELOPE_LEN =
    MAGIC_LEN + SIGNATURE_LEN + PUBKEY_LEN + MESSAGE_SIZE_LEN;

/** Pyth Lazer data channel indicating update frequency. */
export enum Channel {
    RealTime = 1,
    FixedRate50ms = 2,
    FixedRate200ms = 3,
    FixedRate1000ms = 4,
}

/** Property IDs that can appear in a price feed update. Each ID determines the wire type of the value that follows. */
export enum PriceFeedProperty {
    /** int64 — price in base units (apply exponent for human-readable value) */
    Price = 0,
    /** int64 — best bid price */
    BestBidPrice = 1,
    /** int64 — best ask price */
    BestAskPrice = 2,
    /** uint16 — number of contributing publishers */
    PublisherCount = 3,
    /** int16 — exponent (e.g. -8 means value * 10^-8) */
    Exponent = 4,
    /** uint64 — confidence interval */
    Confidence = 5,
    /** optional int64 — funding rate (bool-flagged: 1 byte exists flag + 8 byte value if exists) */
    FundingRate = 6,
    /** optional uint64 — funding timestamp (bool-flagged) */
    FundingTimestamp = 7,
    /** optional uint64 — funding rate interval (bool-flagged) */
    FundingRateInterval = 8,
    /** int16 — market session enum value */
    MarketSession = 9,
}

/** Current trading session state for a market. */
export enum MarketSession {
    Regular = 0,
    PreMarket = 1,
    PostMarket = 2,
    OverNight = 3,
    Closed = 4,
}

/**
 * Parsed Solana-format envelope containing the three components needed for verification.
 * Produced by {@link parsePriceMessage}.
 */
export interface PriceMessage {
    /** 64-byte Ed25519 signature over `payload`. */
    signature: Uint8Array;
    /** 32-byte Ed25519 public key of the signer. */
    pubkey: Uint8Array;
    /** Variable-length signed payload (parse with {@link parsePriceUpdate} to extract price data). */
    payload: Uint8Array;
}

/**
 * A single price feed with optional properties.
 *
 * Properties are `undefined` if not included in the update. For the optional
 * bool-flagged properties (`fundingRate`, `fundingTimestamp`,
 * `fundingRateInterval`), the value is `null` when the property was included
 * but the exists-flag was 0 (applicable but currently unavailable), and
 * `undefined` when the property was not included at all.
 */
export interface Feed {
    /** Pyth feed identifier (uint32). */
    feedId: number;
    /** Price in base units — apply {@link exponent} for human-readable value. */
    price?: bigint;
    /** Best bid price in base units. */
    bestBidPrice?: bigint;
    /** Best ask price in base units. */
    bestAskPrice?: bigint;
    /** Number of publishers contributing to this price. */
    publisherCount?: number;
    /** Power-of-10 exponent (e.g. -8 means multiply price by 10^-8). */
    exponent?: number;
    /** Confidence interval around the price (uint64). */
    confidence?: bigint;
    /** Funding rate. `null` = included but unavailable; `undefined` = not included. */
    fundingRate?: bigint | null;
    /** Funding timestamp (microseconds). `null` = included but unavailable. */
    fundingTimestamp?: bigint | null;
    /** Funding rate interval (microseconds). `null` = included but unavailable. */
    fundingRateInterval?: bigint | null;
    /** Current market trading session. */
    marketSession?: MarketSession;
}

/** Decoded inner payload containing one or more price feeds. */
export interface PriceUpdate {
    /** Microsecond timestamp of when the update was produced. */
    timestamp: bigint;
    /** Data channel indicating the update frequency tier. */
    channel: Channel;
    /** Array of price feeds included in this update. */
    feeds: Feed[];
}

/** A trusted signer with a validity window, for off-chain policy checking. */
export interface TrustedSigner {
    /** 32-byte Ed25519 public key. */
    pubkey: Uint8Array;
    /** Start of validity window (milliseconds since epoch, inclusive). */
    validFrom: number;
    /** End of validity window (milliseconds since epoch, inclusive). */
    validTo: number;
}

/**
 * List of trusted signers forming a signing policy.
 * Used by {@link validatePriceMessage} for off-chain validation.
 */
export type SigningPolicy = TrustedSigner[];
