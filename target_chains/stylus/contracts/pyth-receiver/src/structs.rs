use alloc::{boxed::Box, format, vec::Vec};
use pythnet_sdk::wire::to_vec;
use serde::Serialize;
use stylus_sdk::alloy_primitives::{keccak256, FixedBytes, B256, I32, I64, U16, U256, U64};
use stylus_sdk::{
    prelude::*,
    storage::{StorageFixedBytes, StorageI32, StorageI64, StorageKey, StorageU16, StorageU64},
};

#[derive(Serialize)]
struct SerializableDataSource {
    chain_id: u16,
    #[serde(with = "pythnet_sdk::wire::array")]
    emitter_address: [u8; 32],
}

fn serialize_data_source_to_bytes(
    chain_id: u16,
    emitter_address: &[u8; 32],
) -> Result<[u8; 34], Box<dyn core::error::Error>> {
    let data_source = SerializableDataSource {
        chain_id,
        emitter_address: *emitter_address,
    };

    let bytes = to_vec::<_, byteorder::BE>(&data_source)?;
    if bytes.len() != 34 {
        return Err(format!("Expected 34 bytes, got {}", bytes.len()).into());
    }

    let mut result = [0u8; 34];
    result.copy_from_slice(&bytes);
    Ok(result)
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

// impl StorageKey for DataSourceStorage {
//     fn to_slot(&self, root: B256) -> U256 {
//         let chain_id: u16 = self.chain_id.get().to::<u16>();
//         let emitter_address = self.emitter_address.get();

//         let bytes = serialize_data_source_to_bytes(chain_id, emitter_address.as_slice().try_into().unwrap())
//             .expect("Failed to serialize DataSource");

//         keccak256(bytes).to_slot(root)
//     }
// }

impl StorageKey for DataSource {
    fn to_slot(&self, root: B256) -> U256 {
        let chain_id: u16 = self.chain_id.to::<u16>();
        let emitter_address: [u8; 32] = self.emitter_address.as_slice().try_into().unwrap();

        let bytes = serialize_data_source_to_bytes(chain_id, &emitter_address)
            .expect("Failed to serialize DataSource");

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

// PriceInfo struct storing price information - keeping as tuple for ABI compatibility
pub type PriceInfo = (U64, I32, I64, U64, I64, U64);

impl PriceInfoStorage {
    pub fn to_price_info(&self) -> PriceInfo {
        (
            self.publish_time.get(),
            self.expo.get(),
            self.price.get(),
            self.conf.get(),
            self.ema_price.get(),
            self.ema_conf.get(),
        )
    }
}


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

        let actual_bytes = serialize_data_source_to_bytes(chain_id, &emitter_address)
            .expect("Serialization should succeed");

        assert_eq!(
            actual_bytes, expected_bytes,
            "Serialization should produce identical bytes"
        );
    }
}
