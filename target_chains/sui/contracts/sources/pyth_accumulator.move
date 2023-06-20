module pyth::accumulator {
    use std::vector::{Self};
    use sui::hash::{keccak256};
    use wormhole::bytes::{Self};
    use wormhole::bytes20::{Self, Bytes20, data};
    use wormhole::cursor::{Self, Cursor};
    use pyth::deserialize::{Self};

    const PRICE_FEED_MESSAGE_TYPE: u64 = 0;
    const E_INVALID_UPDATE_DATA: u64 = 245;

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

    // extractPriceInfoFromMerkleProof decodes the next price info
    // from an encoded accumulator update and returns a (PriceInfo, priceId) pair
    fun extract_price_info_from_merkle_proof(
        digest: Bytes20,
        cursor: Cursor<u8>,
    ): (PriceInfo, Bytes32) {
            //bytes calldata encodedMessage;
            let messageSize: u16 = cursor::deserialize_u16(cursor);
            let encodedMessage: vector<u8> = cursor::deserialize_vector(cursor, messageSize);

            // check if encoded message is a valid update (part of the merkle tree)
            let valid: bool = isProofValid(
                encoded,
                digest, // root
                encodedMessage // leaf
            );
            if (!valid) {
                abort E_INVALID_UPDATE_DATA
            };

            // parse encoded message
            let encodedMessageCursor = cursor::new(encodedMessage);
            let messageType = cursor::deserialize_u8(encodedMessageCursor);

            if (messageType != PRICE_FEED_MESSAGE_TYPE) {
                (priceInfo, priceId) = parse_price_feed_message(encodedMessageCursor, 1);
            } else {
                abort E_INVALID_UPDATE_DATA
            };

            return (priceInfo, priceId);
        }
    }

    fun extractPriceInfosFromAccumulatorUpdate(
        accumulatorUpdate: vector<u8>
    ) internal returns (uint8 numUpdates) {
        (
            uint encodedOffset,
            UpdateType updateType
        ) = extractUpdateTypeFromAccumulatorHeader(accumulatorUpdate);

        if (updateType != UpdateType.WormholeMerkle) {
            revert PythErrors.InvalidUpdateData();
        }

        uint offset;
        bytes20 digest;
        bytes calldata encoded;
        (
            offset,
            digest,
            numUpdates,
            encoded
        ) = extractWormholeMerkleHeaderDigestAndNumUpdatesAndEncodedFromAccumulatorUpdate(
            accumulatorUpdate,
            encodedOffset
        );

        unchecked {
            for (uint i = 0; i < numUpdates; i++) {
                PythInternalStructs.PriceInfo memory priceInfo;
                bytes32 priceId;
                (offset, priceInfo, priceId) = extractPriceInfoFromMerkleProof(
                    digest,
                    encoded,
                    offset
                );
                uint64 latestPublishTime = latestPriceInfoPublishTime(priceId);
                if (priceInfo.publishTime > latestPublishTime) {
                    setLatestPriceInfo(priceId, priceInfo);
                    emit PriceFeedUpdate(
                        priceId,
                        priceInfo.publishTime,
                        priceInfo.price,
                        priceInfo.conf
                    );
                }
            }
        }
        if (offset != encoded.length) revert PythErrors.InvalidUpdateData();
    }
}

}