use crate::error::PythReceiverError;
use crate::structs::{DataSource, PriceFeedReturn, PriceReturn};
use crate::PythReceiver;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{FixedBytes, I32, I64, U16, U256, U64},
    call::Call,
    prelude::*,
};
use pythnet_sdk::{
    accumulators::merkle::{MerklePath, MerkleRoot},
    hashers::keccak256_160::Keccak160,
    messages::Message,
    wire::{
        from_slice,
        v1::{
            AccumulatorUpdateData, Proof, WormholeMessage, WormholePayload,
            PYTHNET_ACCUMULATOR_UPDATE_MAGIC,
        },
    },
};
use wormhole_vaas::{Readable, Vaa, Writeable};

use crate::IWormholeContract;

impl PythReceiver {
    pub(crate) fn price_feed_exists_internal(&self, id: [u8; 32]) -> bool {
        let id_fb = FixedBytes::<32>::from(id);
        let price_info = self.latest_price_info.get(id_fb);
        return price_info.publish_time.get() != U64::ZERO;
    }

    pub(crate) fn query_price_feed_internal(&self, id: [u8; 32]) -> Result<PriceFeedReturn, PythReceiverError> {
        let id_fb = FixedBytes::<32>::from(id);

        let price_info = self.latest_price_info.get(id_fb);

        if price_info.publish_time.get() == U64::ZERO {
            return Err(PythReceiverError::PriceFeedNotFound);
        }

        Ok((
            id_fb,
            price_info.publish_time.get(),
            price_info.expo.get(),
            price_info.price.get(),
            price_info.conf.get(),
            price_info.ema_price.get(),
            price_info.ema_conf.get(),
        ))
    }

    pub(crate) fn get_price_unsafe_internal(&self, id: [u8; 32]) -> Result<PriceReturn, PythReceiverError> {
        let id_fb = FixedBytes::<32>::from(id);

        let price_info = self.latest_price_info.get(id_fb);

        if price_info.publish_time.get() == U64::ZERO {
            return Err(PythReceiverError::PriceUnavailable);
        }

        Ok((
            price_info.price.get(),
            price_info.conf.get(),
            price_info.expo.get(),
            price_info.publish_time.get(),
        ))
    }

    pub(crate) fn get_price_no_older_than_internal(
        &self,
        id: [u8; 32],
        age: u64,
    ) -> Result<PriceReturn, PythReceiverError> {
        let price_info = self.get_price_unsafe_internal(id)?;
        if !self.is_no_older_than(price_info.3, age) {
            return Err(PythReceiverError::NewPriceUnavailable);
        }
        Ok(price_info)
    }

    pub(crate) fn get_ema_price_unsafe_internal(&self, id: [u8; 32]) -> Result<PriceReturn, PythReceiverError> {
        let id_fb = FixedBytes::<32>::from(id);
        let price_info = self.latest_price_info.get(id_fb);

        if price_info.publish_time.get() == U64::ZERO {
            return Err(PythReceiverError::PriceUnavailable);
        }

        Ok((
            price_info.ema_price.get(),
            price_info.ema_conf.get(),
            price_info.expo.get(),
            price_info.publish_time.get(),
        ))
    }

    pub(crate) fn get_ema_price_no_older_than_internal(
        &self,
        id: [u8; 32],
        age: u64,
    ) -> Result<PriceReturn, PythReceiverError> {
        let price_info = self.get_ema_price_unsafe_internal(id)?;
        if !self.is_no_older_than(price_info.3, age) {
            return Err(PythReceiverError::NewPriceUnavailable);
        }
        Ok(price_info)
    }

    pub(crate) fn update_price_feeds_internal(
        &mut self,
        update_data: Vec<Vec<u8>>,
    ) -> Result<(), PythReceiverError> {
        for data in &update_data {
            self.parse_price_feed_updates_wrapper_internal(data.clone(), 0, 0, false)?;
        }

        let total_fee = self.get_update_fee(update_data)?;

        let value = self.vm().msg_value();

        if value < total_fee {
            return Err(PythReceiverError::InsufficientFee);
        }
        Ok(())
    }

    pub(crate) fn update_price_feeds_if_necessary_internal(
        &mut self,
        update_data: Vec<Vec<u8>>,
        price_ids: Vec<[u8; 32]>,
        publish_times: Vec<u64>,
    ) -> Result<(), PythReceiverError> {
        if (price_ids.len() != publish_times.len())
            || (price_ids.is_empty() && publish_times.is_empty())
        {
            return Err(PythReceiverError::InvalidUpdateData);
        }

        for i in 0..price_ids.len() {
            if self.latest_price_info_publish_time(price_ids[i]) < publish_times[i] {
                self.update_price_feeds(update_data.clone())?;
                return Ok(());
            }
        }

        return Err(PythReceiverError::NoFreshUpdate);
    }

    pub(crate) fn latest_price_info_publish_time(&self, price_id: [u8; 32]) -> u64 {
        let price_id_fb: FixedBytes<32> = FixedBytes::from(price_id);
        let recent_price_info = self.latest_price_info.get(price_id_fb);
        recent_price_info.publish_time.get().to::<u64>()
    }

    pub(crate) fn parse_price_feed_updates_wrapper_internal(
        &mut self,
        update_data: Vec<u8>,
        min_publish_time: u64,
        max_publish_time: u64,
        unique: bool,
    ) -> Result<Vec<PriceFeedReturn>, PythReceiverError> {
        let price_pairs = self.parse_price_feed_updates_internal(
            update_data,
            min_publish_time,
            max_publish_time,
            unique,
        )?;

        for price_return in &price_pairs {
            let price_id_fb: FixedBytes<32> = FixedBytes::from(price_return.0);
            let mut recent_price_info = self.latest_price_info.setter(price_id_fb);

            if recent_price_info.publish_time.get() < price_return.1
                || recent_price_info.price.get() == I64::ZERO
            {
                recent_price_info
                    .price_id
                    .set(FixedBytes::from(price_return.0));
                recent_price_info.publish_time.set(price_return.1);
                recent_price_info.expo.set(price_return.2);
                recent_price_info.price.set(price_return.3);
                recent_price_info.conf.set(price_return.4);
                recent_price_info.ema_price.set(price_return.5);
                recent_price_info.ema_conf.set(price_return.6);
            }
        }

        Ok(price_pairs)
    }

    pub(crate) fn get_update_fee_internal(&self, update_data: Vec<Vec<u8>>) -> Result<U256, PythReceiverError> {
        let mut total_num_updates: u64 = 0;
        for data in &update_data {
            let update_data_array: &[u8] = &data;
            let accumulator_update = AccumulatorUpdateData::try_from_slice(&update_data_array)
                .map_err(|_| PythReceiverError::InvalidAccumulatorMessage)?;
            match accumulator_update.proof {
                Proof::WormholeMerkle { vaa: _, updates } => {
                    let num_updates = u64::try_from(updates.len())
                        .map_err(|_| PythReceiverError::TooManyUpdates)?;
                    total_num_updates += num_updates;
                }
            }
        }
        Ok(
            U256::from(total_num_updates).saturating_mul(self.single_update_fee_in_wei.get())
                + self.transaction_fee_in_wei.get(),
        )
    }

    pub(crate) fn get_twap_update_fee_internal(&self, _update_data: Vec<Vec<u8>>) -> U256 {
        U256::from(0u8)
    }

    pub(crate) fn parse_price_feed_updates_internal_wrapper(
        &mut self,
        update_data: Vec<u8>,
        price_ids: Vec<[u8; 32]>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<PriceFeedReturn>, PythReceiverError> {
        let price_feeds = self.parse_price_feed_updates_with_config(
            vec![update_data],
            price_ids,
            min_publish_time,
            max_publish_time,
            false,
            false,
            false,
        );
        price_feeds
    }

    pub(crate) fn parse_price_feed_updates_with_config_internal(
        &mut self,
        update_data: Vec<Vec<u8>>,
        price_ids: Vec<[u8; 32]>,
        min_allowed_publish_time: u64,
        max_allowed_publish_time: u64,
        check_uniqueness: bool,
        check_update_data_is_minimal: bool,
        store_updates_if_fresh: bool,
    ) -> Result<Vec<PriceFeedReturn>, PythReceiverError> {
        let mut all_parsed_price_feeds = Vec::new();
        for data in &update_data {
            if store_updates_if_fresh {
                all_parsed_price_feeds.extend(self.parse_price_feed_updates_internal(
                    data.clone(),
                    min_allowed_publish_time,
                    max_allowed_publish_time,
                    check_uniqueness,
                )?);
                if store_updates_if_fresh {
                    self.update_price_feeds_internal(vec![data.clone()])?;
                }
            } else {
                all_parsed_price_feeds.extend(self.parse_price_feed_updates_internal(
                    data.clone(),
                    min_allowed_publish_time,
                    max_allowed_publish_time,
                    check_uniqueness,
                )?);
            }
        }

        if check_update_data_is_minimal && all_parsed_price_feeds.len() != price_ids.len() {
            return Err(PythReceiverError::InvalidUpdateData);
        }

        let mut result: Vec<PriceFeedReturn> = Vec::with_capacity(price_ids.len());

        for price_id in price_ids {
            if let Some(price_info) = all_parsed_price_feeds
                .iter()
                .find(|feed| feed.0 == price_id)
            {
                result.push(price_info.clone());
            } else {
                return Err(PythReceiverError::PriceFeedNotFoundWithinRange);
            }
        }

        Ok(result)
    }

    pub(crate) fn parse_price_feed_updates_internal(
        &mut self,
        update_data: Vec<u8>,
        min_allowed_publish_time: u64,
        max_allowed_publish_time: u64,
        check_uniqueness: bool,
    ) -> Result<Vec<PriceFeedReturn>, PythReceiverError> {
        let update_data_array: &[u8] = &update_data;
        if update_data_array.len() < 4 {
            return Err(PythReceiverError::InvalidUpdateData);
        }

        let mut header = [0u8; 4];
        header.copy_from_slice(&update_data_array[0..4]);

        if &header != PYTHNET_ACCUMULATOR_UPDATE_MAGIC {
            return Err(PythReceiverError::InvalidAccumulatorMessage);
        }

        let accumulator_update = AccumulatorUpdateData::try_from_slice(&update_data_array)
            .map_err(|_| PythReceiverError::InvalidAccumulatorMessage)?;

        let mut price_feeds = Vec::new();

        match accumulator_update.proof {
            Proof::WormholeMerkle { vaa, updates } => {
                let wormhole: IWormholeContract = IWormholeContract::new(self.wormhole.get());
                let config = Call::new();
                wormhole
                    .parse_and_verify_vm(config, Vec::from(vaa.clone()))
                    .map_err(|_| PythReceiverError::InvalidWormholeMessage)?;

                let vaa_obj = Vaa::read(&mut Vec::from(vaa.clone()).as_slice())
                    .map_err(|_| PythReceiverError::VaaVerificationFailed)?;

                let cur_emitter_address: &[u8; 32] = vaa_obj
                    .body
                    .emitter_address
                    .as_slice()
                    .try_into()
                    .map_err(|_| PythReceiverError::InvalidEmitterAddress)?;

                let cur_data_source = DataSource {
                    chain_id: U16::from(vaa_obj.body.emitter_chain),
                    emitter_address: FixedBytes::from(cur_emitter_address),
                };

                if !self.is_valid_data_source.get(cur_data_source) {
                    return Err(PythReceiverError::InvalidWormholeMessage);
                }

                let root_digest: MerkleRoot<Keccak160> = parse_wormhole_proof(vaa_obj)?;

                for update in updates {
                    let message_vec = Vec::from(update.message);
                    let proof: MerklePath<Keccak160> = update.proof;

                    if !root_digest.check(proof, &message_vec) {
                        return Err(PythReceiverError::InvalidMerkleProof);
                    }

                    let msg = from_slice::<byteorder::BE, Message>(&message_vec)
                        .map_err(|_| PythReceiverError::InvalidAccumulatorMessage)?;

                    match msg {
                        Message::PriceFeedMessage(price_feed_message) => {
                            let publish_time = price_feed_message.publish_time;

                            if (min_allowed_publish_time > 0
                                && publish_time < min_allowed_publish_time as i64)
                                || (max_allowed_publish_time > 0
                                    && publish_time > max_allowed_publish_time as i64)
                            {
                                return Err(PythReceiverError::PriceFeedNotFoundWithinRange);
                            }

                            let price_id_fb = FixedBytes::<32>::from(price_feed_message.feed_id);

                            if check_uniqueness {
                                let prev_price_info = self.latest_price_info.get(price_id_fb);
                                let prev_publish_time =
                                    prev_price_info.publish_time.get().to::<u64>();

                                if prev_publish_time > 0
                                    && min_allowed_publish_time <= prev_publish_time
                                {
                                    return Err(PythReceiverError::PriceFeedNotFoundWithinRange);
                                }
                            }

                            let expo = I32::try_from(price_feed_message.exponent)
                                .map_err(|_| PythReceiverError::InvalidUpdateData)?;
                            let price = I64::try_from(price_feed_message.price)
                                .map_err(|_| PythReceiverError::InvalidUpdateData)?;
                            let ema_price = I64::try_from(price_feed_message.ema_price)
                                .map_err(|_| PythReceiverError::InvalidUpdateData)?;

                            let price_info_return = (
                                price_id_fb,
                                U64::from(publish_time),
                                expo,
                                price,
                                U64::from(price_feed_message.conf),
                                ema_price,
                                U64::from(price_feed_message.ema_conf),
                            );

                            price_feeds.push(price_info_return);
                        }
                        _ => {
                            return Err(PythReceiverError::InvalidAccumulatorMessageType);
                        }
                    }
                }
            }
        };

        Ok(price_feeds)
    }

    pub(crate) fn parse_twap_price_feed_updates_internal(
        &mut self,
        _update_data: Vec<Vec<u8>>,
        _price_ids: Vec<[u8; 32]>,
    ) -> Vec<PriceFeedReturn> {
        Vec::new()
    }

    pub(crate) fn parse_price_feed_updates_unique_internal(
        &mut self,
        update_data: Vec<Vec<u8>>,
        price_ids: Vec<[u8; 32]>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<PriceFeedReturn>, PythReceiverError> {
        let price_feeds = self.parse_price_feed_updates_with_config_internal(
            update_data,
            price_ids,
            min_publish_time,
            max_publish_time,
            true,
            false,
            false,
        );
        price_feeds
    }
}

impl PythReceiver {
}

pub(crate) fn parse_wormhole_proof(vaa: Vaa) -> Result<MerkleRoot<Keccak160>, PythReceiverError> {
    let message = WormholeMessage::try_from_bytes(vaa.body.payload.to_vec())
        .map_err(|_| PythReceiverError::PriceUnavailable)?;
    let root: MerkleRoot<Keccak160> = MerkleRoot::new(match message.payload {
        WormholePayload::Merkle(merkle_root) => merkle_root.root,
    });
    Ok(root)
}
