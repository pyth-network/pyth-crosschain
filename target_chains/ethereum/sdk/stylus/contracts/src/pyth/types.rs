#![allow(missing_docs)]
//! Solidity type definitions used throughout the project
use alloy_primitives::{I32, I64, U256, U64};
use stylus_sdk::{alloy_sol_types::sol, prelude::*};

sol_storage! {
    /// Represents a storage-optimized price structure containing the current price data.
    pub struct StoragePrice {
        int64 price;
        uint64 conf;
        int32 expo;
        uint publish_time;
    }

   /// Represents a storage-optimized price feed structure containing an ID and associated price data.
    pub struct StoragePriceFeed {
        bytes32 id;
        StoragePrice price;
        StoragePrice ema_price;
    }
}

sol! {
    /// Represents a price structure containing the current price data.
    ///
    /// # Fields
    /// - `price`: The current price value as an `int64`.
    /// - `conf`: The confidence level of the price as a `uint64`.
    /// - `expo`: The exponent value indicating the scale of the price as an `int32`.
    /// - `publish_time`: The timestamp of when the price was published as a `uint`.
   #[derive(Debug, Copy)]
   struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint publish_time;
    }

    /// Represents a price feed structure containing an ID and associated price data.
    ///
    /// This struct is used solely as a return type for function selectors related
    /// to price feeds in the SDK.
    ///
    /// # Fields
    /// - `id`: The unique identifier for the price feed as a `bytes32`.
    /// - `price`: The current price information as a `Price`.
    /// - `ema_price`: The Exponential Moving Average (EMA) price information as a `Price`.
   #[derive(Debug, Copy)]
    struct PriceFeed {
        bytes32 id;
        Price price;
        Price ema_price;
    }
     /// Function call selector: Fetches the price associated with the given ID without validation.
        /// Returns the raw `Price` data for the specified `bytes32` ID, acting as a return call selector.
        function getPriceUnsafe(bytes32 id) external view returns (int64,uint64,int32,uint);

        /// Function call selector: Retrieves the price associated with the given ID
        /// ensuring that the price is not older than the specified age in seconds.
        /// Returns the `Price` data for the specified `bytes32` ID.
        function getPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view returns (Price memory price);

        /// Function call selector: Fetches the Exponential Moving Average (EMA) price
        /// associated with the given ID without validation.
        /// Returns the raw `Price` data for the specified `bytes32` ID, acting as a return call selector.
        function getEmaPriceUnsafe(
            bytes32 id
        ) external view returns (Price memory price);

        /// Function call selector: Retrieves the EMA price associated with the given ID
        /// ensuring that the price is not older than the specified age in seconds.
        /// Returns the `Price` data for the specified `bytes32` ID.
        function getEmaPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view returns (Price memory price);

        /// Function call selector: Updates multiple price feeds using the provided update data.
        /// Accepts an array of `bytes` containing update data and processes the updates.
        function updatePriceFeeds(bytes[] calldata updateData) external payable;

        /// Function call selector: Updates multiple price feeds only if necessary based on the provided conditions.
        /// Accepts arrays of `bytes`, `bytes32`, and `uint64` to check against existing feeds
        /// and processes the updates if conditions are met.
        function updatePriceFeedsIfNecessary(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64[] calldata publishTimes
        ) external payable;

        /// Function call selector: Calculates the fee amount required to update price feeds
        /// based on the provided update data.
        /// Returns the fee amount as a `uint`.
        function getUpdateFee(
            bytes[] calldata updateData
        ) external view returns (uint feeAmount);

        /// Function call selector: Parses updates from the provided data for multiple price feeds.
        /// Accepts arrays of `bytes` and `bytes32`, along with publish time constraints,
        /// and returns an array of `PriceFeed` structs containing the parsed updates.
        function parsePriceFeedUpdates(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64 minPublishTime,
            uint64 maxPublishTime
        ) external payable returns (PriceFeed[] memory priceFeeds);

        /// Function call selector: Parses updates from the provided data for unique price feeds.
        /// Accepts arrays of `bytes` and `bytes32`, along with publish time constraints,
        /// and returns an array of unique `PriceFeed` structs containing the parsed updates.
        function parsePriceFeedUpdatesUnique(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64 minPublishTime,
            uint64 maxPublishTime
        ) external payable returns (PriceFeed[] memory priceFeeds);

        /// Function call selector: Queries the price feed for a given ID.
        /// Returns an array of `PriceFeed` structs associated with the specified `bytes32` ID.
        function queryPriceFeed(
            bytes32 id
        ) public view virtual returns (PriceFeed[] memory priceFeeds);

        /// Function call selector: Checks if a price feed exists for the given ID.
        /// Returns an array of `PriceFeed` structs if it exists for the specified `bytes32` ID.
        function priceFeedExists(
        bytes32 id
        ) public view virtual returns (PriceFeed[] memory priceFeeds);

        /// Function call selector: Retrieves the valid time period for price feeds.
        /// Returns the valid time period as a `uint`.
        function getValidTimePeriod()
            public
            view
            virtual
            returns (uint validTimePeriod);
}

impl StoragePrice {
    /// Converts the `StoragePrice` instance into a `Price` struct.
    ///
    /// This method retrieves the stored values from the `StoragePrice`
    /// and creates a `Price` struct, making it suitable for external
    /// use or return types in function calls.
    pub fn to_price(&self) -> Price {
        Price {
            price: self.price.get().as_i64(),
            conf: self.conf.get().to(),
            expo: self.expo.get().as_i32(),
            publish_time: self.publish_time.get(),
        }
    }

    /// Sets the values of the `StoragePrice` instance from a given `Price` struct.
    /// This method updates the stored values in the `StoragePrice` with
    /// the corresponding values from the provided `Price` struct, ensuring
    /// that the internal state is accurately reflected.
    pub fn set(&mut self, price: Price) {
        self.price.set(I64::try_from(price.price).unwrap());
        self.conf.set(U64::try_from(price.conf).unwrap());
        self.expo.set(I32::try_from(price.expo).unwrap());
        self.publish_time.set(price.publish_time);
    }

    /// This function is for just for testing
    pub fn test_from_price(price: Price) -> Self {
        let mut storage_price = unsafe { StoragePrice::new(U256::from(100), 0) };
        storage_price.set(price);
        storage_price
    }
}

impl StoragePriceFeed {
    /// Converts the `StoragePriceFeed` instance into a `PriceFeed` struct.
    ///
    /// This method retrieves the stored price feed values and creates
    /// a `PriceFeed` struct, which includes the unique identifier and
    /// associated price data, making it suitable for external use or
    /// return types in function calls.
    pub fn to_price_feed(&self) -> PriceFeed {
        PriceFeed {
            id: self.id.get(),
            price: self.price.to_price(),
            ema_price: self.ema_price.to_price(),
        }
    }

    /// Sets the values of the `StoragePriceFeed` instance from a given `PriceFeed` struct.
    ///
    /// This method updates the stored values in the `StoragePriceFeed`
    /// with the corresponding values from the provided `PriceFeed` struct,
    /// ensuring that the internal state is accurately reflected.
    pub fn set(&mut self, price_feed: PriceFeed) {
        self.id.set(price_feed.id);
        self.price.set(price_feed.price);
        self.ema_price.set(price_feed.ema_price);
    }

    /// This function is for just for testing
    #[cfg(test)]
    pub fn test_from_price_feed(price_feed: PriceFeed) -> Self {
        let mut storage_price_feed = unsafe { StoragePriceFeed::new(U256::from(100), 0) };
        storage_price_feed.set(price_feed);
        storage_price_feed
    }
}

#[cfg(all(test, feature = "std"))]
mod tests {
    use crate::pyth::types::{Price, PriceFeed, StoragePrice, StoragePriceFeed};
    use alloy_primitives::{B256, U256};

    // Updated constants to use uppercase naming convention
    const PRICE: i64 = 1000;
    const CONF: u64 = 1000;
    const EXPO: i32 = 1000;

    /// Generates a 256-bit hash filled with the byte value 30.
    ///
    /// # Returns
    /// - `B256`: A 256-bit hash where each byte is set to 30.
    fn generate_bytes() -> B256 {
        B256::repeat_byte(30)
    }

    #[motsu::test]
    fn can_create_type_price() {
        let price_result = Price {
            price: PRICE,
            conf: CONF,
            expo: EXPO,
            publish_time: U256::from(1000),
        };
        assert_eq!(price_result.price, PRICE);
        assert_eq!(price_result.conf, CONF);
        assert_eq!(price_result.expo, EXPO);
        assert_eq!(price_result.publish_time, U256::from(1000));
    }

    #[motsu::test]
    fn can_create_type_price_feed() {
        let id = generate_bytes();
        let price_result = Price {
            price: PRICE,
            conf: CONF,
            expo: EXPO,
            publish_time: U256::from(1000),
        };
        let price_result_ema = Price {
            price: PRICE,
            conf: CONF,
            expo: EXPO,
            publish_time: U256::from(1000),
        };
        let price_feed_result = PriceFeed {
            id,
            price: price_result,
            ema_price: price_result_ema,
        };
        assert_eq!(price_feed_result.price.price, PRICE);
        assert_eq!(price_feed_result.price.conf, CONF);
        assert_eq!(price_feed_result.price.expo, EXPO);
        assert_eq!(price_feed_result.price.publish_time, U256::from(1000));
        assert_eq!(price_feed_result.ema_price.price, PRICE);
        assert_eq!(price_feed_result.ema_price.conf, CONF);
        assert_eq!(price_feed_result.ema_price.expo, EXPO);
        assert_eq!(price_feed_result.ema_price.publish_time, U256::from(1000));
    }

    #[motsu::test]
    fn can_create_type_storage_price() {
        let price_result = Price {
            price: PRICE,
            conf: CONF,
            expo: EXPO,
            publish_time: U256::from(1000),
        };
        let storage_price_result = StoragePrice::test_from_price(price_result);
        let price_result = storage_price_result.to_price();
        assert_eq!(price_result.price, PRICE);
        assert_eq!(price_result.conf, CONF);
        assert_eq!(price_result.expo, EXPO);
        assert_eq!(price_result.publish_time, U256::from(1000));
    }

    #[motsu::test]
    fn can_create_type_storage_price_feed() {
        let price_result = Price {
            price: PRICE,
            conf: CONF,
            expo: EXPO,
            publish_time: U256::from(1000),
        };
        let price_result_ema = Price {
            price: PRICE,
            conf: CONF,
            expo: EXPO,
            publish_time: U256::from(1000),
        };
        let price_feed_result = PriceFeed {
            id: generate_bytes(),
            price: price_result,
            ema_price: price_result_ema,
        };
        let storage_price_feed_result = StoragePriceFeed::test_from_price_feed(price_feed_result);
        let price_feed_result = storage_price_feed_result.to_price_feed();
        assert_eq!(price_feed_result.price.price, PRICE);
        assert_eq!(price_feed_result.price.conf, CONF);
        assert_eq!(price_feed_result.price.expo, EXPO);
        assert_eq!(price_feed_result.price.publish_time, U256::from(1000));
        assert_eq!(price_feed_result.ema_price.price, PRICE);
        assert_eq!(price_feed_result.ema_price.conf, CONF);
        assert_eq!(price_feed_result.ema_price.expo, EXPO);
        assert_eq!(price_feed_result.ema_price.publish_time, U256::from(1000));
    }
}
