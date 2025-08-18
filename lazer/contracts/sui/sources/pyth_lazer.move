module pyth_lazer::pyth_lazer;

use pyth_lazer::i16::{Self, I16};
use pyth_lazer::i64::{Self, I64};
use pyth_lazer::update::Update;
use sui::bcs;
use sui::ecdsa_k1::secp256k1_ecrecover;

const UPDATE_MESSAGE_MAGIC: u32 = 1296547300;
const PAYLOAD_MAGIC: u32 = 2479346549;


/// Parse the Lazer update message and validate the signature.
///
/// The parsing logic is based on the Lazer rust protocol definition defined here:
/// https://github.com/pyth-network/pyth-crosschain/tree/main/lazer/sdk/rust/protocol
public fun parse_and_validate_update(update: vector<u8>): Update {
    let mut cursor = bcs::new(update);

    let magic = cursor.peel_u32();
    assert!(magic == UPDATE_MESSAGE_MAGIC, 0);

    let mut signature = vector::empty<u8>();

    let mut sig_i = 0;
    while (sig_i < 65) {
        signature.push_back(cursor.peel_u8());
        sig_i = sig_i + 1;
    };

    let payload_len = cursor.peel_u16();

    let payload = cursor.into_remainder_bytes();

    assert!((payload_len as u64) == payload.length(), 0);

    // 0 stands for keccak256 hash
    let pubkey = secp256k1_ecrecover(&signature, &payload, 0);

    // Lazer signer pubkey
    assert!(pubkey == x"03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b", 0);

    let mut cursor = bcs::new(payload);
    let payload_magic = cursor.peel_u32();
    assert!(payload_magic == PAYLOAD_MAGIC, 0);

    let timestamp = cursor.peel_u64();
    let channel_value = cursor.peel_u8();
    let channel = if (channel_value == 0) {
        Channel::Invalid
    } else if (channel_value == 1) {
        Channel::RealTime
    } else if (channel_value == 2) {
        Channel::FixedRate50ms
    } else if (channel_value == 3) {
        Channel::FixedRate200ms
    } else {
        Channel::Invalid // Default to Invalid for unknown values
    };

    let mut feeds = vector::empty<Feed>();
    let mut feed_i = 0;

    let feed_count = cursor.peel_u8();

    while (feed_i < feed_count) {
        let feed_id = cursor.peel_u32();
        let mut feed = Feed {
            feed_id: feed_id,
            price: option::none(),
            best_bid_price: option::none(),
            best_ask_price: option::none(),
            publisher_count: option::none(),
            exponent: option::none(),
            confidence: option::none(),
            funding_rate: option::none(),
            funding_timestamp: option::none(),
        };

        let properties_count = cursor.peel_u8();
        let mut properties_i = 0;

        while (properties_i < properties_count) {
            let property_id = cursor.peel_u8();

            if (property_id == 0) {
                let price = cursor.peel_u64();
                if (price != 0) {
                    feed.price = option::some(option::some(i64::from_u64(price)));
                } else {
                    feed.price = option::some(option::none());
                }
            } else if (property_id == 1) {
                let best_bid_price = cursor.peel_u64();
                if (best_bid_price != 0) {
                    feed.best_bid_price = option::some(option::some(i64::from_u64(best_bid_price)));
                } else {
                    feed.best_bid_price = option::some(option::none());
                }
            } else if (property_id == 2) {
                let best_ask_price = cursor.peel_u64();
                if (best_ask_price != 0) {
                    feed.best_ask_price = option::some(option::some(i64::from_u64(best_ask_price)));
                } else {
                    feed.best_ask_price = option::some(option::none());
                }
            } else if (property_id == 3) {
                let publisher_count = cursor.peel_u16();
                feed.publisher_count = option::some(publisher_count);
            } else if (property_id == 4) {
                let exponent = cursor.peel_u16();
                feed.exponent = option::some(i16::from_u16(exponent));
            } else if (property_id == 5) {
                let confidence = cursor.peel_u64();
                if (confidence != 0) {
                    feed.confidence = option::some(option::some(i64::from_u64(confidence)));
                } else {
                    feed.confidence = option::some(option::none());
                }
            } else if (property_id == 6) {
                let exists = cursor.peel_u8();
                if (exists == 1) {
                    let funding_rate = cursor.peel_u64();
                    feed.funding_rate = option::some(option::some(i64::from_u64(funding_rate)));
                } else {
                    feed.funding_rate = option::some(option::none());
                }
            } else if (property_id == 7) {
                let exists = cursor.peel_u8();

                if (exists == 1) {
                    let funding_timestamp = cursor.peel_u64();
                    feed.funding_timestamp = option::some(option::some(funding_timestamp));
                } else {
                    feed.funding_timestamp = option::some(option::none());
                }
            } else {
                // When we have an unknown property, we do not know its length, and therefore
                // we cannot ignore it and parse the next properties.
                abort 0
            };

            properties_i = properties_i + 1;
        };

        vector::push_back(&mut feeds, feed);

        feed_i = feed_i + 1;
    };

    let remaining_bytes = cursor.into_remainder_bytes();
    assert!(remaining_bytes.length() == 0, 0);

    Update {
        timestamp: timestamp,
        channel: channel,
        feeds: feeds,
    }
}
