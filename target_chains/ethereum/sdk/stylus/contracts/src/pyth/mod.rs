use crate::pyth::errors::{IPythError, PriceFeedNotFound, StalePrice};
use crate::pyth::solidity::{
    getEmaPriceUnsafeCall,
    getPriceUnsafeCall,
    updatePriceFeedsCall,
    StoragePriceFeed,
    StoragePrice
};
use crate::utils::helpers::{call_helper,delegate_call_helper, CALL_RETDATA_DECODING_ERROR_MESSAGE};
use alloc::vec::Vec;
use core::borrow::BorrowMut; 
use stylus_sdk::{console,prelude::*,storage::{TopLevelStorage, StorageAddress, StorageMap},alloy_sol_types::sol};
use alloy_primitives::{ FixedBytes,U256, Bytes, Address };

pub mod errors;
pub mod events;
//pub mod ipyth;
pub mod solidity;
pub mod mock;

#[storage]
pub struct PythContract {
    _ipyth:StorageAddress,
    price_feeds:StorageMap<FixedBytes<32>,StoragePriceFeed>,
}

type  Price = StoragePrice;
type  PriceFeed = StoragePriceFeed;

 pub fn get_ema_price_unsafe(
        storage: &mut impl TopLevelStorage,
        pyth_address: Address,
        id: FixedBytes<32>,
    ) -> Result<(), Vec<u8>> {
        let get_call = call_helper::<getEmaPriceUnsafeCall>(storage, pyth_address, (id,))?;
        console!("{:?}",get_call);
        // Ok(());
       // let price =  Price::abi_decode(&get_call, false).map_err(|_| CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec());
        // Ok(price)

        Ok(())
    }



impl PythContract {
    // pub fn price_feed_exists(self, id: FixedBytes<32>) -> bool {
    //     self.price_feeds.getter(id).id.is_empty()
    // }


    // pub fn query_price_feed(self, id: FixedBytes<32>) -> Result<PriceFeed, Vec<u8>> {
    //     let price_found = self.price_feeds.getter(id).to_price_feed();
    //     if price_found.id.is_empty() {
    //         return  Err(IPythError::PriceFeedNotFound(PriceFeedNotFound {}).into());
    //     }
    //     Ok(price_found)
    // }

    // pub fn get_price_unsafe<S: TopLevelStorage + BorrowMut<Self>>(
    //     self,
    //     storage: &mut S,
    //     id: FixedBytes<32>,
    // ) -> Result<Price, Vec<u8>> {
    //     let price = call_helper::<getPriceUnsafeCall>(storage, self._ipyth.get(), (id,)).unwrap();
    //     Ok(price)
    // }

    // pub fn get_price_no_older_than<S: TopLevelStorage + BorrowMut<Self>>(
    //     self,
    //     storage: &mut S,
    //     id: FixedBytes<32>,
    //     age: U256,
    // ) -> Result<Price, Vec<u8>> {
    //     let price = self.get_ema_price_unsafe(storage, id)?;
    //     if Self::_diff(U256::from(block::timestamp()), price.publish_time) > age {
    //         return Err(IPythError::StalePrice(StalePrice {}).into());
    //     }
    //     Ok(price)
    // }

    pub fn get_ema_price_unsafe<S: TopLevelStorage + BorrowMut<Self>>(
        self,
        storage: &mut S,
        id: FixedBytes<32>,
    ) -> Result<(), Vec<u8>> {
        let get_call = call_helper::<getEmaPriceUnsafeCall>(storage, self._ipyth.get(), (id,))?;
        console!("{:?}",get_call);
       // let price =  Price::abi_decode(&get_call, false).map_err(|_| CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec());
        // Ok(price)

        Ok(())
    }

    // pub fn get_ema_price_no_older_than<S: TopLevelStorage + BorrowMut<Self>>(
    //     self,
    //     storage: &mut S,
    //     id: FixedBytes<32>,
    //     age: U256,
    // ) -> Result<StoragePrice, Vec<u8>> {
    //     let price =
    //         call_helper::<getEmaPriceUnsafeCall>(storage, self._ipyth.get(), (id,));
        
    //     if Self::_diff(U256::from(block::timestamp()), price.publish_time) > age {
    //         return Err(IPythError::StalePrice(StalePrice {}).into());
    //     }
    //     Ok(price)
    // }


    // fn _update_price_feeds_if_necessary<S: TopLevelStorage + BorrowMut<Self>>(
    //     self,
    //     storage: &mut S,
    //     update_data:Vec<Bytes>,
    //     price_ids: Vec<FixedBytes<32>>,
    //     publish_times: Vec<u64>
    // ) -> Result<(), Vec<u8>> {
    //     if update_data.len() != publish_times.len() {
    //         return  Err(IPythError::InvalidArgument(InvalidArgument{}).into());
    //     }
    //     //let item = self;
    //     //for i in 0..price_ids.len() {
    //     // let mut i = 0;
    //     // loop {
    //     //  self._check_valid_price_feed(price_ids[i]);
    //     //  self._check_valid_query(price_ids[i], publish_times[i]);
    //     // }
    //         // {
                
    //         //}
    
    // //    }
    //     return Err(IPythError::NoFreshUpdate(NoFreshUpdate{}).into());
    // }

  

    // pub fn update_price_feeds<S: TopLevelStorage + BorrowMut<Self>>(
    //     self,
    //     storage: &mut S,
    //     update_data: Vec<Bytes>,
    // ) -> Result<(), Vec<u8>> {
    //     //update_data = SolBytes::from(update_data.into());
    //     delegate_call_helper::<updatePriceFeedsCall>(storage, self._ipyth.get(), (update_data,))?;
    //     Ok(())
    // }

}

impl PythContract {
      fn _diff(x: U256, y: U256) -> U256 {
        if x > y {
            return x - y;
        }
        y - x
    }

    fn _check_valid_query(
        self,   
        price_id: FixedBytes<32>,
        publish_time: u64
    ) -> bool {
        true
       // return Self::query_price_feed(self,price_id).unwrap().price.publish_time < U256::from(publish_time);
    }

    fn _check_valid_price_feed(
        self,   
        price_id: FixedBytes<32>,
    ) -> bool {
        return  self.price_feeds.getter(price_id).id.is_empty()
    }
}



