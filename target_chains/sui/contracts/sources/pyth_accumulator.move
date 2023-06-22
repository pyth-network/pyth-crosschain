module pyth::accumulator {
    use std::vector::{Self};
    use std::debug::print;
    use sui::clock::{Clock, Self};
    use wormhole::bytes20::{Self, Bytes20};
    use wormhole::cursor::{Self, Cursor};
    use wormhole::vaa::{Self};
    use wormhole::state::{State as WormState};
    use pyth::deserialize::{Self};
    //use pyth::price_status::{Self};
    use pyth::price_identifier::{Self};
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_feed::{Self};
    use pyth::merkle_tree::{Self};
    #[test_only]
    use pyth::pyth_tests::{Self};

    const PRICE_FEED_MESSAGE_TYPE: u64 = 0;
    const E_INVALID_UPDATE_DATA: u64 = 245;
    const E_INVALID_PROOF: u64 = 345;
    const E_INVALID_WORMHOLE_MESSAGE: u64 = 454;
    const E_INVALID_ACCUMULATOR_PAYLOAD: u64 = 554;


    const PYTHNET_ACCUMULATOR_UPDATE_MAGIC: u64 = 1347305813;
    const ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC: u32 = 1096111958;

    #[test_only]
    // get_price_feed_updates_from_single_vaa is a test_only function that gets the vector of price info updates
    // from a Wormhole VAA message.
    fun test_get_price_feed_updates_from_single_vaa(vaa: vector<u8>, wormhole_state: &WormState, clock: &Clock): vector<PriceInfo> {
        let cur = cursor::new(vaa);
        let header: u32 = deserialize::deserialize_u32(&mut cur);
        let updates = if ((header as u64) == PYTHNET_ACCUMULATOR_UPDATE_MAGIC) {
            parse_and_verify_accumulator_message(&mut cur, wormhole_state, clock)
        }
        else {
            // don't handle this code path here
            abort 99
        };
        //TODO -  update_cache(updates);
        // cursor should be empty after parsing the header and accumulator message
        cursor::destroy_empty(cur);
        updates
    }

    /// Given a cursor at the beginning of an accumulator message, verifies the validity of the message and the
    /// embedded VAA, parses and verifies the price updates and returns an array of PriceInfo representing the updates
    /// Note: this function is adapted from the Aptos pyth accumulator
     fun parse_and_verify_accumulator_message(cursor: &mut Cursor<u8>, wormhole_state: &WormState, clock: &Clock): vector<PriceInfo> {
        let major = deserialize::deserialize_u8(cursor);
        assert!(major == 1, E_INVALID_ACCUMULATOR_PAYLOAD);
        let _minor = deserialize::deserialize_u8(cursor);

        let trailing_size = deserialize::deserialize_u8(cursor);
        deserialize::deserialize_vector(cursor, (trailing_size as u64));

        let proof_type = deserialize::deserialize_u8(cursor);
        assert!(proof_type == 0, E_INVALID_ACCUMULATOR_PAYLOAD);

        let vaa_size = deserialize::deserialize_u16(cursor);
        let vaa = deserialize::deserialize_vector(cursor, (vaa_size as u64));
        let msg_vaa = vaa::parse_and_verify(wormhole_state, vaa, clock);
        // TODO - verify VAA targets this chain and contract
        //verify_data_source(&msg_vaa);
        let merkle_root_hash = parse_accumulator_merkle_root_from_vaa_payload(vaa::payload(&msg_vaa));
        vaa::destroy(msg_vaa);
        parse_and_verify_accumulator_updates(cursor, merkle_root_hash, clock)
    }

    // parse_accumulator_merkle_root_from_vaa_payload takes in some VAA bytes, verifies that the vaa
    // corresponds to a merkle update, and finally returns the keccak hash of the merkle root.
    // Note: this function is adapted from the Aptos Pyth accumulator
    fun parse_accumulator_merkle_root_from_vaa_payload(message: vector<u8>): Bytes20 {
        let msg_payload_cursor = cursor::new(message);
        let payload_type = deserialize::deserialize_u32(&mut msg_payload_cursor);
        assert!(payload_type == ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC, E_INVALID_WORMHOLE_MESSAGE);
        let wh_message_payload_type = deserialize::deserialize_u8(&mut msg_payload_cursor);
        assert!(wh_message_payload_type == 0, E_INVALID_WORMHOLE_MESSAGE); // Merkle variant
        let _merkle_root_slot = deserialize::deserialize_u64(&mut msg_payload_cursor);
        let _merkle_root_ring_size = deserialize::deserialize_u32(&mut msg_payload_cursor);
        let merkle_root_hash = deserialize::deserialize_vector(&mut msg_payload_cursor, 20);
        cursor::take_rest<u8>(msg_payload_cursor);
        bytes20::new(merkle_root_hash)
    }

    // Note: this parsing function is adapted from the Aptos Pyth parse_price_feed_message function
    fun parse_price_feed_message(message_cur: &mut Cursor<u8>, clock: &Clock): PriceInfo {
        //let message_cur = cursor::new(message);
        let message_type = deserialize::deserialize_u8(message_cur);

        assert!(message_type == 0, 0); // PriceFeedMessage variant
        let price_identifier = price_identifier::from_byte_vec(deserialize::deserialize_vector(message_cur, 32));
        let price = deserialize::deserialize_i64(message_cur);
        let conf = deserialize::deserialize_u64(message_cur);
        let expo = deserialize::deserialize_i32(message_cur);
        let publish_time = deserialize::deserialize_u64(message_cur);
        let _prev_publish_time = deserialize::deserialize_i64(message_cur);
        let ema_price = deserialize::deserialize_i64(message_cur);
        let ema_conf = deserialize::deserialize_u64(message_cur);
        let price_info = price_info::new_price_info(
            clock::timestamp_ms(clock) / 1000, // not used anywhere kept for backward compatibility
            clock::timestamp_ms(clock) / 1000,
            price_feed::new(
                price_identifier,
                pyth::price::new(price, conf, expo, publish_time),
                pyth::price::new(ema_price, ema_conf, expo, publish_time),
            )
        );
        //cursor::rest(message_cur);
        price_info
    }

    // parse_and_verify_accumulator_updates takes as input a merkle root and cursor over the encoded update message (containing encoded
    // leafs and merkle proofs), iterates over each leaf/proof pair and verifies it is part of the tree, and finally outputs the set of
    // decoded and authenticated PriceInfos.
    fun parse_and_verify_accumulator_updates(cursor: &mut Cursor<u8>, merkle_root: Bytes20, clock: &Clock): vector<PriceInfo> {
        let update_size = deserialize::deserialize_u8(cursor);
        let price_info_updates: vector<PriceInfo> = vector[];
        while (update_size > 0) {
            let message_size = deserialize::deserialize_u16(cursor);
            let message = deserialize::deserialize_vector(cursor, (message_size as u64)); //should be safe to go from u16 to u16
            let message_cur = cursor::new(message);
            let price_info = parse_price_feed_message(&mut message_cur, clock);
            cursor::destroy_empty(message_cur);
            vector::push_back(&mut price_info_updates, price_info);

            // isProofValid pops the next merkle proof from the front of cursor and checks if it proves that message is part of the
            // merkle tree defined by merkle_root
            print(&x"1111");
            print(&message);

            let _valid = merkle_tree::isProofValid(cursor, merkle_root, message);
            //assert!(valid==true, E_INVALID_PROOF);
            update_size = update_size - 1;
        };
        price_info_updates
    }

    #[test_only]
    const TEST_ACCUMULATOR_3_MSGS: vector<u8> = x"504e41550100000000a001000000000100d39b55fa311213959f91866d52624f3a9c07350d8956f6d42cfbb037883f31575c494a2f09fea84e4884dc9c244123fd124bc7825cd64d7c11e33ba5cfbdea7e010000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b000000000000000000415557560000000000000000000000000029da4c066b6e03b16a71e77811570dd9e19f258103005500b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf60000000000000064000000000000003200000009000000006491cc747be59f3f377c0d3f000000000000006300000000000000340436992facb15658a7e9f08c4df4848ca80750f61fadcd96993de66b1fe7aef94e29e3bbef8b12db2305a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d950055006e1540171b6c0c960b71a7020d9f60077f6af931a8bbf590da0223dacf75c7af000000000000006500000000000000330000000a000000006491cc7504f8554c3620c3fd0000000000000064000000000000003504171ed10ac4f1eacf3a4951e1da6b119f07c45da5adcd96993de66b1fe7aef94e29e3bbef8b12db2305a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d9500550031ecc21a745e3968a04e9570e4425bc18fa8019c68028196b546d1669c200c68000000000000006600000000000000340000000b000000006491cc76e87d69c7b51242890000000000000065000000000000003604f2ee15ea639b73fa3db9b34a245bdfa015c260c5fe83e4772e0e346613de00e5348158a01bcb27b305a01e2504d9f0c06e7e7cb0cf24116098ca202ac5f6ade2e8f5a12ec006b16d46be1f0228b94d95";
    #[test_only]
    const TEST_ACCUMULATOR_SINGLE_FEED: vector<u8> = x"504e41550100000000a0010000000001005d461ac1dfffa8451edda17e4b28a46c8ae912422b2dc0cb7732828c497778ea27147fb95b4d250651931845e7f3e22c46326716bcf82be2874a9c9ab94b6e42000000000000000000000171f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b0000000000000000004155575600000000000000000000000000da936d73429246d131873a0bab90ad7b416510be01005500b10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf65f958f4883f9d2a8b5b1008d1fa01db95cf4a8c7000000006491cc757be59f3f377c0d3f423a695e81ad1eb504f8554c3620c3fd02f2ee15ea639b73fa3db9b34a245bdfa015c260c5a8a1180177cf30b2c0bebbb1adfe8f7985d051d2";

    #[test]
    fun test_parse_and_verify_accumulator_updates(){
        use std::debug::print;
        use sui::test_scenario::{Self, take_shared, return_shared};
        use sui::transfer::{Self};

        let emitter_address = x"71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b";
        let initial_guardians = vector[x"7E5F4552091A69125d5DfCb7b8C2659029395Bdf"];
        let (scenario, coins, clock) = pyth_tests::setup_test(500, 23, emitter_address, vector[], initial_guardians, 50, 0);
        let worm_state = take_shared<WormState>(&scenario);
        test_scenario::next_tx(&mut scenario, @0x123);

        let _price_info_updates = test_get_price_feed_updates_from_single_vaa(TEST_ACCUMULATOR_3_MSGS, &worm_state, &clock);
        print(&_price_info_updates);

        // clean-up
        transfer::public_transfer(coins, @0x1234);
        clock::destroy_for_testing(clock);
        return_shared(worm_state);
        test_scenario::end(scenario);
    }
}
