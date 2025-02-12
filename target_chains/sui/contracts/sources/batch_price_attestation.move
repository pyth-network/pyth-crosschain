module pyth::batch_price_attestation {
    use std::vector::{Self};
    use sui::clock::{Self, Clock};

    use pyth::price_feed::{Self};
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_identifier::{Self};
    use pyth::price_status;
    use pyth::deserialize::{Self};

    use wormhole::cursor::{Self, Cursor};
    use wormhole::bytes::{Self};

    #[test_only]
    use pyth::price;
    #[test_only]
    use pyth::i64;

    const MAGIC: u64 = 0x50325748; // "P2WH" (Pyth2Wormhole) raw ASCII bytes
    const E_INVALID_ATTESTATION_MAGIC_VALUE: u64 = 0;
    const E_INVALID_BATCH_ATTESTATION_HEADER_SIZE: u64 = 1;

    /// @notice This struct is based on the legacy wormhole attester implementation in pythnet_sdk
    struct BatchPriceAttestation {
        header: Header,
        attestation_size: u64,
        attestation_count: u64,
        price_infos: vector<PriceInfo>,
    }

    struct Header {
        magic: u64,
        version_major: u64,
        version_minor: u64,
        header_size: u64,
        payload_id: u8,
    }

    fun deserialize_header(cur: &mut Cursor<u8>): Header {
        let magic = (deserialize::deserialize_u32(cur) as u64);
        assert!(magic == MAGIC, E_INVALID_ATTESTATION_MAGIC_VALUE);
        let version_major = deserialize::deserialize_u16(cur);
        let version_minor = deserialize::deserialize_u16(cur);
        let header_size = deserialize::deserialize_u16(cur);
        let payload_id = deserialize::deserialize_u8(cur);

        assert!(header_size >= 1, E_INVALID_BATCH_ATTESTATION_HEADER_SIZE);
        let unknown_header_bytes = header_size - 1;
        let _unknown = bytes::take_bytes(cur, (unknown_header_bytes as u64));

        Header {
            magic,
            header_size: (header_size as u64),
            version_minor: (version_minor as u64),
            version_major: (version_major as u64),
            payload_id,
        }
    }

    public fun destroy(batch: BatchPriceAttestation): vector<PriceInfo> {
        let BatchPriceAttestation {
            header: Header {
                magic: _,
                version_major: _,
                version_minor: _,
                header_size: _,
                payload_id: _,
            },
            attestation_size: _,
            attestation_count: _,
            price_infos,
        } = batch;
        price_infos
    }

    public fun get_attestation_count(batch: &BatchPriceAttestation): u64 {
        batch.attestation_count
    }

    public fun get_price_info(batch: &BatchPriceAttestation, index: u64): &PriceInfo {
        vector::borrow(&batch.price_infos, index)
    }

    public fun deserialize(bytes: vector<u8>, clock: &Clock): BatchPriceAttestation {
        let cur = cursor::new(bytes);
        let header = deserialize_header(&mut cur);

        let attestation_count = deserialize::deserialize_u16(&mut cur);
        let attestation_size = deserialize::deserialize_u16(&mut cur);
        let price_infos = vector::empty();

        let i = 0;
        while (i < attestation_count) {
            let price_info = deserialize_price_info(&mut cur, clock);
            vector::push_back(&mut price_infos, price_info);

            // Consume any excess bytes
            let parsed_bytes = 32+32+8+8+4+8+8+1+4+4+8+8+8+8+8;
            let _excess = bytes::take_bytes(&mut cur, (attestation_size - parsed_bytes as u64));

            i = i + 1;
        };
        cursor::destroy_empty(cur);

        BatchPriceAttestation {
            header,
            attestation_count: (attestation_count as u64),
            attestation_size: (attestation_size as u64),
            price_infos,
        }
    }

    fun deserialize_price_info(cur: &mut Cursor<u8>, clock: &Clock): PriceInfo {

        // Skip obsolete field
        let _product_identifier = deserialize::deserialize_vector(cur, 32);
        let price_identifier = price_identifier::from_byte_vec(deserialize::deserialize_vector(cur, 32));
        let price = deserialize::deserialize_i64(cur);
        let conf = deserialize::deserialize_u64(cur);
        let expo = deserialize::deserialize_i32(cur);
        let ema_price = deserialize::deserialize_i64(cur);
        let ema_conf = deserialize::deserialize_u64(cur);
        let status = price_status::from_u64((deserialize::deserialize_u8(cur) as u64));

        // Skip obsolete fields
        let _num_publishers = deserialize::deserialize_u32(cur);
        let _max_num_publishers = deserialize::deserialize_u32(cur);

        let attestation_time = deserialize::deserialize_u64(cur);
        let publish_time = deserialize::deserialize_u64(cur); //
        let prev_publish_time = deserialize::deserialize_u64(cur);
        let prev_price = deserialize::deserialize_i64(cur);
        let prev_conf = deserialize::deserialize_u64(cur);

        // Handle the case where the status is not trading. This logic will soon be moved into
        // the attester.

        // If status is trading, use the current price.
        // If not, use the last known trading price.
        let current_price = pyth::price::new(price, conf, expo, publish_time);
        if (status != price_status::new_trading()) {
            current_price = pyth::price::new(prev_price, prev_conf, expo, prev_publish_time);
        };

        // If status is trading, use the timestamp of the aggregate as the timestamp for the
        // EMA price. If not, the EMA will have last been updated when the aggregate last had
        // trading status, so use prev_publish_time (the time when the aggregate last had trading status).
        let ema_timestamp = publish_time;
        if (status != price_status::new_trading()) {
            ema_timestamp = prev_publish_time;
        };

        price_info::new_price_info(
            attestation_time,
            clock::timestamp_ms(clock) / 1000, // Divide by 1000 to get timestamp in seconds
            price_feed::new(
                price_identifier,
                current_price,
                pyth::price::new(ema_price, ema_conf, expo, ema_timestamp),
            )
        )
    }

    #[test]
    #[expected_failure]
    fun test_deserialize_batch_price_attestation_invalid_magic() {
        use sui::test_scenario::{Self, ctx};
        let test = test_scenario::begin(@0x1234);
        let test_clock = clock::create_for_testing(ctx(&mut test));
        // A batch price attestation with a magic number of 0x50325749
        let bytes = x"5032574900030000000102000400951436e0be37536be96f0896366089506a59763d036728332d3e3038047851aea7c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1000000000000049a0000000000000008fffffffb00000000000005dc0000000000000003000000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000006150000000000000007215258d81468614f6b7e194c5d145609394f67b041e93e6695dcc616faadd0603b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe000000000000041a0000000000000003fffffffb00000000000005cb0000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e4000000000000048600000000000000078ac9cf3ab299af710d735163726fdae0db8465280502eb9f801f74b3c1bd190333832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d00000000000003f20000000000000002fffffffb00000000000005e70000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e40000000000000685000000000000000861db714e9ff987b6fedf00d01f9fea6db7c30632d6fc83b7bc9459d7192bc44a21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db800000000000006cb0000000000000001fffffffb00000000000005e40000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000007970000000000000001";
        let _ = destroy(deserialize(bytes, &test_clock));
        clock::destroy_for_testing(test_clock);
        test_scenario::end(test);
    }

    #[test]
    fun test_deserialize_batch_price_attestation() {
        use sui::test_scenario::{Self, ctx};
        // Set the arrival time
        let test = test_scenario::begin(@0x1234);
        let test_clock = clock::create_for_testing(ctx(&mut test));
        test_scenario::next_tx(&mut test, @0x1234);
        let arrival_time_in_seconds = clock::timestamp_ms(&test_clock) / 1000;

        // let arrival_time = tx_context::epoch(ctx(&mut test));

        // A raw batch price attestation
        // The first attestation has a status of UNKNOWN
        let bytes = x"5032574800030000000102000400951436e0be37536be96f0896366089506a59763d036728332d3e3038047851aea7c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1000000000000049a0000000000000008fffffffb00000000000005dc0000000000000003000000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000006150000000000000007215258d81468614f6b7e194c5d145609394f67b041e93e6695dcc616faadd0603b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe000000000000041a0000000000000003fffffffb00000000000005cb0000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e4000000000000048600000000000000078ac9cf3ab299af710d735163726fdae0db8465280502eb9f801f74b3c1bd190333832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d00000000000003f20000000000000002fffffffb00000000000005e70000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e40000000000000685000000000000000861db714e9ff987b6fedf00d01f9fea6db7c30632d6fc83b7bc9459d7192bc44a21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db800000000000006cb0000000000000001fffffffb00000000000005e40000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000007970000000000000001";

        let expected = BatchPriceAttestation {
            header: Header {
                magic: 0x50325748,
                version_major: 3,
                version_minor: 0,
                payload_id: 2,
                header_size: 1,
            },
            attestation_count: 4,
            attestation_size: 149,
            price_infos: vector<PriceInfo>[
                price_info::new_price_info(
                    1663680747,
                    arrival_time_in_seconds,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1"),
                        price::new(i64::new(1557, false), 7, i64::new(5, true), 1663680740),
                        price::new(i64::new(1500, false), 3, i64::new(5, true), 1663680740),
                    )                ),
                price_info::new_price_info(
                    1663680747,
                    arrival_time_in_seconds,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe"),
                        price::new(i64::new(1050, false), 3, i64::new(5, true), 1663680745),
                        price::new(i64::new(1483, false), 3, i64::new(5, true), 1663680745),
                    )                ),
                price_info::new_price_info(
                    1663680747,
                    arrival_time_in_seconds,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d"),
                        price::new(i64::new(1010, false), 2, i64::new(5, true), 1663680745),
                        price::new(i64::new(1511, false), 3, i64::new(5, true), 1663680745),
                    )                ),
                price_info::new_price_info(
                    1663680747,
                    arrival_time_in_seconds,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db8"),
                        price::new(i64::new(1739, false), 1, i64::new(5, true), 1663680745),
                        price::new(i64::new(1508, false), 3, i64::new(5, true), 1663680745),
                    )
                ),
            ],
        };

        let deserialized = deserialize(bytes, &test_clock);

        assert!(&expected == &deserialized, 1);
        destroy(expected);
        destroy(deserialized);
        clock::destroy_for_testing(test_clock);
        test_scenario::end(test);
    }
}
