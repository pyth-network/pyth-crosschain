use crate::pyth::types::{
    getEmaPriceUnsafeCall,
    getEmaPriceNoOlderThanCall,
    getPriceUnsafeCall,
    getValidTimePeriodCall,
    getUpdateFeeCall,
    getPriceNoOlderThanCall,
    parsePriceFeedUpdatesCall,
    parsePriceFeedUpdatesUniqueCall,
    updatePriceFeedsIfNecessaryCall,
    updatePriceFeedsCall,
    Price,
    PriceFeed
};
use crate::utils::helpers::{call_helper, delegate_call_helper, static_call_helper};
use alloc::vec::Vec;
use stylus_sdk::storage::TopLevelStorage;
use alloy_primitives::{ Address, FixedBytes, U256, Bytes};
use crate::pyth::mock::DecodeDataType;
use alloy_sol_types::SolType;

pub fn get_price_no_older_than(storage: &mut impl TopLevelStorage,pyth_address: Address,id: FixedBytes<32>, age:U256) -> Result<Price, Vec<u8>> {
        let price_call = call_helper::<getPriceNoOlderThanCall>(storage, pyth_address, (id,age,),)?;
        Ok(price_call.price)
}

pub fn get_update_fee(storage: &mut impl TopLevelStorage,pyth_address: Address,update_data:Vec<Bytes>) -> Result<U256, Vec<u8>> {
        let update_fee_call = call_helper::<getUpdateFeeCall>(storage, pyth_address, (update_data,))?;
        Ok(update_fee_call.feeAmount)
}

pub fn get_ema_price_unsafe(storage: &mut impl TopLevelStorage,pyth_address: Address,id: FixedBytes<32>) -> Result<Price, Vec<u8>> {
        let ema_price = call_helper::<getEmaPriceUnsafeCall>(storage, pyth_address, (id,))?;
        Ok(ema_price.price)
}


pub fn get_ema_price_no_older_than(storage: &mut impl TopLevelStorage,pyth_address: Address,id: FixedBytes<32>, age:U256) -> Result<Price, Vec<u8>> {
        let ema_price = call_helper::<getEmaPriceNoOlderThanCall>(storage, pyth_address, (id,age,))?;
        Ok(ema_price.price)
}

pub fn get_price_unsafe(storage: &mut impl TopLevelStorage,pyth_address: Address,id: FixedBytes<32>) -> Result<Price, Vec<u8>> { 
        let price = call_helper::<getPriceUnsafeCall>(storage, pyth_address, (id,))?;
        let price = Price{price: price._0, conf: price._1, expo: price._2, publish_time: price._3};
        Ok(price)
}

pub fn get_valid_time_period(storage: &mut impl TopLevelStorage,pyth_address: Address) -> Result<U256, Vec<u8>> {
        let valid_time_period = call_helper::<getValidTimePeriodCall>(storage, pyth_address, ())?;
        Ok(valid_time_period.validTimePeriod)
}

pub fn update_price_feeds(storage: &mut impl TopLevelStorage,pyth_address: Address,update_data:Vec<Bytes>) -> Result<(), Vec<u8>> {
        delegate_call_helper::<updatePriceFeedsCall>(storage, pyth_address, (update_data,))?;
        Ok(())
}

pub fn update_price_feeds_if_necessary(storage: &mut impl TopLevelStorage,pyth_address: Address,update_data:Vec<Bytes>, price_ids: Vec<FixedBytes<32>>, publish_times: Vec<u64>) -> Result<(), Vec<u8>> {
        delegate_call_helper::<updatePriceFeedsIfNecessaryCall>(storage, pyth_address, (update_data,price_ids, publish_times))?;
        Ok(())
}
   
pub fn parse_price_feed_updates(storage: &mut impl TopLevelStorage,pyth_address: Address,update_data:Vec<Bytes>, price_ids: Vec<FixedBytes<32>>, min_publish_time:u64, max_publish_time:u64) -> Result<Vec<PriceFeed>, Vec<u8>> {
        let parse_price_feed_updates_call = delegate_call_helper::<parsePriceFeedUpdatesCall>(storage, pyth_address, (update_data,price_ids, min_publish_time, max_publish_time))?;
        Ok(parse_price_feed_updates_call.priceFeeds)
}   

pub fn parse_price_feed_updates_unique(storage: &mut impl TopLevelStorage,pyth_address: Address,update_data:Vec<Bytes>, price_ids: Vec<FixedBytes<32>>, min_publish_time:u64, max_publish_time:u64) -> Result<Vec<PriceFeed>, Vec<u8>> {
        let parse_price_feed_updates_call = delegate_call_helper::<parsePriceFeedUpdatesUniqueCall>(storage, pyth_address, (update_data,price_ids, min_publish_time, max_publish_time))?;
        Ok(parse_price_feed_updates_call.priceFeeds)
}
/// Create Price Feed 
pub fn create_price_feed_update_data(
        id:FixedBytes<32>,
        price:i64,
        conf:u64,
        expo:i32,
        ema_price:i64,
        ema_conf:u64,
        publish_time:U256,
        prev_publish_time:u64
    ) -> Vec<u8> {
        let price = Price { price: price, conf, expo, publish_time };
        let ema_price = Price { price:ema_price, conf:ema_conf, expo:expo,publish_time};
        
        let price_feed_data = PriceFeed {
          id,price,ema_price
        };
        
        let price_feed_data_encoding = (price_feed_data, prev_publish_time);
        return  DecodeDataType::abi_encode(&price_feed_data_encoding);
    }