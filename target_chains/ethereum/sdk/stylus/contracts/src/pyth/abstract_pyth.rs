use stylus_sdk::{block, prelude::*, storage::TopLevelStorage};
use crate::{pyth::solidity::{
    getEmaPriceUnsafeCall, getPriceUnsafeCall, Price,PriceFeed, updatePriceFeedsCall,
    StoragePriceFeed
}, utils::helpers::delegate_call_helper};

use alloc::vec::Vec;
use alloy_primitives::{Bytes, FixedBytes, U256, U64};
use crate::utils::helpers::call_helper;
use core::borrow::BorrowMut;
use super::errors::{IPythError, InvalidArgument, NoFreshUpdate, PriceFeedNotFound, StalePrice};



sol_storage! {
    pub struct  AbstractPyth {
        address _ipyth;
        mapping(bytes32 => StoragePriceFeed) price_feeds;
    }
}


impl AbstractPyth {
     fn _query_price_feed( 
        self,
        id:FixedBytes<32>
    )->Result<PriceFeed, Vec<u8>>{
      let price_found = self.price_feeds.getter(id).to_price_feed();
      if price_found.id.is_empty() {
         return  Err(IPythError::PriceFeedNotFound(PriceFeedNotFound{}).into());
      }
      else {
        return  Ok(price_found);
      }
    }

    fn _get_price_unsafe<S: TopLevelStorage + BorrowMut<Self>>( 
        self,
        storage: &mut S,
        id:FixedBytes<32>
    )->Result<Price, Vec<u8>> {
      let (price,) =  call_helper::<getPriceUnsafeCall>(storage, self._ipyth.get(), (id,))?.into();
      Ok(price)
    }

    fn _get_price_no_older_than<S: TopLevelStorage + BorrowMut<Self>>(
        self, 
        storage: &mut S,
        id:FixedBytes<32>,
        age:U256
    ) -> Result<Price, Vec<u8>>{
      let price = self._get_ema_price_unsafe(storage, id)?;
       if Self::_diff(U256::from(block::timestamp()), price.publishTime) > age {
            return  Err(IPythError::StalePrice( StalePrice{}).into());
       }
      Ok(price)
    }

    fn  _get_ema_price_unsafe<S: TopLevelStorage + BorrowMut<Self>>(
        self, 
        storage: &mut S,
        id:FixedBytes<32>,
    ) -> Result<Price, Vec<u8>>{
      let (price,) =   call_helper::<getEmaPriceUnsafeCall>(storage, self._ipyth.get(),(id,))?.into();
      Ok(price)
    }

    fn _get_ema_price_no_older_than<S: TopLevelStorage + BorrowMut<Self>>(
        self, 
        storage: &mut S,
        id:FixedBytes<32>,
        age:U256
    ) -> Result<Price, Vec<u8>>{
      let (price,) =   call_helper::<getEmaPriceUnsafeCall>(storage, self._ipyth.get(),(id,))?.into();
      if Self::_diff(U256::from(block::timestamp()), price.publishTime) > age {
            return  Err(IPythError::StalePrice(StalePrice{}).into());
      }
      Ok(price)
    }


    fn _update_price_feeds_if_necessary<S: TopLevelStorage + BorrowMut<Self>>(
        self, 
        storage: &mut S,
        update_data:Vec<Bytes>,
        price_ids: Vec<FixedBytes<32>>,
        publish_times: Vec<U64>
    ) -> Result<(), Vec<u8>> {
        if update_data.len() != publish_times.len() {
            return  Err(IPythError::InvalidArgument(InvalidArgument{}).into());
        }

        // for i in 0..price_ids.len() {
        //     // if 
        //     //     !priceFeedExists(priceIds[i]) ||
        //     //     queryPriceFeed(priceIds[i]).price.publishTime < publishTimes[i]
        //     //  {
        //     //     updatePriceFeeds(updateData);
        //     //     return;
        //     }
            
        // }
        return Err(IPythError::NoFreshUpdate(NoFreshUpdate{}).into());
    }

    fn _update_price_feeds<S: TopLevelStorage + BorrowMut<Self>>(
        self, 
        storage: &mut S,
        update_data:Vec<Bytes>,
        
    )-> Result<(), Vec<u8>>{
     delegate_call_helper::<updatePriceFeedsCall>(storage, self._ipyth.get(), (update_data,))?;
     Ok(())
    }

    fn _diff(x:U256, y:U256) -> U256 {
        if x > y {
            return  x -y ;
        }
        return y - x ;
    }

}