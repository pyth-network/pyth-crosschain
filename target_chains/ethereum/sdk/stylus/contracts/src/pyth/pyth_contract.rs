use alloy_sol_types::SolValue;
use crate::pyth::ipyth::IPyth;
use stylus_sdk::{abi::Bytes as AbiBytes, prelude::*, storage::TopLevelStorage};
use alloc::vec::Vec;
use alloy_primitives::{ FixedBytes, U256 , Bytes };
use crate::pyth::functions::{
    get_price_unsafe,
    get_price_no_older_than,
    get_ema_price_unsafe, 
    get_ema_price_no_older_than, 
    update_price_feeds,
    update_price_feeds_if_necessary,
    get_update_fee,
    parse_price_feed_updates,
    parse_price_feed_updates_unique
};

sol_storage! {
    pub struct PythContract {
         address _ipyth;
    }
}

unsafe impl TopLevelStorage for PythContract {}

#[public]
impl IPyth for PythContract  {

    type Error = Vec<u8>;

    fn get_price_unsafe(&mut self, id: FixedBytes<32>) -> Result<Vec<u8>, Self::Error> {
        let price = get_price_unsafe(self, self._ipyth.get(), id)?;
        let data =  price.abi_encode();
        Ok(data)
    }
   
    fn get_price_no_older_than(&mut self,id: FixedBytes<32>, age: u8) -> Result<Vec<u8>, Self::Error> {
        let price = get_price_no_older_than(self, self._ipyth.get(), id,U256::from(age))?;
        let data =  price.abi_encode();
        Ok(data)
    }

    fn get_ema_price_unsafe(&mut self, id: FixedBytes<32>) -> Result<Vec<u8>, Self::Error> {
        let price = get_ema_price_unsafe(self, self._ipyth.get(), id)?;
        let data =  price.abi_encode();
        Ok(data)
    }

    fn get_ema_price_no_older_than(&mut self, id: FixedBytes<32>, age: u8) -> Result<Vec<u8>, Self::Error> {
        let price = get_ema_price_no_older_than(self, self._ipyth.get(), id,U256::from(age))?;
        let data =  price.abi_encode();
        Ok(data)
    }

    fn get_update_fee(&mut self, update_data: Vec<AbiBytes>) -> Result<U256, Self::Error> {
       let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
       let fee = get_update_fee(self, self._ipyth.get(), data)?;
       Ok(fee)
    }
    
    #[payable]
    fn update_price_feeds(&mut self, update_data: Vec<AbiBytes>) -> Result<(), Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        update_price_feeds(self, self._ipyth.get(),data)
    }
    
    #[payable]
    fn update_price_feeds_if_necessary(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<FixedBytes<32>>,
        publish_times: Vec<u64>,
    ) -> Result<(), Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        update_price_feeds_if_necessary(self, self._ipyth.get(),data,price_ids,publish_times)
    }

    #[payable]
    fn parse_price_feed_updates(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<FixedBytes<32>>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error> {
        let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
        let encode_data=  parse_price_feed_updates(self, self._ipyth.get(), data, price_ids, min_publish_time, max_publish_time)?.abi_encode();
        Ok(encode_data)
    }

    #[payable]
    fn parse_price_feed_updates_unique(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<FixedBytes<32>>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Self::Error> {
       let data = update_data.into_iter().map(|x| Bytes::from(x.0)).collect();
       let encode_data=  parse_price_feed_updates_unique(self, self._ipyth.get(), data, price_ids, min_publish_time, max_publish_time)?.abi_encode();
       Ok(encode_data)
    }
}