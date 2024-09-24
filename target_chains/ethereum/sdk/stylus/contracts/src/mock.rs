use stylus_sdk::{alloy_primitives::{U256, FixedBytes},  prelude::*};
use crate::{
    errors::IPythError, 
    ipyth::{AbstractPyth, IPyth},
};
use stylus_proc::storage;
use stylus_sdk::{call::Error, storage::{StorageMap,StorageB32, StorageU256, StorageKey}};



sol_storage! {
    #[entrypoint]
    pub  struct MockPyth {
        mapping(bytes32 => PriceFeed) price_feeds;
        uint single_update_fee_in_wei;
        uint valid_time_period;
        #[borrow]
        AbstractPyth abstract_pyth;
    }       
}

#[public]
#[inherit(AbstractPyth)]
impl  MockPyth  {
    pub fn initialize(&mut self, valid_time_period:U256, single_update_fee_in_wei:U256) {
     self.valid_time_period.set(valid_time_period);
     self.single_update_fee_in_wei.set(single_update_fee_in_wei);
    }

    // pub fn get_price_feed(&self, id:FixedBytes<32>) -> Result<PriceFeed, IPythError> {
    //     return  self::AbstractPyth.query_price_feed(id)
    // }
}