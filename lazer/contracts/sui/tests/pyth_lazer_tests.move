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
    {"subscriptionId": 1, "type": "subscribe", "priceFeedIds": [1, 2, 112], "properties": ["price", "bestBidPrice", "bestAskPrice", "exponent", "fundingRate", "fundingTimestamp", "fundingRateInterval"], "chains": ["leEcdsa"], "channel": "fixed_rate@200ms", "jsonBinaryEncoding": "hex"}
    < Response
    {
        "type": "streamUpdated",
        "subscriptionId": 1,
        "parsed": {
            "timestampUs": "1755625313400000",
            "priceFeeds": [
                {
                    "priceFeedId": 1,
                    "price": "11350721594969",
                    "bestBidPrice": "11350696257890",
                    "bestAskPrice": "11350868428965",
                    "exponent": -8
                },
                {
                    "priceFeedId": 2,
                    "price": "417775510136",
                    "bestBidPrice": "417771266475",
                    "bestAskPrice": "417782074042",
                    "exponent": -8
                },
                {
                    "priceFeedId": 112,
                    "price": "113747064619385816",
                    "exponent": -12,
                    "fundingRate": 31670000,
                    "fundingTimestamp": 1755619200000000,
                    "fundingRateInterval": 28800000000
                }
            ]
        },
        "leEcdsa": {
            "encoding": "hex",
            "data": "e4bd474d42e3c9c3477b30f2c5527ebe2fb2c8adadadacaddfa7d95243b80fb8f0d813b453e587f140cf40a1120d75f1ffee8ad4337267e4fcbd23eabb2a555804f85ec101a10075d3c793c0f4295fbb3c060003030100000007005986bacb520a00000162e937ca520a000002a5087bd4520a000004f8ff06000700080002000000070078625c456100000001aba11b456100000002ba8ac0456100000004f8ff060007000800700000000700d8c3e1445a1c940101000000000000000002000000000000000004f4ff0601f03ee30100000000070100e0c6f2b93c0600080100209db406000000"
        }
    }
    */

    let hex_message =
        x"e4bd474d42e3c9c3477b30f2c5527ebe2fb2c8adadadacaddfa7d95243b80fb8f0d813b453e587f140cf40a1120d75f1ffee8ad4337267e4fcbd23eabb2a555804f85ec101a10075d3c793c0f4295fbb3c060003030100000007005986bacb520a00000162e937ca520a000002a5087bd4520a000004f8ff06000700080002000000070078625c456100000001aba11b456100000002ba8ac0456100000004f8ff060007000800700000000700d8c3e1445a1c940101000000000000000002000000000000000004f4ff0601f03ee30100000000070100e0c6f2b93c0600080100209db406000000";

    let update = parse_and_verify_le_ecdsa_update(hex_message);

    // If we reach this point, the function worked correctly
    // (no assertion failures in parse_and_validate_update)
    assert!(update.timestamp() == 1755625313400000, 0);
    assert!(update.channel() == new_fixed_rate_200ms(), 0);
    assert!(vector::length(&update.feeds()) == 3, 0);

    let feed_1 = vector::borrow(&update.feeds(), 0);
    assert!(feed_1.feed_id() == 1, 0);
    assert!(feed_1.price() == option::some(option::some(i64::from_u64(11350721594969))), 0);
    assert!(feed_1.best_bid_price() == option::some(option::some(i64::from_u64(11350696257890))), 0);
    assert!(feed_1.best_ask_price() == option::some(option::some(i64::from_u64(11350868428965))), 0);
    assert!(feed_1.exponent() == option::some(i16::new(8, true)), 0);
    assert!(feed_1.publisher_count() == option::none(), 0);
    assert!(feed_1.confidence() == option::none(), 0);
    assert!(feed_1.funding_rate() == option::some(option::none()), 0);
    assert!(feed_1.funding_timestamp() == option::some(option::none()), 0);

    let feed_2 = vector::borrow(&update.feeds(), 1);
    assert!(feed_2.feed_id() == 2, 0);
    assert!(feed_2.price() == option::some(option::some(i64::from_u64(417775510136))), 0);
    assert!(feed_2.best_bid_price() == option::some(option::some(i64::from_u64(417771266475))), 0);
    assert!(feed_2.best_ask_price() == option::some(option::some(i64::from_u64(417782074042))), 0);
    assert!(feed_2.exponent() == option::some(i16::new(8, true)), 0);
    assert!(feed_2.publisher_count() == option::none(), 0);
    assert!(feed_2.confidence() == option::none(), 0);
    assert!(feed_2.funding_rate() == option::some(option::none()), 0);
    assert!(feed_2.funding_timestamp() == option::some(option::none()), 0);

    let feed_3 = vector::borrow(&update.feeds(), 2);
    assert!(feed_3.feed_id() == 112, 0);
    assert!(feed_3.price() == option::some(option::some(i64::from_u64(113747064619385816))), 0);
    assert!(feed_3.best_bid_price() == option::some(option::none()), 0);
    assert!(feed_3.best_ask_price() == option::some(option::none()), 0);
    assert!(feed_3.exponent() == option::some(i16::new(12, true)), 0);
    assert!(feed_3.publisher_count() == option::none(), 0);
    assert!(feed_3.confidence() == option::none(), 0);
    assert!(feed_3.funding_rate() == option::some(option::some(i64::from_u64(31670000))), 0);
    assert!(feed_3.funding_timestamp() == option::some(option::some(1755619200000000)), 0);
    assert!(feed_3.funding_rate_interval() == option::some(option::some(28800000000)), 0);
}
