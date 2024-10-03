
use alloc::vec::Vec;
use stylus_sdk::{prelude::*, alloy_sol_types::{sol,}};

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

        function getPriceUnsafe(
            bytes32 id
        ) external view;

  
        function getPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view;

   
        function getEmaPriceUnsafe(
            bytes32 id
        ) external view ;

        function getEmaPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view ;

    
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
        ) external payable ;

        
        function parsePriceFeedUpdatesUnique(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64 minPublishTime,
            uint64 maxPublishTime
        ) external payable ;


        function queryPriceFeed(
            bytes32 id
        ) public view virtual ;

        function priceFeedExists(
           bytes32 id
        ) public view virtual ;


      function getValidTimePeriod()
        public
        view
        virtual
        returns (uint validTimePeriod);

}

// impl  StoragePrice  {
//     pub fn to_price(&self) ->Price {
//       Price {
//             price:self.price.get().as_i64(),
//             conf: self.conf.get().to(),
//             expo: self.expo.get().as_i32(),
//             publish_time: self.publish_time.get()
//         }
//     }
// }
// impl StoragePriceFeed {
//     pub  fn to_price_feed(&self)-> PriceFeed {
//         PriceFeed {
//             id: self.id.get(),
//             price: self.price.to_price(),
//             emaPrice: self.ema_price.to_price()
//         }
//     }
// }

    