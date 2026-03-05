#[test_only]
#[allow(implicit_const_copy)]
module pyth_lazer::pyth_lazer_tests;

use std::unit_test::{assert_eq, destroy};
use sui::clock;

use pyth_lazer::{
    channel::new_fixed_rate_200ms,
    feed::Feed,
    governance,
    i16,
    i64,
    pyth_lazer::{
        parse_and_verify_le_ecdsa_update, verify_le_ecdsa_message,
        ESignerNotTrusted, ESignerExpired, EInvalidUpdateMagic,
        EInvalidPayloadMagic, EInvalidPayloadLength
    },
    state,
};

/* Test data from the Lazer subscription:
> Request
{
  "subscriptionId": 1,
  "type": "subscribe",
  "priceFeedIds": [1, 2, 112],
  "properties": [
    "price",
    "bestBidPrice",
    "bestAskPrice",
    "exponent",
    "fundingRate",
    "fundingTimestamp",
    "fundingRateInterval",
    "marketSession",
    "emaPrice",
    "emaConfidence",
    "feedUpdateTimestamp",
  ],
  "formats": ["leEcdsa"],
  "channel": "fixed_rate@200ms",
  "jsonBinaryEncoding": "hex",
}
< Response
{
  "type": "streamUpdated",
  "subscriptionId": 1,
  "parsed": {
    "timestampUs": "1771252161800000",
    "priceFeeds": [
      {
        "priceFeedId": 1,
        "price": "6828284601313",
        "bestBidPrice": "6828243494234",
        "bestAskPrice": "6828830067583",
        "exponent": -8,
        "marketSession": "regular",
        "emaPrice": "6866807100000",
        "emaConfidence": 6866706200000,
        "feedUpdateTimestamp": 1771252161800000
      },
      {
        "priceFeedId": 2,
        "price": "195892878231",
        "bestBidPrice": "195881010500",
        "bestAskPrice": "195897850776",
        "exponent": -8,
        "marketSession": "regular",
        "emaPrice": "197455529000",
        "emaConfidence": 197451517000,
        "feedUpdateTimestamp": 1771252161800000
      },
      {
        "priceFeedId": 112,
        "price": "68554377427540000",
        "exponent": -12,
        "fundingRate": -32770000,
        "fundingTimestamp": 1771228800003000,
        "fundingRateInterval": 28800000000,
        "marketSession": "regular",
        "feedUpdateTimestamp": 1771252161800000
      }
    ]
  },
  "leEcdsa": {
    "encoding": "hex",
    "data": "e4bd474d73a7e70a8e2b8de236b55dcc6a771b4a8a1533fe492f424fae162369fa14103e04c1c93302cef8a052110a950da031f9dc5eade9e6099e95668aff2592ec1f7900fe0075d3c7934067e9c7f14a06000303010000000b00e1637ad535060000015a2507d335060000027f8bfdf53506000004f8ff0600070008000900000a601299cd3e0600000bc07595c73e0600000c014067e9c7f14a0600020000000b00971b209c2d0000000144056b9b2d0000000298fb6b9c2d00000004f8ff0600070008000900000a284444f92d0000000b480c07f92d0000000c014067e9c7f14a0600700000000b0020d85dd2d78df30001000000000000000002000000000000000004f4ff060130f80bfeffffffff0701b8ab7057ec4a0600080100209db4060000000900000a00000000000000000b00000000000000000c014067e9c7f14a0600"
  }
}
*/
const TEST_LAZER_UPDATE: vector<u8> = x"e4bd474d73a7e70a8e2b8de236b55dcc6a771b4a8a1533fe492f424fae162369fa14103e04c1c93302cef8a052110a950da031f9dc5eade9e6099e95668aff2592ec1f7900fe0075d3c7934067e9c7f14a06000303010000000b00e1637ad535060000015a2507d335060000027f8bfdf53506000004f8ff0600070008000900000a601299cd3e0600000bc07595c73e0600000c014067e9c7f14a0600020000000b00971b209c2d0000000144056b9b2d0000000298fb6b9c2d00000004f8ff0600070008000900000a284444f92d0000000b480c07f92d0000000c014067e9c7f14a0600700000000b0020d85dd2d78df30001000000000000000002000000000000000004f4ff060130f80bfeffffffff0701b8ab7057ec4a0600080100209db4060000000900000a00000000000000000b00000000000000000c014067e9c7f14a0600";

const TEST_PAYLOAD: vector<u8> = x"75d3c793c0f4295fbb3c060003030100000007005986bacb520a00000162e937ca520a000002a5087bd4520a000004f8ff06000700080002000000070078625c456100000001aba11b456100000002ba8ac0456100000004f8ff060007000800700000000700d8c3e1445a1c940101000000000000000002000000000000000004f4ff0601f03ee30100000000070100e0c6f2b93c0600080100209db406000000";
const TEST_SIGNATURE: vector<u8> = x"42e3c9c3477b30f2c5527ebe2fb2c8adadadacaddfa7d95243b80fb8f0d813b453e587f140cf40a1120d75f1ffee8ad4337267e4fcbd23eabb2a555804f85ec101";
const TEST_TRUSTED_SIGNER_PUBKEY: vector<u8> = x"03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b";

#[test]
public fun test_parse_and_verify_le_ecdsa_update() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer that matches the test data
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2_000_000_000_000; // Far in the future
    state.update_trusted_signer(&current_cap, trusted_pubkey, expiry_time);

    let update = parse_and_verify_le_ecdsa_update(&state, &clock, TEST_LAZER_UPDATE);

    // If we reach this point, the function successfully verified & parsed the payload (no assertion failures)
    // Validate that the fields have correct values
    assert_eq!(update.timestamp(), 1771252161800000);
    assert_eq!(update.channel(), new_fixed_rate_200ms());
    assert_eq!(update.feeds_ref().length(), 3);

    // Separated into another function to get past function size limit
    test_parse_and_verify_le_ecdsa_update__feeds(update.feeds_ref());

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test_only]
fun test_parse_and_verify_le_ecdsa_update__feeds(feeds: &vector<Feed>) {
    let feed_1 = &feeds[0];
    assert_eq!(feed_1.feed_id(), 1);
    assert_eq!(
        feed_1.price(),
        option::some(option::some(i64::from_u64(6828284601313)))
    );
    assert_eq!(
        feed_1.best_bid_price(),
        option::some(option::some(i64::from_u64(6828243494234))),
    );
    assert_eq!(
        feed_1.best_ask_price(),
        option::some(option::some(i64::from_u64(6828830067583))),
    );
    assert_eq!(feed_1.exponent(), option::some(i16::new(8, true)));
    assert_eq!(feed_1.publisher_count(), option::none());
    assert_eq!(feed_1.confidence(), option::none());
    assert_eq!(feed_1.funding_rate(), option::some(option::none()));
    assert_eq!(feed_1.funding_timestamp(), option::some(option::none()));
    assert_eq!(feed_1.funding_rate_interval(), option::some(option::none()));
    assert!(feed_1.market_session().is_some_and!(|s| s.is_regular()));
    assert_eq!(feed_1.ema_price(), option::some(option::some(i64::from_u64(6866807100000))));
    assert_eq!(feed_1.ema_confidence(), option::some(option::some(6866706200000)));
    assert_eq!(feed_1.feed_update_timestamp(), option::some(option::some(1771252161800000)));

    let feed_2 = &feeds[1];
    assert_eq!(feed_2.feed_id(), 2);
    assert_eq!(feed_2.price(), option::some(option::some(i64::from_u64(195892878231))));
    assert_eq!(feed_2.best_bid_price(), option::some(option::some(i64::from_u64(195881010500))));
    assert_eq!(feed_2.best_ask_price(), option::some(option::some(i64::from_u64(195897850776))));
    assert_eq!(feed_2.exponent(), option::some(i16::new(8, true)));
    assert_eq!(feed_2.publisher_count(), option::none());
    assert_eq!(feed_2.confidence(), option::none());
    assert_eq!(feed_2.funding_rate(), option::some(option::none()));
    assert_eq!(feed_2.funding_timestamp(), option::some(option::none()));
    assert_eq!(feed_2.funding_rate_interval(), option::some(option::none()));
    assert!(feed_2.market_session().is_some_and!(|s| s.is_regular()));
    assert_eq!(feed_2.ema_price(), option::some(option::some(i64::from_u64(197455529000))));
    assert_eq!(feed_2.ema_confidence(), option::some(option::some(197451517000)));
    assert_eq!(feed_2.feed_update_timestamp(), option::some(option::some(1771252161800000)));

    let feed_3 = &feeds[2];
    assert_eq!(feed_3.feed_id(), 112);
    assert_eq!(feed_3.price(), option::some(option::some(i64::from_u64(68554377427540000))));
    assert_eq!(feed_3.best_bid_price(), option::some(option::none()));
    assert_eq!(feed_3.best_ask_price(), option::some(option::none()));
    assert_eq!(feed_3.exponent(), option::some(i16::new(12, true)));
    assert_eq!(feed_3.publisher_count(), option::none());
    assert_eq!(feed_3.confidence(), option::none());
    assert_eq!(feed_3.funding_rate(), option::some(option::some(i64::new(32770000, true))));
    assert_eq!(feed_3.funding_timestamp(), option::some(option::some(1771228800003000)));
    assert_eq!(feed_3.funding_rate_interval(), option::some(option::some(28800000000)));
    assert!(feed_3.market_session().is_some_and!(|s| s.is_regular()));
    assert_eq!(feed_3.ema_price(), option::some(option::none()));
    assert_eq!(feed_3.ema_confidence(), option::some(option::none()));
    assert_eq!(feed_3.feed_update_timestamp(), option::some(option::some(1771252161800000)));
}

#[test]
public fun test_verify_le_ecdsa_message_success() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let expiry_time = 20_000_000_000_000; // Far in the future
    state.update_trusted_signer(&current_cap, TEST_TRUSTED_SIGNER_PUBKEY, expiry_time);

    // This should succeed
    verify_le_ecdsa_message(&state, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = ESignerNotTrusted)]
public fun test_verify_le_ecdsa_message_no_signers() {
    let mut ctx = tx_context::dummy();
    let state = state::new_for_test(&mut ctx, governance::dummy());
    let clock = clock::create_for_testing(&mut ctx);

    // Don't add any trusted signers - this should fail with ESignerNotTrusted
    verify_le_ecdsa_message(&state, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = ESignerNotTrusted)]
public fun test_verify_le_ecdsa_message_untrusted_signer() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add signers that don't match the signature
    let trusted_pubkey1 = x"03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let trusted_pubkey2 = x"03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    state.update_trusted_signer(&current_cap, trusted_pubkey1, 1_000_000_000_000);
    state.update_trusted_signer(&current_cap, trusted_pubkey2, 1_000_000_000_000);

    // This should still fail with ESignerNotTrusted since the signature doesn't match any of the signers
    verify_le_ecdsa_message(&state, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test]
public fun test_verify_le_ecdsa_message_nearly_expired_signer() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let mut clock = clock::create_for_testing(&mut ctx);

    let expiry_time = 1_000_000_000_000;
    clock.set_for_testing(expiry_time * 1000 - 1); // Advance clock right before signer expiry

    // Add an signer
    state.update_trusted_signer(&current_cap, TEST_TRUSTED_SIGNER_PUBKEY, expiry_time);

    // This should succeed
    verify_le_ecdsa_message(&state, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = ESignerExpired)]
public fun test_verify_le_ecdsa_message_expired_signer() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let mut clock = clock::create_for_testing(&mut ctx);

    let expiry_time = 1_000_000_000_000;
    clock.set_for_testing(expiry_time * 1000); // Advance clock to signer expiry

    // Add an expired signer
    state.update_trusted_signer(&current_cap, TEST_TRUSTED_SIGNER_PUBKEY, expiry_time);

    // This should fail with ESignerExpired
    verify_le_ecdsa_message(&state, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = ESignerExpired)]
public fun test_verify_le_ecdsa_message_recently_expired_signer() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let mut clock = clock::create_for_testing(&mut ctx);

    let expiry_time = 1_000_000_000_000;
    clock.set_for_testing(expiry_time * 1000 + 1); // Advance clock right past signer expiry

    // Add an expired signer
    state.update_trusted_signer(&current_cap, TEST_TRUSTED_SIGNER_PUBKEY, expiry_time);

    // This should fail with ESignerExpired
    verify_le_ecdsa_message(&state, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test]
public fun test_verify_le_ecdsa_message_multiple_signers() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add multiple trusted signers
    let trusted_pubkey1 = x"03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"; // This doesn't match our signature
    let trusted_pubkey2 = TEST_TRUSTED_SIGNER_PUBKEY; // This does
    let expiry_time = 1_000_000_000_000;

    state.update_trusted_signer(&current_cap, trusted_pubkey1, expiry_time);
    state.update_trusted_signer(&current_cap, trusted_pubkey2, expiry_time);

    // This should succeed because trusted_pubkey2 matches the signature
    verify_le_ecdsa_message(&state, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

// === NEGATIVE PARSING TESTS ===

#[test, expected_failure(abort_code = EInvalidUpdateMagic)]
public fun test_parse_invalid_update_magic() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2_000_000_000_000; // Far in the future
    state.update_trusted_signer(&current_cap, trusted_pubkey, expiry_time);

    // Create update with invalid magic (first 4 bytes corrupted)
    let mut invalid_update = TEST_LAZER_UPDATE;
    *vector::borrow_mut(&mut invalid_update, 0) = 0xFF; // Corrupt the magic

    // This should fail with EInvalidUpdateMagic
    parse_and_verify_le_ecdsa_update(&state, &clock, invalid_update);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = EInvalidPayloadMagic)]
public fun test_parse_invalid_payload_magic() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2_000_000_000_000; // Far in the future
    state.update_trusted_signer(&current_cap, trusted_pubkey, expiry_time);

    // Create update with invalid payload magic
    // The payload magic starts at byte 69 (4 bytes magic + 65 bytes signature + 2 payload length)
    let mut invalid_update = TEST_LAZER_UPDATE;
    *invalid_update.borrow_mut(71) = 0xFF; // Corrupt the payload magic

    // This corrupts the payload magic, so expect EInvalidMagic
    parse_and_verify_le_ecdsa_update(&state, &clock, invalid_update);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = EInvalidPayloadLength)]
public fun test_parse_invalid_payload_length() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2_000_000_000_000; // Far in the future
    state.update_trusted_signer(&current_cap, trusted_pubkey, expiry_time);

    // Create update with wrong payload length
    // Layout: magic(4) + signature(65) + payload_len(2) + payload...
    // So payload length is at bytes 69-70
    let mut invalid_update = TEST_LAZER_UPDATE;
    *invalid_update.borrow_mut(69) = 0xFF; // Set payload length too high

    // This should fail with EInvalidPayloadLength because payload length validation happens before signature verification
    parse_and_verify_le_ecdsa_update(&state, &clock, invalid_update);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = 0, location = sui::bcs)]
public fun test_parse_truncated_data() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2_000_000_000_000; // Far in the future
    state.update_trusted_signer(&current_cap, trusted_pubkey, expiry_time);

    // Create truncated update (only first 50 bytes)
    let truncated_update = TEST_LAZER_UPDATE.take(50);

    // This should fail with BCS EOutOfRange error when trying to read beyond available data
    parse_and_verify_le_ecdsa_update(&state, &clock, truncated_update);

    // Clean up
    destroy(state);
    clock.destroy_for_testing();
}
