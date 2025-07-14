use alloc::vec::Vec;
use stylus_sdk::alloy_primitives::{keccak256, FixedBytes, B256, I32, I64, U16, U256, U64};
use stylus_sdk::{
    prelude::*,
    storage::{StorageFixedBytes, StorageI32, StorageI64, StorageKey, StorageU16, StorageU64},
};

fn serialize_data_source_to_bytes(chain_id: u16, emitter_address: &[u8; 32]) -> [u8; 34] {
    let mut result = [0u8; 34];
    result[0..2].copy_from_slice(&chain_id.to_be_bytes());
    result[2..].copy_from_slice(emitter_address);
    result
}

#[derive(Debug)]
#[storage]
pub struct DataSourceStorage {
    pub chain_id: StorageU16,
    pub emitter_address: StorageFixedBytes<32>,
}

impl Erase for DataSourceStorage {
    fn erase(&mut self) {
        self.chain_id.erase();
        self.emitter_address.erase();
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DataSource {
    pub chain_id: U16,
    pub emitter_address: FixedBytes<32>,
}

impl StorageKey for DataSource {
    fn to_slot(&self, root: B256) -> U256 {
        let chain_id: u16 = self.chain_id.to::<u16>();
        let emitter_address: [u8; 32] = self.emitter_address.as_slice().try_into().unwrap();

        let bytes = serialize_data_source_to_bytes(chain_id, &emitter_address);

        keccak256(bytes).to_slot(root)
    }
}
#[storage]
pub struct PriceFeedStorage {
    pub price_id: StorageFixedBytes<32>,
    pub publish_time: StorageU64,
    pub expo: StorageI32,
    pub price: StorageI64,
    pub conf: StorageU64,
    pub ema_price: StorageI64,
    pub ema_conf: StorageU64,
}

// Addressing nit -- running into some versioning issues that preclude me
// from returning the PriceFeed struct directly. Need to figure that out.

// pub struct PriceFeed {
//     pub publish_time: U64,
//     pub expo: I32,
//     pub price: I64,
//     pub conf: U64,
//     pub ema_price: I64,
//     pub ema_conf: U64,
// }

pub type PriceFeedReturn = (FixedBytes<32>, U64, I32, I64, U64, I64, U64);

// (price, conf, expo, publish_time)
pub type PriceReturn = (I64, U64, I32, U64);

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::alloy_primitives::{FixedBytes, U16};

    #[test]
    fn test_data_source_serialization_compatibility() {
        let chain_id = 1u16;
        let emitter_address = [1u8; 32];

        let _data_source = DataSource {
            chain_id: U16::from(chain_id),
            emitter_address: FixedBytes::from(emitter_address),
        };

        let mut expected_bytes = [0u8; 34];
        expected_bytes[0..2].copy_from_slice(&chain_id.to_be_bytes());
        expected_bytes[2..].copy_from_slice(&emitter_address);

        let actual_bytes = serialize_data_source_to_bytes(chain_id, &emitter_address);

        assert_eq!(
            actual_bytes, expected_bytes,
            "Serialization should produce identical bytes"
        );
    }
}
