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
            magic: magic,
            header_size: (header_size as u64),
            version_minor: (version_minor as u64),
            version_major: (version_major as u64),
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
            price_infos: price_infos,
        }
    }

    fun deserialize_price_info(cur: &mut Cursor<u8>, clock: &Clock): PriceInfo {

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
        // If not, use the the last known trading price.
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
    fun deserialize_big_boi(){
        use sui::test_scenario::{Self, ctx};
        use std::debug::print;
        let test = test_scenario::begin(@0x1234);
        let test_clock = clock::create_for_testing(ctx(&mut test));
        //let big_boi = x"01000000030d00d4a69597805c8617eb56600f75d16f520e24325e92f0ebeed05ed3d601ff2506600a2878c39711cfd5051020355a9c2994ec2fc8186eae93da29018d12ee027501022f99f23540b0f47bebcf8a2b7c313563f5cae4855f372488b8068db6f63c2b71246b9b8c2357e816456ada54e1bece0a32436fe6ae1cea573a2e8a7eb67903950004aa00bf027e25f4d67ae40d4a4297c05ed71ec2586ad17d5f20570a4e99bdd09a3e30311c7eee0eab95b927e9d95eb70a859eea63f65bc19ccfb1aa53a62122e60006f94f93147f0d76207e22f1551861f2bd0bb142761ad16aa2327f9bd8f39127687ab7c519d66d9e4a804bc9c5f2e3f30e2f0d1524eea610180c7a9d34c8b67de7010832e05e84252ac22fb6052e98e38c0d348999f791bf5ac3eb7851eb3f197350ff2be56b6068b237b30b1657c9f51a23a23f545eba85fa6e54dbaa2be1631b832e00090e4628db223a99a43ff1d4679dfc6d6624391a7e1e0cfac46efd8921b0336f2f5b27a26878d3417d241b365990e8f8ec3c1f7ddcbd8354927638a8ef10256e62000abfc78c279adf7fa679623886a0916b83f975f82747cc64b72c52644c9fb7d85b45e997fa1cd09f123ce4595489f33fe4c6e2f0b4510e4f4bcbf3a7405a3bed87000bfe2c8209ac6a3ff74bb2840be5e79fae8a309110d590b4404b666a3234a033a3397d782f383d80da550b2518999a8d0bd41c9116b26e66a689d36df74f436719000cc1f8132cead9b99678334f25834a729b125b4da8454bf0b69e94bcd727eb5e4937fac072b1d7b9fdc8508ef90fccaef3dc79712d2a4f42487eec08609684e991000d396ec58fbce7ebdef33a6f5c17937288b120fde7e81033ea7b901397665c8f705eccd3abfe83777680a5b5b68ccec2d39b799302fc8ee580d620b5116bd4d5da000e776bd626b1ca9a2aa266b6ebacbbd4ac74fe5864a6967742274dd8c0c64cd7c817708fdb3d4d0ab63d978cb27f0027107e98321cd6c94b3f99ba82664508c6910010de0d54b7dedb02c28d117ef847d955b34477801b9e634cd2b81e23b07db8c56d7c78ba25faecffe3161df762dbeaf07fda0a1cb72f824366a96d7e12bc1231c20012c27efff6899d12f45bd0fe693b326df217f5a80e095588de507e666e132219986288b439a5da0b3b1364072c80e61a1842c5d4d4bf254f4eea7a0aa4451468a70063d0247c00000000001af8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0000000000d4049e70150325748000300000001020005009504028fba493a357ecde648d51375a445ce1cb9681da1ea11e562b53522a5d3877f981f906d7cfe93f618804f1de89e0199ead306edc022d3230b3e8305f391b00000002507abf5a00000000010657010fffffff800000024ed52cbe80000000013f4ea6c0100000006000000090000000063d0247c0000000063d0247c0000000063d0247c0000002507abf5a00000000010657010e6c020c1a15366b779a8c870e065023657c88c82b82d58a9fe856896a4034b0415ecddd26d49e1a8f1de9376ebebc03916ede873447c1255d2d5891b92ce571700000025cf2045140000000008738554fffffff800000025c34012100000000005f9658a0100000004000000060000000063d0247c0000000063d0247c0000000063d0247c00000025cfa161d00000000008f4a210c67940be40e0cc7ffaa1acb08ee3fab30955a197da1ec297ab133d4d43d86ee6ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace00000025c393b3cf000000000262c30ffffffff800000025aa547278000000000319bf6d01000000120000001a0000000063d0247c0000000063d0247c0000000063d0247c00000025c3cc833000000000026dcbb08d7c0971128e8a4764e757dedb32243ed799571706af3a68ab6a75479ea524ff846ae1bdb6300b817cee5fdee2a6da192775030db5615b94a465f53bd40850b50000001bf6337f9e0000000216934e1efffffff80000001bdd26cac000000000a5a4dee00000000003000000060000000063d0247c0000000063d0247c0000000063a2ccab0000001bf6337f9e0000000216934e1e543b71a4c292744d3fcf814a2ccda6f7c00f283d457f83aa73c41e9defae034ba0255134973f4fdf2f8f7808354274a3b1ebc6ee438be898d045e8b56ba1fe1300000000000000000000000000000000fffffff8000000000000000000000000000000000000000001000000070000000063d0247c0000000063d0247c000000000000000000000000000000000000000000000000";
        let big_boi = x"5032574800030000000102000400951436e0be37536be96f0896366089506a59763d036728332d3e3038047851aea7c6c75c89f14810ec1c54c03ab8f1864a4c4032791f05747f560faec380a695d1000000000000049a0000000000000008fffffffb00000000000005dc0000000000000003000000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000006150000000000000007215258d81468614f6b7e194c5d145609394f67b041e93e6695dcc616faadd0603b9551a68d01d954d6387aff4df1529027ffb2fee413082e509feb29cc4904fe000000000000041a0000000000000003fffffffb00000000000005cb0000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e4000000000000048600000000000000078ac9cf3ab299af710d735163726fdae0db8465280502eb9f801f74b3c1bd190333832fad6e36eb05a8972fe5f219b27b5b2bb2230a79ce79beb4c5c5e7ecc76d00000000000003f20000000000000002fffffffb00000000000005e70000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e40000000000000685000000000000000861db714e9ff987b6fedf00d01f9fea6db7c30632d6fc83b7bc9459d7192bc44a21a28b4c6619968bd8c20e95b0aaed7df2187fd310275347e0376a2cd7427db800000000000006cb0000000000000001fffffffb00000000000005e40000000000000003010000000100000001000000006329c0eb000000006329c0e9000000006329c0e400000000000007970000000000000001";
        let parsed = destroy(deserialize(big_boi, &test_clock));
        print(&parsed);
        clock::destroy_for_testing(test_clock);
        test_scenario::end(test);
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
