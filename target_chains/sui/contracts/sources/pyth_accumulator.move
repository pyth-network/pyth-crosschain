module pyth::accumulator {
    use std::vector::{Self};
    use sui::clock::{Clock, Self};
    use wormhole::bytes20::{Self, Bytes20};
    use wormhole::cursor::{Cursor};
    use pyth::deserialize::{Self};
    use pyth::price_status::{Self};
    use pyth::price_identifier::{Self};
    use pyth::price_info::{Self, PriceInfo};
    use pyth::price_feed::{Self};
    use pyth::merkle_tree::{Self};

    const PRICE_FEED_MESSAGE_TYPE: u64 = 0;
    const E_INVALID_UPDATE_DATA: u64 = 245;
    const E_INVALID_PROOF: u64 = 345;

    fun parse_price_feed_message(cur: &mut Cursor<u8>, clock: &Clock): PriceInfo {

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

    // parse_and_verify_accumulator_updates takes as input a merkle root and cursor over the encoded update message (containing encoded
    // leafs and merkle proofs), iterates over each leaf/proof pair and verifies it is part of the tree, and finally outputs the set of
    // decoded and authenticated PriceInfos.
    fun parse_and_verify_accumulator_updates(cursor: &mut Cursor<u8>, merkle_root: &vector<u8>, clock: &Clock): vector<PriceInfo> {
        let update_size = deserialize::deserialize_u8(cursor);
        let price_info_updates: vector<PriceInfo> = vector[];
        while (update_size > 0) {
            let message_size = deserialize::deserialize_u16(cursor);
            let message = deserialize::deserialize_vector(cursor, (message_size as u64)); //should be safe to go from u16 to u16
            let price_info = parse_price_feed_message(cursor, clock);
            vector::push_back(&mut price_info_updates, price_info);
            let path_size = deserialize::deserialize_u8(cursor);
            let merkle_path: vector<Bytes20> = vector[];
            while (path_size > 0) {
                let hash_bytes = deserialize::deserialize_vector(cursor, 20); // 20 is number of bytes in a keccak hash
                vector::push_back(&mut merkle_path, bytes20::new(hash_bytes));
                path_size = path_size - 1;
            };
            assert!(merkle_tree::isValidProof(&merkle_path, merkle_root, message), E_INVALID_PROOF);
            update_size = update_size - 1;
        };
        price_info_updates
    }

}