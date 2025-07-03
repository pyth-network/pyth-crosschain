// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

mod structs;
mod error;
#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod test_data;

use alloc::vec::Vec;
use stylus_sdk::{alloy_primitives::{U16, U32, U256, U64, I32, I64, FixedBytes, Address},
                prelude::*,
                storage::{StorageAddress, StorageVec, StorageMap, StorageUint, StorageBool, StorageU256, StorageU16, StorageFixedBytes},
                call::Call};

use structs::{PriceInfoReturn, PriceInfoStorage, DataSourceStorage, DataSource};
use error::{PythReceiverError};
use pythnet_sdk::{wire::{from_slice, v1::{
            AccumulatorUpdateData, Proof,
            PYTHNET_ACCUMULATOR_UPDATE_MAGIC,
            WormholeMessage, WormholePayload,
        },
    },
    accumulators::{merkle::{MerklePath, MerkleRoot}},
    hashers::keccak256_160::Keccak160,
    messages::Message
};
use wormhole_vaas::{Readable, Vaa, Writeable};

const ACCUMULATOR_WORMHOLE_MAGIC: u32 = 0x41555756;

sol_interface! {
    interface IWormholeContract {
        function initialize(address[] memory initial_guardians, uint16 chain_id, uint16 governance_chain_id, address governance_contract) external;
        function getGuardianSet(uint32 index) external view returns (uint8[] memory);
        function parseAndVerifyVm(uint8[] memory encoded_vaa) external view returns (uint8[] memory);
        function quorum(uint32 num_guardians) external pure returns (uint32);
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
    pub latest_price_info: StorageMap<FixedBytes<32>, PriceInfoStorage>,
    pub transaction_fee_in_wei: StorageU256,
}

#[public]
impl PythReceiver {
    pub fn initialize(&mut self, wormhole: Address, single_update_fee_in_wei: U256, valid_time_period_seconds: U256,
                            data_source_emitter_chain_ids: Vec<u16>, data_source_emitter_addresses: Vec<[u8; 32]>,
                            governance_emitter_chain_id: u16, governance_emitter_address: [u8; 32],
                            governance_initial_sequence: u64, _data: Vec<u8>) {
        self.wormhole.set(wormhole);
        self.single_update_fee_in_wei.set(single_update_fee_in_wei);
        self.valid_time_period_seconds.set(valid_time_period_seconds);

        self.governance_data_source_chain_id.set(U16::from(governance_emitter_chain_id));
        self.governance_data_source_emitter_address.set(FixedBytes::<32>::from(governance_emitter_address));

        // Initialize other fields
        self.last_executed_governance_sequence.set(U64::from(governance_initial_sequence));
        self.governance_data_source_index.set(U32::ZERO);

        for (i, chain_id) in data_source_emitter_chain_ids.iter().enumerate() {
            let emitter_address = FixedBytes::<32>::from(data_source_emitter_addresses[i]);

            // Create a new data source storage slot
            let mut data_source = self.valid_data_sources.grow();
            data_source.chain_id.set(U16::from(*chain_id));
            data_source.emitter_address.set(emitter_address);

            let data_source_key = DataSource {
                chain_id: U16::from(*chain_id),
                emitter_address: emitter_address,
            };


            self.is_valid_data_source
                .setter(data_source_key)
                .set(true);
        }
    }

    pub fn get_price_unsafe(&self, id: [u8; 32]) -> Result<PriceInfoReturn, PythReceiverError> {
        let id_fb = FixedBytes::<32>::from(id);

        let price_info = self.latest_price_info.get(id_fb);

        if price_info.publish_time.get() == U64::ZERO {
            return Err(PythReceiverError::PriceUnavailable);
        }

        Ok((
            price_info.publish_time.get(),
            price_info.expo.get(),
            price_info.price.get(),
            price_info.conf.get(),
            price_info.ema_price.get(),
            price_info.ema_conf.get(),
        ))
    }

    pub fn get_price_no_older_than(&self, id: [u8; 32], age: u64) -> Result<PriceInfoReturn, PythReceiverError> {
        let price_info = self.get_price_unsafe(id)?;
        if !self.is_no_older_than(price_info.0, age) {
            return Err(PythReceiverError::NewPriceUnavailable);
        }
        Ok(price_info)
    }

    pub fn get_ema_price_unsafe(&self, id: [u8; 32]) -> Result<PriceInfoReturn, PythReceiverError> {
        let id_fb = FixedBytes::<32>::from(id);
        let price_info = self.latest_price_info.get(id_fb);

        if price_info.publish_time.get() == U64::ZERO {
            return Err(PythReceiverError::PriceUnavailable);
        }

        Ok((
            price_info.publish_time.get(),
            price_info.expo.get(),
            price_info.ema_price.get(),
            price_info.ema_conf.get(),
            price_info.ema_price.get(),
            price_info.ema_conf.get(),
        ))
    }

    pub fn get_ema_price_no_older_than(&self, id: [u8; 32], age: u64) -> Result<PriceInfoReturn, PythReceiverError> {
        let price_info = self.get_ema_price_unsafe(id)?;
        if !self.is_no_older_than(price_info.0, age) {
            return Err(PythReceiverError::NewPriceUnavailable);
        }
        Ok(price_info)
    }

    pub fn update_price_feeds(&mut self, update_data: Vec<u8>) -> Result<(), PythReceiverError> {
        self.update_price_feeds_internal(update_data)?;
        Ok(())
    }

    // pub fn update_price_feeds_if_necessary(
    //     &mut self,
    //     _update_data: Vec<Vec<u8>>,
    //     _price_ids: Vec<[u8; 32]>,
    //     _publish_times: Vec<u64>,
    // ) {
    //     // dummy implementation
    // }


    // fn update_price_feeds_internal(&mut self, update_data: Vec<u8>, price_ids: Vec<Address>, min_publish_time: u64, max_publish_time: u64, unique: bool) -> Result<(), PythReceiverError> {
    fn update_price_feeds_internal(&mut self, update_data: Vec<u8>) -> Result<(), PythReceiverError> {
        let update_data_array: &[u8] = &update_data;
        // Check the first 4 bytes of the update_data_array for the magic header
        if update_data_array.len() < 4 {
            return Err(PythReceiverError::InvalidUpdateData);
        }

        let mut header = [0u8; 4];
        header.copy_from_slice(&update_data_array[0..4]);

        if &header != PYTHNET_ACCUMULATOR_UPDATE_MAGIC {
            return Err(PythReceiverError::InvalidAccumulatorMessage);
        }

        let update_data = AccumulatorUpdateData::try_from_slice(&update_data_array).unwrap();

        match update_data.proof {
            Proof::WormholeMerkle { vaa, updates } => {
                let wormhole: IWormholeContract = IWormholeContract::new(self.wormhole.get());
                let config = Call::new();
                wormhole.parse_and_verify_vm(config, Vec::from(vaa.clone())).map_err(|_| PythReceiverError::InvalidWormholeMessage).unwrap();
                
                let vaa = Vaa::read(&mut Vec::from(vaa.clone()).as_slice()).unwrap();

                let cur_emitter_address: &[u8; 32] = vaa.body.emitter_address.as_slice().try_into().expect("emitter address must be 32 bytes");

                let cur_data_source = DataSource {
                    chain_id: U16::from(vaa.body.emitter_chain),
                    emitter_address: FixedBytes::from(cur_emitter_address),
                };

                if !self.is_valid_data_source.get(cur_data_source) {
                    return Err(PythReceiverError::InvalidWormholeMessage);
                }

                let root_digest: MerkleRoot<Keccak160> = parse_wormhole_proof(vaa).unwrap();

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
                            let price_id_fb : FixedBytes<32> = FixedBytes::from(price_feed_message.feed_id);
                            let mut recent_price_info = self.latest_price_info.setter(price_id_fb);

                            if recent_price_info.publish_time.get() < U64::from(price_feed_message.publish_time)
                                || recent_price_info.price.get() == I64::ZERO {
                                recent_price_info.publish_time.set(U64::from(price_feed_message.publish_time));
                                recent_price_info.price.set(I64::from_le_bytes(price_feed_message.price.to_le_bytes()));
                                recent_price_info.conf.set(U64::from(price_feed_message.conf));
                                recent_price_info.expo.set(I32::from_le_bytes(price_feed_message.exponent.to_le_bytes()));
                                recent_price_info.ema_price.set(I64::from_le_bytes(price_feed_message.ema_price.to_le_bytes()));
                                recent_price_info.ema_conf.set(U64::from(price_feed_message.ema_conf));
                            }


                        },
                        _ => {
                            return Err(PythReceiverError::InvalidAccumulatorMessageType);
                        },
                    }
                }
            }
        };

        Ok(())
    }

    // pub fn get_update_fee(&self, _update_data: Vec<Vec<u8>>) -> U256 {
    //     U256::from(0u8)
    // }

    // pub fn get_twap_update_fee(&self, _update_data: Vec<Vec<u8>>) -> U256 {
    //     U256::from(0u8)
    // }

    // pub fn parse_price_feed_updates(
    //     &mut self,
    //     _update_data: Vec<Vec<u8>>,
    //     _price_ids: Vec<[u8; 32]>,
    //     _min_publish_time: u64,
    //     _max_publish_time: u64,
    // ) -> Vec<PriceInfoReturn> {
    //     Vec::new()
    // }

    // pub fn parse_price_feed_updates_with_config(
    //     &mut self,
    //     _update_data: Vec<Vec<u8>>,
    //     _price_ids: Vec<[u8; 32]>,
    //     _min_allowed_publish_time: u64,
    //     _max_allowed_publish_time: u64,
    //     _check_uniqueness: bool,
    //     _check_update_data_is_minimal: bool,
    //     _store_updates_if_fresh: bool,
    // ) -> (Vec<PriceInfoReturn>, Vec<u64>) {
    //     (Vec::new(), Vec::new())
    // }

    // pub fn parse_twap_price_feed_updates(
    //     &mut self,
    //     _update_data: Vec<Vec<u8>>,
    //     _price_ids: Vec<[u8; 32]>,
    // ) -> Vec<PriceInfoReturn> {
    //     Vec::new()
    // }

    // pub fn parse_price_feed_updates_unique(
    //     &mut self,
    //     _update_data: Vec<Vec<u8>>,
    //     _price_ids: Vec<[u8; 32]>,
    //     _min_publish_time: u64,
    //     _max_publish_time: u64,
    // ) -> Vec<PriceInfoReturn> {
    //     Vec::new()
    // }

    #[inline]
    fn is_no_older_than(&self, publish_time: U64, max_age: u64) -> bool {
        self.vm().block_timestamp().saturating_sub(publish_time.to::<u64>()) <= max_age
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