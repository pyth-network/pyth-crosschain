
use alloc::string::ToString;
use alloy_primitives::{hex::encode, Signed, I32, I64, U256, U32, U64};
use alloy_sol_types::SolValue;
use stylus_sdk::{alloy_sol_types::sol, prelude::*, ArbResult,abi::internal::EncodableReturnType};


sol_storage! {
    pub struct StoragePrice {
      // Price
        int64 price;
        // Confidence interval around the price
        uint64 conf;
        // Price exponent
        int32 expo;
        // Unix timestamp describing when the price was published
        uint publish_time;
    }
    
    pub struct StoragePriceFeed {
        bytes32 id;
        StoragePrice price;
        StoragePrice ema_price;
    }
}


sol! {
   #[derive(Debug, Copy)]
   struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint publish_time;
    }

   #[derive(Debug, Copy)]
    struct PriceFeed {
        bytes32 id;
        Price price;
        Price ema_price;
    }
        
    function getPriceUnsafe(bytes32 id) external view returns (Price memory price);

  
     function getPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view returns (Price memory price);

   
        function getEmaPriceUnsafe(
            bytes32 id
        ) external view returns (Price memory price) ;

        function getEmaPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view returns (Price memory price) ;

    
        function updatePriceFeeds(bytes[] calldata updateData) external payable;

        function updatePriceFeedsIfNecessary(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64[] calldata publishTimes
        ) external payable;

        function getUpdateFee(
            bytes[] calldata updateData
        ) external view returns (uint feeAmount);
        
        function parsePriceFeedUpdates(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64 minPublishTime,
            uint64 maxPublishTime
        ) external payable returns (PriceFeed[] memory priceFeeds) ;

        
        function parsePriceFeedUpdatesUnique(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64 minPublishTime,
            uint64 maxPublishTime
        ) external payable returns (PriceFeed[] memory priceFeeds);


        function queryPriceFeed(
            bytes32 id
        ) public view virtual returns (PriceFeed[] memory priceFeeds);

        function priceFeedExists(
           bytes32 id
        ) public view virtual returns (PriceFeed[] memory priceFeeds);


      function getValidTimePeriod()
        public
        view
        virtual
        returns (uint validTimePeriod);

}



impl  StoragePrice  {
    pub fn to_price(&self) ->Price {
        Price {
            price:self.price.get().as_i64(),
            conf: self.conf.get().to(),
            expo: self.expo.get().as_i32(),
            publish_time: self.publish_time.get()
        }
    }

    pub fn set(&mut self, price:Price) {
        self.price.set(I64::try_from(price.price).unwrap());
        self.conf.set(U64::try_from(price.conf).unwrap());
        self.expo.set(I32::try_from(price.expo).unwrap());
        self.publish_time.set(price.publish_time);
    }

}

impl StoragePriceFeed {
    pub  fn to_price_feed(&self)-> PriceFeed {
        PriceFeed {
            id: self.id.get(),
            price: self.price.to_price(),
            ema_price: self.ema_price.to_price()
        }
    }
    
    pub fn set(&mut self, price_feed:PriceFeed) {
        self.id.set(price_feed.id);
        self.price.set(price_feed.price);
        self.ema_price.set(price_feed.ema_price);
    }

} 

//impl  for Price {}
