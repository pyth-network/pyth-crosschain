use super::GetPriceUnsafeError;
use pyth::byte_array::ByteArray;

#[starknet::interface]
pub trait IPyth<T> {
    fn get_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn get_ema_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn set_data_sources(ref self: T, sources: Array<DataSource>);
    fn set_fee(ref self: T, single_update_fee: u256);
    fn update_price_feeds(ref self: T, data: ByteArray);
    fn execute_governance_instruction(ref self: T, data: ByteArray);
}

#[derive(Drop, Debug, Clone, Copy, PartialEq, Hash, Default, Serde, starknet::Store)]
pub struct DataSource {
    pub emitter_chain_id: u16,
    pub emitter_address: u256,
}

#[derive(Drop, Clone, Serde)]
pub struct Price {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}
