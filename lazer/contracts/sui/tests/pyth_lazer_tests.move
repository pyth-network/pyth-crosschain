#[test_only]
module pyth_lazer::pyth_lazer_tests;
use pyth_lazer::pyth_lazer::parse_and_verify_le_ecdsa_update;
use pyth_lazer::channel::new_fixed_rate_200ms;
use pyth_lazer::i16::{Self};
use pyth_lazer::i64::{Self};

#[test]
public fun test_parse_and_verify_le_ecdsa_update() {
    /*
    The test data is from the Lazer subscription:
    > Request
    {"subscriptionId": 1, "type": "subscribe", "priceFeedIds": [1, 2, 112], "properties": ["price", "bestBidPrice", "bestAskPrice", "exponent", "fundingRate", "fundingTimestamp"], "chains": ["leEcdsa"], "channel": "fixed_rate@200ms", "jsonBinaryEncoding": "hex"}
    < Response
    {
        "type": "streamUpdated",
        "subscriptionId": 1,
        "parsed": {
            "timestampUs": "1753787555800000",
            "priceFeeds": [
                {
                    "priceFeedId": 1,
                    "price": "11838353875029",
                    "bestBidPrice": "11838047151903",
                    "bestAskPrice": "11839270720540",
                    "exponent": -8
                },
                {
                    "priceFeedId": 2,
                    "price": "382538699314",
                    "bestBidPrice": "382520831095",
                    "bestAskPrice": "382561500067",
                    "exponent": -8
                },
                {
                    "priceFeedId": 112,
                    "price": "118856300000000000",
                    "exponent": -12,
                    "fundingRate": 100000000,
                    "fundingTimestamp": 1753776000000000
                }
            ]
        },
        "leEcdsa": {
            "encoding": "hex",
            "data": "e4bd474daafa101a7cdc2f4af22f5735aa3278f7161ae15efa9eac3851ca437e322fde467c9475497e1297499344826fe1209f6de234dce35bdfab8bf6b073be12a07cb201930075d3c793c063467c0f3b0600030301000000060055a0e054c40a0000011f679842c40a0000021c94868bc40a000004f8ff0600070002000000060032521511590000000177ac04105900000002a33b71125900000004f8ff060007007000000006000038d1d42c43a60101000000000000000002000000000000000004f4ff060100e1f50500000000070100e07ecb0c3b0600"
        }
    }
    */

    let hex_message =
        x"e4bd474daafa101a7cdc2f4af22f5735aa3278f7161ae15efa9eac3851ca437e322fde467c9475497e1297499344826fe1209f6de234dce35bdfab8bf6b073be12a07cb201930075d3c793c063467c0f3b0600030301000000060055a0e054c40a0000011f679842c40a0000021c94868bc40a000004f8ff0600070002000000060032521511590000000177ac04105900000002a33b71125900000004f8ff060007007000000006000038d1d42c43a60101000000000000000002000000000000000004f4ff060100e1f50500000000070100e07ecb0c3b0600";

    let update = parse_and_verify_le_ecdsa_update(hex_message);

    // If we reach this point, the function worked correctly
    // (no assertion failures in parse_and_validate_update)
    assert!(update.timestamp() == 1753787555800000, 0);
    assert!(update.channel() == new_fixed_rate_200ms(), 0);
    assert!(vector::length(&update.feeds()) == 3, 0);

    let feed_1 = vector::borrow(&update.feeds(), 0);
    assert!(feed_1.feed_id() == 1, 0);
    assert!(feed_1.price() == option::some(option::some(i64::from_u64(11838353875029))), 0);
    assert!(feed_1.best_bid_price() == option::some(option::some(i64::from_u64(11838047151903))), 0);
    assert!(feed_1.best_ask_price() == option::some(option::some(i64::from_u64(11839270720540))), 0);
    assert!(feed_1.exponent() == option::some(i16::new(8, true)), 0);
    assert!(feed_1.publisher_count() == option::none(), 0);
    assert!(feed_1.confidence() == option::none(), 0);
    assert!(feed_1.funding_rate() == option::some(option::none()), 0);
    assert!(feed_1.funding_timestamp() == option::some(option::none()), 0);

    let feed_2 = vector::borrow(&update.feeds(), 1);
    assert!(feed_2.feed_id() == 2, 0);
    assert!(feed_2.price() == option::some(option::some(i64::from_u64(382538699314))), 0);
    assert!(feed_2.best_bid_price() == option::some(option::some(i64::from_u64(382520831095))), 0);
    assert!(feed_2.best_ask_price() == option::some(option::some(i64::from_u64(382561500067))), 0);
    assert!(feed_2.exponent() == option::some(i16::new(8, true)), 0);
    assert!(feed_2.publisher_count() == option::none(), 0);
    assert!(feed_2.confidence() == option::none(), 0);
    assert!(feed_2.funding_rate() == option::some(option::none()), 0);
    assert!(feed_2.funding_timestamp() == option::some(option::none()), 0);

    let feed_3 = vector::borrow(&update.feeds(), 2);
    assert!(feed_3.feed_id() == 112, 0);
    assert!(feed_3.price() == option::some(option::some(i64::from_u64(118856300000000000))), 0);
    assert!(feed_3.best_bid_price() == option::some(option::none()), 0);
    assert!(feed_3.best_ask_price() == option::some(option::none()), 0);
    assert!(feed_3.exponent() == option::some(i16::new(12, true)), 0);
    assert!(feed_3.publisher_count() == option::none(), 0);
    assert!(feed_3.confidence() == option::none(), 0);
    assert!(feed_3.funding_rate() == option::some(option::some(i64::from_u64(100000000))), 0);
    assert!(feed_3.funding_timestamp() == option::some(option::some(1753776000000000)), 0);
}
