#[test_only]
#[allow(implicit_const_copy)]
module pyth_lazer::pyth_lazer_tests;

use std::unit_test::assert_eq;
use iota::clock;

use pyth_lazer::{
    feed::Feed,
    governance,
    i16,
    i64,
    pyth_lazer::{
        parse_and_verify_le_ecdsa_update,
        verify_le_ecdsa_message, ESignerNotTrusted, ESignerExpired, EInvalidUpdateMagic,
        EInvalidPayloadMagic, EInvalidPayloadLength
    },
    state,
};

/* Test data from a Lazer subscription:
> Request
{
  "subscriptionId": 1,
  "type": "subscribe",
  "priceFeedIds": [1, 2, 112],
  "properties": [
    "price",
    "bestBidPrice",
    "bestAskPrice",
    "confidence",
    "exponent",
    "publisherCount",
    "fundingRate",
    "fundingTimestamp",
    "fundingRateInterval",
    "marketSession",
    "emaPrice",
    "emaConfidence",
    "feedUpdateTimestamp"
  ],
  "formats": ["leEcdsa"],
  "channel": "fixed_rate@1000ms",
  "jsonBinaryEncoding": "hex"
}
< Response
{
  "parsed": {
    "timestampUs": "1778594100000000",
    "priceFeeds": [
      {
        "priceFeedId": 1,
        "price": "8063953748222",
        "bestBidPrice": "8063927547164",
        "bestAskPrice": "8064518785063",
        "publisherCount": 16,
        "exponent": -8,
        "confidence": 1783407191,
        "marketSession": "regular",
        "emaPrice": "8071363900000",
        "emaConfidence": 1946443420,
        "feedUpdateTimestamp": 1778594100000000
      },
      {
        "priceFeedId": 2,
        "price": "227676960645",
        "bestBidPrice": "227672112231",
        "bestAskPrice": "227695946107",
        "publisherCount": 17,
        "exponent": -8,
        "confidence": 69539855,
        "marketSession": "regular",
        "emaPrice": "228268947000",
        "emaConfidence": 57689210,
        "feedUpdateTimestamp": 1778594100000000
      },
      {
        "priceFeedId": 112,
        "price": "80813667608700000",
        "publisherCount": 3,
        "exponent": -12,
        "fundingRate": 38770000,
        "fundingTimestamp": 1778594099726525,
        "fundingRateInterval": 28800000000,
        "marketSession": "regular",
        "feedUpdateTimestamp": 1778594100000000
      }
    ]
  },
  "leEcdsa": {
    "encoding": "hex",
    "data": "e4bd474da72e1daf244e50635f473fcb0e595e3643302f976c95f7fabfc0660f5a612d2d55bdb94f5a2fe926932ce9d9da338d05969b5a8b8c94024c86399005cc547fd001220175d3c79300b587359f5106000403010000000d00fe40198955070000011c75898755070000022708c7aa550700000557a24c6a0000000004f8ff0310000600070008000900000a6032c742570700000b9c5e0474000000000c0100b587359f510600020000000d0085b79a02350000000167bc500235000000027b69bc0335000000050f1825040000000004f8ff0311000600070008000900000a38b6e325350000000b7a447003000000000c0100b587359f510600700000000d006024d03e9a1b1f0101000000000000000002000000000000000005000000000000000004f4ff030300060150954f02000000000701bd8883359f510600080100209db4060000000900000a00000000000000000b00000000000000000c0100b587359f510600"
  }
}
*/
const TEST_LAZER_UPDATE: vector<u8> = x"e4bd474da72e1daf244e50635f473fcb0e595e3643302f976c95f7fabfc0660f5a612d2d55bdb94f5a2fe926932ce9d9da338d05969b5a8b8c94024c86399005cc547fd001220175d3c79300b587359f5106000403010000000d00fe40198955070000011c75898755070000022708c7aa550700000557a24c6a0000000004f8ff0310000600070008000900000a6032c742570700000b9c5e0474000000000c0100b587359f510600020000000d0085b79a02350000000167bc500235000000027b69bc0335000000050f1825040000000004f8ff0311000600070008000900000a38b6e325350000000b7a447003000000000c0100b587359f510600700000000d006024d03e9a1b1f0101000000000000000002000000000000000005000000000000000004f4ff030300060150954f02000000000701bd8883359f510600080100209db4060000000900000a00000000000000000b00000000000000000c0100b587359f510600";

const TEST_PAYLOAD: vector<u8> = x"75d3c79300b587359f5106000403010000000d00fe40198955070000011c75898755070000022708c7aa550700000557a24c6a0000000004f8ff0310000600070008000900000a6032c742570700000b9c5e0474000000000c0100b587359f510600020000000d0085b79a02350000000167bc500235000000027b69bc0335000000050f1825040000000004f8ff0311000600070008000900000a38b6e325350000000b7a447003000000000c0100b587359f510600700000000d006024d03e9a1b1f0101000000000000000002000000000000000005000000000000000004f4ff030300060150954f02000000000701bd8883359f510600080100209db4060000000900000a00000000000000000b00000000000000000c0100b587359f510600";
const TEST_SIGNATURE: vector<u8> = x"a72e1daf244e50635f473fcb0e595e3643302f976c95f7fabfc0660f5a612d2d55bdb94f5a2fe926932ce9d9da338d05969b5a8b8c94024c86399005cc547fd001";
const TEST_TRUSTED_SIGNER_PUBKEY: vector<u8> = x"03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b";

#[allow(deprecated_usage)]
#[test]
public fun test_parse_and_verify_le_ecdsa_compatible_update() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, governance::dummy());
    let current_cap = state.current_cap();
    let clock = clock::create_for_testing(&mut ctx);

    // Add the trusted signer that matches the test data
    let trusted_pubkey = TEST_TRUSTED_SIGNER_PUBKEY;
    let expiry_time = 2_000_000_000_000; // Far in the future
    state.update_trusted_signer(&current_cap, trusted_pubkey, expiry_time);

    let update = parse_and_verify_le_ecdsa_update(&state, &clock, x"e4bd474dd87d2ef4d2d3ba283fb68ceeaea1fc2b1544061e8058036a38e56801481785aa0a92b4c1bd1fcecefec37919871b1254b4cdbcd3b70b22b2da0261d65d4dbfb000220175d3c793006f40a49f5106000303010000000d00c417492f5907000001ece9d31e5907000002a818b5675907000005fb6670680000000004f8ff0310000600070008000900000a403b5739560700000b60a7f476000000000c01006f40a49f510600020000000d001ef7c10e3500000001e72f860c35000000025edd430f350000000522f876020000000004f8ff0311000600070008000900000ac076720d350000000b5f047403000000000c01006f40a49f510600700000000d006024d03e9a1b1f0101000000000000000002000000000000000005000000000000000004f4ff030300060150954f020000000007016daf37a49f510600080100209db4060000000900000a00000000000000000b00000000000000000c01006f40a49f510600");

    // If we reach this point, the function successfully verified & parsed the payload (no assertion failures)
    // Validate that the fields have correct values
    assert_eq!(update.timestamp(), 1778595957600000);
    assert!(update.channel().is_fixed_rate_200ms());
    assert_eq!(update.feeds_ref().length(), 3);

    // Clean up
    state.destroy();
    clock.destroy_for_testing();
}

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
    assert_eq!(update.timestamp(), 1778594100000000);
    assert!(update.channel().is_fixed_rate_1000ms());
    assert_eq!(update.feeds_ref().length(), 3);

    test_parse_and_verify_le_ecdsa_update__feeds(update.feeds_ref());

    // Clean up
    state.destroy();
    clock.destroy_for_testing();
}

#[test_only]
fun test_parse_and_verify_le_ecdsa_update__feeds(feeds: &vector<Feed>) {
    let feed_1 = &feeds[0];
    assert_eq!(feed_1.feed_id(), 1);
    assert_eq!(
        feed_1.price(),
        option::some(option::some(i64::from_u64(8063953748222)))
    );
    assert_eq!(
        feed_1.best_bid_price(),
        option::some(option::some(i64::from_u64(8063927547164))),
    );
    assert_eq!(
        feed_1.best_ask_price(),
        option::some(option::some(i64::from_u64(8064518785063))),
    );
    assert_eq!(feed_1.exponent(), option::some(i16::new(8, true)));
    assert_eq!(feed_1.publisher_count(), option::some(16));
    assert_eq!(feed_1.confidence(), option::some(option::some(i64::from_u64(1783407191))));
    assert_eq!(feed_1.funding_rate(), option::some(option::none()));
    assert_eq!(feed_1.funding_timestamp(), option::some(option::none()));
    assert_eq!(feed_1.funding_rate_interval(), option::some(option::none()));
    assert!(feed_1.market_session().is_some_and!(|s| s.is_regular()));
    assert_eq!(feed_1.ema_price(), option::some(option::some(i64::from_u64(8071363900000))));
    assert_eq!(feed_1.ema_confidence(), option::some(option::some(1946443420)));
    assert_eq!(feed_1.feed_update_timestamp(), option::some(option::some(1778594100000000)));

    let feed_2 = &feeds[1];
    assert_eq!(feed_2.feed_id(), 2);
    assert_eq!(feed_2.price(), option::some(option::some(i64::from_u64(227676960645))));
    assert_eq!(feed_2.best_bid_price(), option::some(option::some(i64::from_u64(227672112231))));
    assert_eq!(feed_2.best_ask_price(), option::some(option::some(i64::from_u64(227695946107))));
    assert_eq!(feed_2.exponent(), option::some(i16::new(8, true)));
    assert_eq!(feed_2.publisher_count(), option::some(17));
    assert_eq!(feed_2.confidence(), option::some(option::some(i64::from_u64(69539855))));
    assert_eq!(feed_2.funding_rate(), option::some(option::none()));
    assert_eq!(feed_2.funding_timestamp(), option::some(option::none()));
    assert_eq!(feed_2.funding_rate_interval(), option::some(option::none()));
    assert!(feed_2.market_session().is_some_and!(|s| s.is_regular()));
    assert_eq!(feed_2.ema_price(), option::some(option::some(i64::from_u64(228268947000))));
    assert_eq!(feed_2.ema_confidence(), option::some(option::some(57689210)));
    assert_eq!(feed_2.feed_update_timestamp(), option::some(option::some(1778594100000000)));

    let feed_3 = &feeds[2];
    assert_eq!(feed_3.feed_id(), 112);
    assert_eq!(feed_3.price(), option::some(option::some(i64::from_u64(80813667608700000))));
    assert_eq!(feed_3.best_bid_price(), option::some(option::none()));
    assert_eq!(feed_3.best_ask_price(), option::some(option::none()));
    assert_eq!(feed_3.exponent(), option::some(i16::new(12, true)));
    assert_eq!(feed_3.publisher_count(), option::some(3));
    assert_eq!(feed_3.confidence(), option::some(option::none()));
    assert_eq!(feed_3.funding_rate(), option::some(option::some(i64::from_u64(38770000))));
    assert_eq!(feed_3.funding_timestamp(), option::some(option::some(1778594099726525)));
    assert_eq!(feed_3.funding_rate_interval(), option::some(option::some(28800000000)));
    assert!(feed_3.market_session().is_some_and!(|s| s.is_regular()));
    assert_eq!(feed_3.ema_price(), option::some(option::none()));
    assert_eq!(feed_3.ema_confidence(), option::some(option::none()));
    assert_eq!(feed_3.feed_update_timestamp(), option::some(option::some(1778594100000000)));
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
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
    state.destroy();
    clock.destroy_for_testing();
}

#[test, expected_failure(abort_code = 0, location = iota::bcs)]
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
    let truncated_update = vector::tabulate!(50, |i| TEST_LAZER_UPDATE[i]);

    // This should fail with BCS EOutOfRange error when trying to read beyond available data
    parse_and_verify_le_ecdsa_update(&state, &clock, truncated_update);

    // Clean up
    state.destroy();
    clock.destroy_for_testing();
}
