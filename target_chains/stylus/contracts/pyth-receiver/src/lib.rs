// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

mod error;
mod governance;
mod governance_structs;
#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod pyth_governance_test;
mod structs;
#[cfg(test)]
mod test_data;

#[cfg(test)]
use mock_instant::global::MockClock;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, FixedBytes, I32, I64, U16, U256, U32, U64},
    alloy_sol_types::sol,
    call::Call,
    prelude::*,
    storage::{
        StorageAddress, StorageBool, StorageFixedBytes, StorageMap, StorageU16, StorageU256,
        StorageUint, StorageVec,
    },
};

use error::PythReceiverError;
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
use structs::{DataSource, DataSourceStorage, PriceFeedReturn, PriceFeedStorage, PriceReturn};
use wormhole_vaas::{Readable, Vaa, Writeable};

sol! {
    event FeeSet(uint256 indexed old_fee, uint256 indexed new_fee);
    event TransactionFeeSet(uint256 indexed old_fee, uint256 indexed new_fee);
    event FeeWithdrawn(address indexed target_address, uint256 fee_amount);
    event ValidPeriodSet(uint256 indexed old_valid_period, uint256 indexed new_valid_period);
    event DataSourcesSet(bytes32[] old_data_sources, bytes32[] new_data_sources);
    event GovernanceDataSourceSet(uint16 old_chain_id, bytes32 old_emitter_address, uint16 new_chain_id, bytes32 new_emitter_address, uint64 initial_sequence);
}

sol_interface! {
    interface IWormholeContract  {
    function initialize(address[] memory initial_guardians, uint32 initial_guardian_set_index, uint16 chain_id, uint16 governance_chain_id, address governance_contract) external;
    function getGuardianSet(uint32 index) external view returns (uint8[] memory);
    function parseAndVerifyVm(uint8[] memory encoded_vaa) external view returns (uint8[] memory);
    function quorum(uint32 num_guardians) external pure returns (uint32);
    function chainId() external view returns (uint16);
}
}

#[storage]
#[entrypoint]
pub struct PythReceiver {
    pub wormhole: StorageAddress,
    pub valid_data_sources: StorageVec<DataSourceStorage>,
    pub is_valid_data_source: StorageMap<DataSource, StorageBool>,
    pub single_update_fee_in_wei: StorageU256,
    pub valid_time_period_seconds: StorageU256,
    pub governance_data_source_chain_id: StorageU16,
    pub governance_data_source_emitter_address: StorageFixedBytes<32>,
    pub last_executed_governance_sequence: StorageUint<64, 1>,
    pub governance_data_source_index: StorageUint<32, 1>,
    pub latest_price_info: StorageMap<FixedBytes<32>, PriceFeedStorage>,
    pub transaction_fee_in_wei: StorageU256,
    pub initialized: StorageBool,
}

#[public]
impl PythReceiver {
    pub fn initialize(
        &mut self,
        wormhole: Address,
        single_update_fee_in_wei: U256,
        valid_time_period_seconds: U256,
        data_source_emitter_chain_ids: Vec<u16>,
        data_source_emitter_addresses: Vec<[u8; 32]>,
        governance_emitter_chain_id: u16,
        governance_emitter_address: [u8; 32],
        governance_initial_sequence: u64,
    ) -> Result<(), PythReceiverError> {
        if self.initialized.get() {
            return Err(PythReceiverError::AlreadyInitialized.into());
        }
        self.wormhole.set(wormhole);
        self.single_update_fee_in_wei.set(single_update_fee_in_wei);
        self.valid_time_period_seconds
            .set(valid_time_period_seconds);

        self.governance_data_source_chain_id
            .set(U16::from(governance_emitter_chain_id));
        self.governance_data_source_emitter_address
            .set(FixedBytes::<32>::from(governance_emitter_address));

        self.last_executed_governance_sequence
            .set(U64::from(governance_initial_sequence));
        self.governance_data_source_index.set(U32::ZERO);

        for (i, chain_id) in data_source_emitter_chain_ids.iter().enumerate() {
            let emitter_address = FixedBytes::<32>::from(data_source_emitter_addresses[i]);

            let mut data_source = self.valid_data_sources.grow();
            data_source.chain_id.set(U16::from(*chain_id));
            data_source.emitter_address.set(emitter_address);

            let data_source_key = DataSource {
                chain_id: U16::from(*chain_id),
                emitter_address: emitter_address,
            };

            self.is_valid_data_source.setter(data_source_key).set(true);
        }
        self.initialized.set(true);
        Ok(())
    }

    pub fn price_feed_exists(&self, id: [u8; 32]) -> bool {
        let id_fb = FixedBytes::<32>::from(id);
        let price_info = self.latest_price_info.get(id_fb);
        return price_info.publish_time.get() != U64::ZERO;
    }

    pub fn query_price_feed(&self, id: [u8; 32]) -> Result<PriceFeedReturn, PythReceiverError> {
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

    pub fn get_price_unsafe(&self, id: [u8; 32]) -> Result<PriceReturn, PythReceiverError> {
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

    pub fn get_price_no_older_than(
        &self,
        id: [u8; 32],
        age: u64,
    ) -> Result<PriceReturn, PythReceiverError> {
        let price_info = self.get_price_unsafe(id)?;
        if !self.is_no_older_than(price_info.3, age) {
            return Err(PythReceiverError::NewPriceUnavailable);
        }
        Ok(price_info)
    }

    pub fn get_ema_price_unsafe(&self, id: [u8; 32]) -> Result<PriceReturn, PythReceiverError> {
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

    pub fn get_ema_price_no_older_than(
        &self,
        id: [u8; 32],
        age: u64,
    ) -> Result<PriceReturn, PythReceiverError> {
        let price_info = self.get_ema_price_unsafe(id)?;
        if !self.is_no_older_than(price_info.3, age) {
            return Err(PythReceiverError::NewPriceUnavailable);
        }
        Ok(price_info)
    }

    #[payable]
    pub fn update_price_feeds(
        &mut self,
        update_data: Vec<Vec<u8>>,
    ) -> Result<(), PythReceiverError> {
        let total_fee = self.get_update_fee(update_data.clone())?;

        let value = self.vm().msg_value();

        if value < total_fee {
            return Err(PythReceiverError::InsufficientFee);
        }

        for data in &update_data {
            self.update_price_feeds_internal(data.clone(), 0, 0, false)?;
        }
        Ok(())
    }

    pub fn update_price_feeds_if_necessary(
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

    fn latest_price_info_publish_time(&self, price_id: [u8; 32]) -> u64 {
        let price_id_fb: FixedBytes<32> = FixedBytes::from(price_id);
        let recent_price_info = self.latest_price_info.get(price_id_fb);
        recent_price_info.publish_time.get().to::<u64>()
    }

    fn update_price_feeds_internal(
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

    fn get_update_fee(&self, update_data: Vec<Vec<u8>>) -> Result<U256, PythReceiverError> {
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

    pub fn get_twap_update_fee(&self, _update_data: Vec<Vec<u8>>) -> U256 {
        U256::from(0u8)
    }

    pub fn parse_price_feed_updates(
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

    pub fn parse_price_feed_updates_with_config(
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
                all_parsed_price_feeds.extend(self.update_price_feeds_internal(
                    data.clone(),
                    min_allowed_publish_time,
                    max_allowed_publish_time,
                    check_uniqueness,
                )?);
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

    fn parse_price_feed_updates_internal(
        &mut self,
        update_data: Vec<u8>,
        min_allowed_publish_time: u64,
        max_allowed_publish_time: u64,
        check_uniqueness: bool,
    ) -> Result<Vec<PriceFeedReturn>, PythReceiverError> {
        // Check the first 4 bytes of the update_data_array for the magic header
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

    pub fn parse_twap_price_feed_updates(
        &mut self,
        _update_data: Vec<Vec<u8>>,
        _price_ids: Vec<[u8; 32]>,
    ) -> Vec<PriceFeedReturn> {
        Vec::new()
    }

    pub fn parse_price_feed_updates_unique(
        &mut self,
        update_data: Vec<Vec<u8>>,
        price_ids: Vec<[u8; 32]>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<PriceFeedReturn>, PythReceiverError> {
        let price_feeds = self.parse_price_feed_updates_with_config(
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

    pub fn execute_governance_instruction(
        &mut self,
        data: Vec<u8>,
    ) -> Result<(), PythReceiverError> {
        self.execute_governance_instruction_internal(data)
    }

    fn is_no_older_than(&self, publish_time: U64, max_age: u64) -> bool {
        self.get_current_timestamp()
            .saturating_sub(publish_time.to::<u64>())
            <= max_age
    }

    // Stylus doesn't provide a way to mock up the testing timestamp
    // so at the moment I'm using the testing trait to let me test old timestamps
    fn get_current_timestamp(&self) -> u64 {
        #[cfg(test)]
        {
            MockClock::time().as_secs()
        }
        #[cfg(not(test))]
        {
            self.vm().block_timestamp()
        }
    }
}

fn parse_wormhole_proof(vaa: Vaa) -> Result<MerkleRoot<Keccak160>, PythReceiverError> {
    let message = WormholeMessage::try_from_bytes(vaa.body.payload.to_vec())
        .map_err(|_| PythReceiverError::PriceUnavailable)?;
    let root: MerkleRoot<Keccak160> = MerkleRoot::new(match message.payload {
        WormholePayload::Merkle(merkle_root) => merkle_root.root,
    });
    Ok(root)
}
