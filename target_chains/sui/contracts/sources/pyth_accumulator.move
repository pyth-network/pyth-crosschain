module pyth::accumulator {
    use std::vector::{Self};
    use sui::clock::{Clock, Self};
    use wormhole::bytes20::{Self, Bytes20};
    use wormhole::cursor::{Self, Cursor};
    use wormhole::vaa::{Self};
    use wormhole::state::{State as WormState};
    use pyth::deserialize::{Self};
    use pyth::price_identifier::{Self};
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_feed::{Self};
    use pyth::merkle_tree::{Self};
    const PRICE_FEED_MESSAGE_TYPE: u64 = 0;
    const E_INVALID_UPDATE_DATA: u64 = 245;
    const E_INVALID_PROOF: u64 = 345;
    const E_INVALID_WORMHOLE_MESSAGE: u64 = 454;
    const E_INVALID_ACCUMULATOR_PAYLOAD: u64 = 554;

    const ACCUMULATOR_UPDATE_WORMHOLE_VERIFICATION_MAGIC: u32 = 1096111958;
    const PYTHNET_ACCUMULATOR_UPDATE_MAGIC: u64 = 1347305813;

    friend pyth::pyth;

    // parse_and_verify_accumulator_message verifies that the price updates encoded in the
    // accumulator message (accessed via cursor) belong to the merkle tree defined by the merkle root encoded in
    // vaa_payload.
    public(friend) fun parse_and_verify_accumulator_message(cursor: &mut Cursor<u8>, vaa_payload: vector<u8>, clock: &Clock): vector<PriceInfo> {
        let major = deserialize::deserialize_u8(cursor);
        assert!(major == 1, E_INVALID_ACCUMULATOR_PAYLOAD);
        let _minor = deserialize::deserialize_u8(cursor);

        let trailing_size = deserialize::deserialize_u8(cursor);
        deserialize::deserialize_vector(cursor, (trailing_size as u64));

        let proof_type = deserialize::deserialize_u8(cursor);
        assert!(proof_type == 0, E_INVALID_ACCUMULATOR_PAYLOAD);

        // Ignore the vaa in the accumulator message because presumably it has already been verified
        // and passed to this function as input.
        let vaa_size = deserialize::deserialize_u16(cursor);
        deserialize::deserialize_vector(cursor, (vaa_size as u64));

        let merkle_root_hash = parse_accumulator_merkle_root_from_vaa_payload(vaa_payload);
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
            assert!(merkle_tree::isProofValid(cursor, merkle_root, message), E_INVALID_PROOF);
            update_size = update_size - 1;
        };
        price_info_updates
    }

    #[test_only]
    public fun test_get_price_feed_updates_from_accumulator(accumulator_message: vector<u8>, wormhole_state: &WormState, clock: &Clock): vector<PriceInfo> {
        let vaa_bytes = parse_vaa_bytes_from_accumulator_message(copy accumulator_message);

        let cur = cursor::new(accumulator_message);
        let header: u32 = deserialize::deserialize_u32(&mut cur);

        if ((header as u64) != PYTHNET_ACCUMULATOR_UPDATE_MAGIC) {
            abort 99
        };

        let verified_vaa = vaa::parse_and_verify(wormhole_state, vaa_bytes, clock);

        // main entry-point
        let price_infos = parse_and_verify_accumulator_message(&mut cur, vaa::take_payload(verified_vaa), clock);

        //TODO -  update_cache(updates);
        // cursor should be empty after parsing the header and accumulator message
        cursor::destroy_empty(cur);
        price_infos
    }

    #[test_only]
    // parse the vaa bytes from an accumulator message
    public fun parse_vaa_bytes_from_accumulator_message(accumulator_message: vector<u8>): vector<u8>{
        let c = cursor::new(accumulator_message);
        let cursor = &mut c;
        let header: u32 = deserialize::deserialize_u32(cursor);

        if ((header as u64) != PYTHNET_ACCUMULATOR_UPDATE_MAGIC) {
            abort 99
        };

        let major = deserialize::deserialize_u8(cursor);
        assert!(major == 1, E_INVALID_ACCUMULATOR_PAYLOAD);
        let _minor = deserialize::deserialize_u8(cursor);

        let trailing_size = deserialize::deserialize_u8(cursor);
        deserialize::deserialize_vector(cursor, (trailing_size as u64));

        let proof_type = deserialize::deserialize_u8(cursor);
        assert!(proof_type == 0, E_INVALID_ACCUMULATOR_PAYLOAD);

        let vaa_size = deserialize::deserialize_u16(cursor);
        let vaa_bytes = deserialize::deserialize_vector(cursor, (vaa_size as u64));
        cursor::take_rest(c);
        vaa_bytes
    }
}
