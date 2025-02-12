module pyth::batch_price_attestation {
    use pyth::price_feed::{Self};
    use pyth::error;
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_identifier::{Self};
    use pyth::price_status;
    use pyth::deserialize::{Self};
    use aptos_framework::timestamp;
    use wormhole::cursor::{Self, Cursor};
    use std::vector::{Self};

    #[test_only]
    use pyth::price;
    #[test_only]
    use pyth::i64;
    #[test_only]
    use aptos_framework::account;

    const MAGIC: u64 = 0x50325748; // "P2WH" (Pyth2Wormhole) raw ASCII bytes

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
        let magic = deserialize::deserialize_u32(cur);
        assert!(magic == MAGIC, error::invalid_attestation_magic_value());
        let version_major = deserialize::deserialize_u16(cur);
        let version_minor = deserialize::deserialize_u16(cur);
        let header_size = deserialize::deserialize_u16(cur);
        let payload_id = deserialize::deserialize_u8(cur);

        assert!(header_size >= 1, error::invalid_batch_attestation_header_size());
        let unknown_header_bytes = header_size - 1;
        let _unknown = deserialize::deserialize_vector(cur, unknown_header_bytes);

        Header {
            magic: magic,
            header_size: header_size,
            version_minor: version_minor,
            version_major: version_major,
            payload_id: payload_id,
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

    public fun deserialize(bytes: vector<u8>): BatchPriceAttestation {
        let cur = cursor::init(bytes);
        let header = deserialize_header(&mut cur);

        let attestation_count = deserialize::deserialize_u16(&mut cur);
        let attestation_size = deserialize::deserialize_u16(&mut cur);
        let price_infos = vector::empty();

        let i = 0;
        while (i < attestation_count) {
            let price_info = deserialize_price_info(&mut cur);
            vector::push_back(&mut price_infos, price_info);

            // Consume any excess bytes
            let parsed_bytes = 32+32+8+8+4+8+8+1+4+4+8+8+8+8+8;
            let _excess = deserialize::deserialize_vector(&mut cur, attestation_size - parsed_bytes);

            i = i + 1;
        };
        cursor::destroy_empty(cur);

        BatchPriceAttestation {
            header,
            attestation_count: attestation_count,
            attestation_size: attestation_size,
            price_infos: price_infos,
        }
    }

    fun deserialize_price_info(cur: &mut Cursor<u8>): PriceInfo {

        // Skip obselete field
        let _product_identifier = deserialize::deserialize_vector(cur, 32);
        let price_identifier = price_identifier::from_byte_vec(deserialize::deserialize_vector(cur, 32));
        let price = deserialize::deserialize_i64(cur);
        let conf = deserialize::deserialize_u64(cur);
        let expo = deserialize::deserialize_i32(cur);
        let ema_price = deserialize::deserialize_i64(cur);
        let ema_conf = deserialize::deserialize_u64(cur);
        let status = price_status::from_u64((deserialize::deserialize_u8(cur) as u64));

        // Skip obselete fields
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

        price_info::new(
            attestation_time,
            timestamp::now_seconds(),
            price_feed::new(
                price_identifier,
                current_price,
                pyth::price::new(ema_price, ema_conf, expo, ema_timestamp),
            )
        )
    }

    #[test]
    #[expected_failure(abort_code = 65560, location = pyth::batch_price_attestation)]
    fun test_deserialize_batch_price_attestation_invalid_magic() {
        // A batch price attestation with a magic number of 0x50325749
        let bytes = x"5032574900030000000102000400951436e0be37536be96f0896366089506a59763d036728332d3e3038047851aea7c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1000000000000049a0000000000000008fffffffb00000000000005dc0000000000000003000000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000006150000000000000007215258d81468614f6b7e194c5d145609394f67b041e93e6695dcc616faadd0603b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe000000000000041a0000000000000003fffffffb00000000000005cb0000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e4000000000000048600000000000000078ac9cf3ab299af710d735163726fdae0db8465280502eb9f801f74b3c1bd190333832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d00000000000003f20000000000000002fffffffb00000000000005e70000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e40000000000000685000000000000000861db714e9ff987b6fedf00d01f9fea6db7c30632d6fc83b7bc9459d7192bc44a21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db800000000000006cb0000000000000001fffffffb00000000000005e40000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000007970000000000000001";
        destroy(deserialize(bytes));
    }

    #[test(aptos_framework = @aptos_framework)]
    fun test_deserialize_batch_price_attestation(aptos_framework: signer) {

        // Set the arrival time
        account::create_account_for_test(@aptos_framework);
        timestamp::set_time_has_started_for_testing(&aptos_framework);
        let arrival_time = 1663074349;
        timestamp::update_global_time_for_test(1663074349 * 1000000);

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
                price_info::new(
                    1663680747,
                    arrival_time,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1"),
                        price::new(i64::new(1557, false), 7, i64::new(5, true), 1663680740),
                        price::new(i64::new(1500, false), 3, i64::new(5, true), 1663680740),
                    ),
                ),
                price_info::new(
                    1663680747,
                    arrival_time,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"3b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe"),
                        price::new(i64::new(1050, false), 3, i64::new(5, true), 1663680745),
                        price::new(i64::new(1483, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
                price_info::new(
                    1663680747,
                    arrival_time,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"33832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d"),
                        price::new(i64::new(1010, false), 2, i64::new(5, true), 1663680745),
                        price::new(i64::new(1511, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
                price_info::new(
                    1663680747,
                    arrival_time,
                    price_feed::new(
                        price_identifier::from_byte_vec(x"21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db8"),
                        price::new(i64::new(1739, false), 1, i64::new(5, true), 1663680745),
                        price::new(i64::new(1508, false), 3, i64::new(5, true), 1663680745),
                    ),
                ),
            ],
        };

        let deserialized = deserialize(bytes);

        assert!(&expected == &deserialized, 1);
        destroy(expected);
        destroy(deserialized);
    }
}
