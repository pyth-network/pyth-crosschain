use alloc::vec::Vec;
use alloy_primitives::{ Uint, U64};
use stylus_sdk::{prelude::*,msg, abi::Bytes, alloy_primitives::{Address, FixedBytes, U256}};
use crate::pyth::{ 
    errors::{IPythError, PriceFeedNotFound, InsufficientFee},
    solidity::{StoragePriceFeed},
    //events::PriceFeedUpdate
};
use crate::pyth::PythContract;


sol_storage! {
    pub struct MockPythContract {
        uint single_update_fee_in_wei;
        uint valid_time_period;
        mapping(bytes32 => StoragePriceFeed) price_feeds;
        #[borrow]
        PythContract pyth;
    }
}


//#[public]
//#[inherit(PythContract)]
impl MockPythContract {
    pub fn initalize(mut self, single_update_fee_in_wei: U256, valid_time_period: U256) {
        self.single_update_fee_in_wei.set(single_update_fee_in_wei);
        self.valid_time_period.set(valid_time_period);
    }
    
    // pub  fn guery_price_feed(self, id: FixedBytes<32>) -> Result<StoragePriceFeed, Vec<u8>> {
    //     let price_feed = self.price_feeds.getter(id).load();
    //     if price_feed.id.is_empty() {
    //         return Err(IPythError::PriceFeedNotFound(PriceFeedNotFound {}).into());
    //     }
    //     Ok(price_feed.load())
    // }
    pub fn price_feed_exists(self, id:FixedBytes<32>) -> bool {
         self.price_feeds.getter(id).id.is_empty() == false
    }

    pub fn get_valid_time_period(self) -> Uint<256, 4> {
         self.valid_time_period.get()
     }

    // Takes an array of encoded price feeds and stores them.
    // You can create this data either by calling createPriceFeedUpdateData or
    // by using web3.js or ethers abi utilities.
    // @note: The updateData expected here is different from the one used in the main contract.
    // In particular, the expected format is:
    // [
    //     abi.encode(
    //         PythStructs.PriceFeed(
    //             bytes32 id,
    //             PythStructs.Price price,
    //             PythStructs.Price emaPrice
    //         ),
    //         uint64 prevPublishTime
    //     )
    // ]
    // pub fn update_price_feeds(self, 
    //     update_data : Vec<Bytes>
    // ) -> Result<(), Vec<u8>> {
    //      let required_fee = self.get_update_fee(update_data);
    //      if msg.value < required_fee {
    //          return Err(IPythError::InsufficientFee(InsufficientFee {}).into());
    //      }
    //     if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

    //     for (uint i = 0; i < updateData.length; i++) {
    //         PythStructs.PriceFeed memory priceFeed = abi.decode(
    //             updateData[i],
    //             (PythStructs.PriceFeed)
    //         );

    //         uint lastPublishTime = priceFeeds[priceFeed.id].price.publishTime;

    //         if (lastPublishTime < priceFeed.price.publishTime) {
    //             // Price information is more recent than the existing price information.
    //             priceFeeds[priceFeed.id] = priceFeed;
    //             emit PriceFeedUpdate(
    //                 priceFeed.id,
    //                 uint64(priceFeed.price.publishTime),
    //                 priceFeed.price.price,
    //                 priceFeed.price.conf
    //             );
    //         }
    //     }
    // }

    pub fn get_update_fee(self, 
       update_data: Vec<Bytes>
    ) -> Uint<256, 4> {
     self.single_update_fee_in_wei.get() * U256::from(update_data.len())
    }

    // pub fn parse_price_feed_updates_internal(
    //     update_data: Vec<FixedBytes<32>>,
    //     priceIds: Vec<FixedBytes<32>>,
    //     min_publish_time:u64,
    //     max_publish_time:u64,
    //     unique:bool
    // ) internal returns (PythStructs.PriceFeed[] memory feeds) {
    //     uint requiredFee = getUpdateFee(updateData);
    //     if (msg.value < requiredFee) revert PythErrors.InsufficientFee();

    //     feeds = new PythStructs.PriceFeed[](priceIds.length);

    //     for (uint i = 0; i < priceIds.length; i++) {
    //         for (uint j = 0; j < updateData.length; j++) {
    //             uint64 prevPublishTime;
    //             (feeds[i], prevPublishTime) = abi.decode(
    //                 updateData[j],
    //                 (PythStructs.PriceFeed, uint64)
    //             );

    //             uint publishTime = feeds[i].price.publishTime;
    //             if (priceFeeds[feeds[i].id].price.publishTime < publishTime) {
    //                 priceFeeds[feeds[i].id] = feeds[i];
    //                 emit PriceFeedUpdate(
    //                     feeds[i].id,
    //                     uint64(publishTime),
    //                     feeds[i].price.price,
    //                     feeds[i].price.conf
    //                 );
    //             }

    //             if (feeds[i].id == priceIds[i]) {
    //                 if (
    //                     minPublishTime <= publishTime &&
    //                     publishTime <= maxPublishTime &&
    //                     (!unique || prevPublishTime < minPublishTime)
    //                 ) {
    //                     break;
    //                 } else {
    //                     feeds[i].id = 0;
    //                 }
    //             }
    //         }

    //         if (feeds[i].id != priceIds[i])
    //             revert PythErrors.PriceFeedNotFoundWithinRange();
    //     }
    // }

    // function parsePriceFeedUpdates(
    //     bytes[] calldata updateData,
    //     bytes32[] calldata priceIds,
    //     uint64 minPublishTime,
    //     uint64 maxPublishTime
    // ) external payable override returns (PythStructs.PriceFeed[] memory feeds) {
    //     return
    //         parsePriceFeedUpdatesInternal(
    //             updateData,
    //             priceIds,
    //             minPublishTime,
    //             maxPublishTime,
    //             false
    //         );
    // }

    // function parsePriceFeedUpdatesUnique(
    //     bytes[] calldata updateData,
    //     bytes32[] calldata priceIds,
    //     uint64 minPublishTime,
    //     uint64 maxPublishTime
    // ) external payable override returns (PythStructs.PriceFeed[] memory feeds) {
    //     return
    //         parsePriceFeedUpdatesInternal(
    //             updateData,
    //             priceIds,
    //             minPublishTime,
    //             maxPublishTime,
    //             true
    //         );
    // }

    // function createPriceFeedUpdateData(
    //     bytes32 id,
    //     int64 price,
    //     uint64 conf,
    //     int32 expo,
    //     int64 emaPrice,
    //     uint64 emaConf,
    //     uint64 publishTime,
    //     uint64 prevPublishTime
    // ) public pure returns (bytes memory priceFeedData) {
    //     PythStructs.PriceFeed memory priceFeed;

    //     priceFeed.id = id;

    //     priceFeed.price.price = price;
    //     priceFeed.price.conf = conf;
    //     priceFeed.price.expo = expo;
    //     priceFeed.price.publishTime = publishTime;

    //     priceFeed.emaPrice.price = emaPrice;
    //     priceFeed.emaPrice.conf = emaConf;
    //     priceFeed.emaPrice.expo = expo;
    //     priceFeed.emaPrice.publishTime = publishTime;

    //     priceFeedData = abi.encode(priceFeed, prevPublishTime);
    // }
}