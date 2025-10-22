#[test_only]
#[allow(implicit_const_copy)]
module pyth_lazer::pyth_lazer_tests;

use pyth_lazer::admin;
use pyth_lazer::channel::new_fixed_rate_200ms;
use pyth_lazer::i16;
use pyth_lazer::i64;
use pyth_lazer::pyth_lazer::{parse_and_verify_le_ecdsa_update, verify_le_ecdsa_message, ESignerNotTrusted, ESignerExpired, EInvalidMagic, EInvalidPayloadLength};
use pyth_lazer::state;
use sui::clock;

const TEST_LAZER_UPDATE: vector<u8> = x"e4bd474d42e3c9c3477b30f2c5527ebe2fb2c8adadadacaddfa7d95243b80fb8f0d813b453e587f140cf40a1120d75f1ffee8ad4337267e4fcbd23eabb2a555804f85ec101a10075d3c793c0f4295fbb3c060003030100000007005986bacb520a00000162e937ca520a000002a5087bd4520a000004f8ff06000700080002000000070078625c456100000001aba11b456100000002ba8ac0456100000004f8ff060007000800700000000700d8c3e1445a1c940101000000000000000002000000000000000004f4ff0601f03ee30100000000070100e0c6f2b93c0600080100209db406000000";
const TEST_PAYLOAD: vector<u8> = x"75d3c793c0f4295fbb3c060003030100000007005986bacb520a00000162e937ca520a000002a5087bd4520a000004f8ff06000700080002000000070078625c456100000001aba11b456100000002ba8ac0456100000004f8ff060007000800700000000700d8c3e1445a1c940101000000000000000002000000000000000004f4ff0601f03ee30100000000070100e0c6f2b93c0600080100209db406000000";
const TEST_SIGNATURE: vector<u8> = x"42e3c9c3477b30f2c5527ebe2fb2c8adadadacaddfa7d95243b80fb8f0d813b453e587f140cf40a1120d75f1ffee8ad4337267e4fcbd23eabb2a555804f85ec101";
const TEST_TRUSTED_SIGNER_PUBKEY: vector<u8> = x"03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b";

/*
The test data above is from the Lazer subscription:
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

#[test]
public fun test_parse_and_verify_le_ecdsa_update() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer that matches the test data
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2000000000000000; // Far in the future
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey, expiry_time);

    let update = parse_and_verify_le_ecdsa_update(&s, &clock, TEST_LAZER_UPDATE);

    // If we reach this point, the function successfully verified & parsed the payload (no assertion failures)
    // Validate that the fields have correct values
    assert!(update.timestamp() == 1755625313400000, 0);
    assert!(update.channel() == new_fixed_rate_200ms(), 0);
    assert!(vector::length(&update.feeds()) == 3, 0);

    let feed_1 = vector::borrow(&update.feeds(), 0);
    assert!(feed_1.feed_id() == 1, 0);
    assert!(feed_1.price() == option::some(option::some(i64::from_u64(11350721594969))), 0);
    assert!(
        feed_1.best_bid_price() == option::some(option::some(i64::from_u64(11350696257890))),
        0,
    );
    assert!(
        feed_1.best_ask_price() == option::some(option::some(i64::from_u64(11350868428965))),
        0,
    );
    assert!(feed_1.exponent() == option::some(i16::new(8, true)), 0);
    assert!(feed_1.publisher_count() == option::none(), 0);
    assert!(feed_1.confidence() == option::none(), 0);
    assert!(feed_1.funding_rate() == option::some(option::none()), 0);
    assert!(feed_1.funding_timestamp() == option::some(option::none()), 0);
    assert!(feed_1.funding_rate_interval() == option::some(option::none()), 0);

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
    assert!(feed_2.funding_rate_interval() == option::some(option::none()), 0);

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

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

#[test]
public fun test_verify_le_ecdsa_message_success() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let expiry_time = 20000000000000000; // Far in the future
    state::update_trusted_signer(&admin_cap, &mut s, TEST_TRUSTED_SIGNER_PUBKEY, expiry_time);

    // This should succeed
    verify_le_ecdsa_message(&s, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

#[test, expected_failure(abort_code = ESignerNotTrusted)]
public fun test_verify_le_ecdsa_message_untrusted_signer() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Don't add any trusted signers - this should fail with ESignerNotTrusted
    verify_le_ecdsa_message(&s, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);
    
    // Add signers that don't match the signature
    let trusted_pubkey1 = x"03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; 
    let trusted_pubkey2 = x"03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"; 
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey1, 1000000000000000);
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey2, 1000000000000000);

    // This should still fail with ESignerNotTrusted since the signature doesn't match any of the signers
    verify_le_ecdsa_message(&s, &clock,  &TEST_SIGNATURE, &TEST_PAYLOAD);
    
    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

#[test, expected_failure(abort_code = ESignerExpired)]
public fun test_verify_le_ecdsa_message_expired_signer() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let mut clock = clock::create_for_testing(&mut ctx);

    let signature =
        x"42e3c9c3477b30f2c5527ebe2fb2c8adadadacaddfa7d95243b80fb8f0d813b453e587f140cf40a1120d75f1ffee8ad4337267e4fcbd23eabb2a555804f85ec101";
    let payload =
        x"75d3c793c0f4295fbb3c060003030100000007005986bacb520a00000162e937ca520a000002a5087bd4520a000004f8ff06000700080002000000070078625c456100000001aba11b456100000002ba8ac0456100000004f8ff060007000800700000000700d8c3e1445a1c940101000000000000000002000000000000000004f4ff0601f03ee30100000000070100e0c6f2b93c0600080100209db406000000";

    // Add an expired signer 
    let trusted_pubkey = x"03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b";
    let expiry_time = 1000000000000000; 
    clock.set_for_testing(expiry_time); // Advance clock to signer expiry

    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey, expiry_time);

    // This should fail with ESignerExpired
    verify_le_ecdsa_message(&s, &clock,  &signature, &payload);

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

#[test]
public fun test_verify_le_ecdsa_message_multiple_signers() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Extract signature and payload from the test data
    let signature =
        x"42e3c9c3477b30f2c5527ebe2fb2c8adadadacaddfa7d95243b80fb8f0d813b453e587f140cf40a1120d75f1ffee8ad4337267e4fcbd23eabb2a555804f85ec101";
    let payload =
        x"75d3c793c0f4295fbb3c060003030100000007005986bacb520a00000162e937ca520a000002a5087bd4520a000004f8ff06000700080002000000070078625c456100000001aba11b456100000002ba8ac0456100000004f8ff060007000800700000000700d8c3e1445a1c940101000000000000000002000000000000000004f4ff0601f03ee30100000000070100e0c6f2b93c0600080100209db406000000";

    // Add multiple trusted signers
    let trusted_pubkey1 = x"03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"; // This doesn't match our signature
    let trusted_pubkey2 = x"03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b"; // This does
    let expiry_time = 1000000000000000;

    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey1, expiry_time);
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey2, expiry_time);

    // This should succeed because trusted_pubkey2 matches the signature
    verify_le_ecdsa_message(&s, &clock,  &signature, &payload);

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

// === NEGATIVE PARSING TESTS ===

#[test, expected_failure(abort_code = EInvalidMagic)]
public fun test_parse_invalid_update_magic() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2000000000000000; // Far in the future
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey, expiry_time);

    // Create update with invalid magic (first 4 bytes corrupted)
    let mut invalid_update = TEST_LAZER_UPDATE;
    *vector::borrow_mut(&mut invalid_update, 0) = 0xFF; // Corrupt the magic

    // This should fail with EInvalidMagic
    parse_and_verify_le_ecdsa_update(&s, &clock, invalid_update);

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

#[test, expected_failure(abort_code = EInvalidMagic)]
public fun test_parse_invalid_payload_magic() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2000000000000000; // Far in the future
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey, expiry_time);

    // Create update with invalid payload magic
    // The payload magic starts at byte 69 (4 bytes magic + 65 bytes signature + 2 payload length)
    let mut invalid_update = TEST_LAZER_UPDATE;
    *vector::borrow_mut(&mut invalid_update, 71) = 0xFF; // Corrupt the payload magic

    // This corrupts the payload magic, so expect EInvalidMagic
    parse_and_verify_le_ecdsa_update(&s, &clock, invalid_update);

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

#[test, expected_failure(abort_code = EInvalidPayloadLength)]
public fun test_parse_invalid_payload_length() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2000000000000000; // Far in the future
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey, expiry_time);

    // Create update with wrong payload length 
    // Layout: magic(4) + signature(65) + payload_len(2) + payload...
    // So payload length is at bytes 69-70
    let mut invalid_update = TEST_LAZER_UPDATE;
    *vector::borrow_mut(&mut invalid_update, 69) = 0xFF; // Set payload length too high

    // This should fail with EInvalidPayloadLength because payload length validation happens before signature verification
    parse_and_verify_le_ecdsa_update(&s, &clock, invalid_update);

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}

#[test, expected_failure(abort_code = 0, location = sui::bcs)]
public fun test_parse_truncated_data() {
    let mut ctx = tx_context::dummy();
    let mut s = state::new_for_test(&mut ctx);
    let admin_cap = admin::mint_for_test(&mut ctx);
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2000000000000000; // Far in the future
    state::update_trusted_signer(&admin_cap, &mut s, trusted_pubkey, expiry_time);

    // Create truncated update (only first 50 bytes)
    let mut truncated_update = vector::empty<u8>();
    let mut i = 0;
    while (i < 50) {
        vector::push_back(&mut truncated_update, *vector::borrow(&TEST_LAZER_UPDATE, i));
        i = i + 1;
    };

    // This should fail with BCS EOutOfRange error when trying to read beyond available data
    parse_and_verify_le_ecdsa_update(&s, &clock, truncated_update);

    // Clean up
    state::destroy_for_test(s);
    admin::destroy_for_test(admin_cap);
    clock::destroy_for_testing(clock);
}
