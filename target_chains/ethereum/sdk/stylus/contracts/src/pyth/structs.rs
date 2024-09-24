use alloc::vec::Vec;
use alloy_primitives::{ I32, I64, U256};
use stylus_proc::sol_storage;
use stylus_sdk::call::Error;


sol_storage!  {
    pub struct Price {
          // Price
        int64 price;
        // Confidence interval around the price
        uint64 conf;
        // Price exponent
        int32 expo;
        // Unix timestamp describing when the price was published
        uint publish_time;
    }

    pub struct PriceFeed {
        // The price ID.
        bytes32 id;
        // Latest available price
        Price price;
        // Latest available exponentially-weighted moving average price
        Price ema_price;
    }
}

impl Price {
    // pub fn new(&self, price:I64, conf:U64, expp :I32, publish_time:U256) -> Price {
    //   self.conf.set(conf);
    //   self.publish_time.set(publish_time);
    //   return  self.clone();
    // }


    pub fn convert_to_uint(&self) -> Result<U256, Error> {
       if self.price.gt(&I64::ZERO) || self.expo.gt(&I32::ZERO) || self.expo.lt(&I32::MIN)  {
         return  Err(Error::Revert(Vec::new()));
       } 
       //let price_decimal =  self.expo.as_u32();
       return Ok(U256::from(10000000000000000000u128 * self.price.as_u64() as u128))
    }
}