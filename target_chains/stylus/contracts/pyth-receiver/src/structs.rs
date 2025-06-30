use alloc::vec::Vec;
use byteorder::{BigEndian, ByteOrder};
use stylus_sdk::{
    prelude::*,
    storage::{
        StorageU64, StorageI32, StorageI64, StorageU16, StorageFixedBytes, StorageKey
    },
};
use stylus_sdk::alloy_primitives::{U16, FixedBytes,U64, I32, I64, B256, U256, keccak256};
use pythnet_sdk::messages::PriceFeedMessage;

fn serialize_data_source_to_bytes(chain_id: u16, emitter_address: &[u8; 32]) -> [u8; 34] {
    let mut bytes = [0u8; 34];

    BigEndian::write_u16(&mut bytes[0..2], chain_id);
    bytes[2..].copy_from_slice(emitter_address);

    bytes
}

#[derive(Debug)]
#[storage]
pub struct DataSourceStorage {
    pub chain_id: StorageU16,
    pub emitter_address: StorageFixedBytes<32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DataSource {
    pub chain_id: U16,
    pub emitter_address: FixedBytes<32>,
}

impl StorageKey for DataSourceStorage {
    fn to_slot(&self, root: B256) -> U256 {
        let chain_id: u16 = self.chain_id.get().to::<u16>();
        let emitter_address = self.emitter_address.get();

        let bytes = serialize_data_source_to_bytes(chain_id, emitter_address.as_slice().try_into().unwrap());

        keccak256(bytes).to_slot(root)
    }
}

impl StorageKey for DataSource {
    fn to_slot(&self, root: B256) -> U256 {
        let chain_id: u16 = self.chain_id.to::<u16>();
        let emitter_address: [u8; 32] = self.emitter_address.as_slice().try_into().unwrap();

        let bytes = serialize_data_source_to_bytes(chain_id, &emitter_address);

        keccak256(bytes).to_slot(root)
    }
}

// pub trait GetDataSource {
//     fn data_source(&self) -> DataSourceStorage;
// }

// impl GetDataSource for VerifiedVM {
//     fn data_source(&self) -> DataSourceStorage {
//         let mut ds = DataSourceStorage {
//             chain_id: StorageU16::new(storage_key!("chain_id")),
//             emitter_address: StorageFixedBytes::<32>::new(storage_key!("emitter_address")),
//         };
//         ds.chain_id.set(self.emitter_chain_id.into());
//         ds.emitter_address.set(self.emitter_address);
//         ds
//     }
// }

// PriceInfo struct storing price information
#[storage]
pub struct PriceInfoStorage {
    pub publish_time: StorageU64,
    pub expo: StorageI32,
    pub price: StorageI64,
    pub conf: StorageU64,
    pub ema_price: StorageI64,
    pub ema_conf: StorageU64,
}

pub struct PriceInfo {
    pub publish_time: U64,
    pub expo: I32,
    pub price: I64,
    pub conf: U64,
    pub ema_price: I64,
    pub ema_conf: U64,
}

impl From<&PriceFeedMessage> for PriceInfo {
    fn from(price_feed_message: &PriceFeedMessage) -> Self {
        Self {
            publish_time: U64::from(price_feed_message.publish_time),
            expo: I32::from_be_bytes(price_feed_message.exponent.to_be_bytes()),
            price: I64::from_be_bytes(price_feed_message.price.to_be_bytes()),
            conf: U64::from(price_feed_message.conf),
            ema_price: I64::from_be_bytes(price_feed_message.ema_price.to_be_bytes()),
            ema_conf: U64::from(price_feed_message.ema_conf),
        }
    }
}

// PriceInfo struct storing price information
pub type PriceInfoReturn = (U64, I32, I64, U64, I64, U64);

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::alloy_primitives::{U16, FixedBytes, B256, U256};

    #[test]
    fn test_data_source_serialization_compatibility() {
        let chain_id = 1u16;
        let emitter_address = [1u8; 32];

        let data_source = DataSource {
            chain_id: U16::from(chain_id),
            emitter_address: FixedBytes::from(emitter_address),
        };

        let mut expected_bytes = [0u8; 34];
        expected_bytes[0..2].copy_from_slice(&chain_id.to_be_bytes());
        expected_bytes[2..].copy_from_slice(&emitter_address);

        let actual_bytes = serialize_data_source_to_bytes(chain_id, &emitter_address);

        assert_eq!(actual_bytes, expected_bytes, "Serialization should produce identical bytes");
    }
}
