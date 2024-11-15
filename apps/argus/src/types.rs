use {
    alloy::{
        primitives::{Address, U256, U64},
        vec::Vec,
    },
    serde::{Deserialize, Serialize},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceUpdateRequest {
    pub provider: Address,
    pub sequence_number: U64,
    pub publish_time: U256,
    pub price_ids: Vec<[u8; 32]>,
    pub callback_gas_limit: U256,
    pub requester: Address,
}

#[derive(Debug, Clone)]
pub struct PriceData {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}

#[derive(Debug, Clone)]
pub struct UpdateBatch {
    pub requests: Vec<PriceUpdateRequest>,
    pub price_data: Vec<PriceData>,
    pub update_data: Vec<Vec<u8>>,
}
