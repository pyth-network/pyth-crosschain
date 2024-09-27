use core::fmt::Binary;

use alloy_primitives::I64;
use alloy_sol_types::sol;
use stylus_sdk::prelude::sol_storage;

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

    struct Price {
        // Price
        int64 price;
        // Confidence interval around the price
        uint64 conf;
        // Price exponent
        int32 expo;
        // Unix timestamp describing when the price was published
        uint publishTime;
    }

    // PriceFeed represents a current aggregate price from pyth publisher feeds.

    struct PriceFeed {
        // The price ID.
        bytes32 id;
        // Latest available price
        Price price;
        // Latest available exponentially-weighted moving average price
        Price emaPrice;
    }

        /// @notice Returns the price of a price feed without any sanity checks.
        /// @dev This function returns the most recent price update in this contract without any recency checks.
        /// This function is unsafe as the returned price update may be arbitrarily far in the past.
        ///
        /// Users of this function should check the `publishTime` in the price to ensure that the returned price is
        /// sufficiently recent for their application. If you are considering using this function, it may be
        /// safer / easier to use `getPriceNoOlderThan`.
        /// @return price - please read the documentation of Price to understand how to use this safely.
        function getPriceUnsafe(
            bytes32 id
        ) external view returns (Price memory price);

        /// @notice Returns the price that is no older than `age` seconds of the current time.
        /// @dev This function is a sanity-checked version of `getPriceUnsafe` which is useful in
        /// applications that require a sufficiently-recent price. Reverts if the price wasn't updated sufficiently
        /// recently.
        /// @return price - please read the documentation of Price to understand how to use this safely.
        function getPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view returns (Price memory price);

        /// @notice Returns the exponentially-weighted moving average price of a price feed without any sanity checks.
        /// @dev This function returns the same price as `getEmaPrice` in the case where the price is available.
        /// However, if the price is not recent this function returns the latest available price.
        ///
        /// The returned price can be from arbitrarily far in the past; this function makes no guarantees that
        /// the returned price is recent or useful for any particular application.
        ///
        /// Users of this function should check the `publishTime` in the price to ensure that the returned price is
        /// sufficiently recent for their application. If you are considering using this function, it may be
        /// safer / easier to use either `getEmaPrice` or `getEmaPriceNoOlderThan`.
        /// @return price - please read the documentation of Price to understand how to use this safely.
        function getEmaPriceUnsafe(
            bytes32 id
        ) external view returns (Price memory price);

        /// @notice Returns the exponentially-weighted moving average price that is no older than `age` seconds
        /// of the current time.
        /// @dev This function is a sanity-checked version of `getEmaPriceUnsafe` which is useful in
        /// applications that require a sufficiently-recent price. Reverts if the price wasn't updated sufficiently
        /// recently.
        /// @return price - please read the documentation of Price to understand how to use this safely.
        function getEmaPriceNoOlderThan(
            bytes32 id,
            uint age
        ) external view returns (Price memory price);

        /// @notice Update price feeds with given update messages.
        /// This method requires the caller to pay a fee in wei; the required fee can be computed by calling
        /// `getUpdateFee` with the length of the `updateData` array.
        /// Prices will be updated if they are more recent than the current stored prices.
        /// The call will succeed even if the update is not the most recent.
        /// @dev Reverts if the transferred fee is not sufficient or the updateData is invalid.
        /// @param updateData Array of price update data.
        function updatePriceFeeds(bytes[] calldata updateData) external payable;

        /// @notice Wrapper around updatePriceFeeds that rejects fast if a price update is not necessary. A price update is
        /// necessary if the current on-chain publishTime is older than the given publishTime. It relies solely on the
        /// given `publishTimes` for the price feeds and does not read the actual price update publish time within `updateData`.
        ///
        /// This method requires the caller to pay a fee in wei; the required fee can be computed by calling
        /// `getUpdateFee` with the length of the `updateData` array.
        ///
        /// `priceIds` and `publishTimes` are two arrays with the same size that correspond to senders known publishTime
        /// of each priceId when calling this method. If all of price feeds within `priceIds` have updated and have
        /// a newer or equal publish time than the given publish time, it will reject the transaction to save gas.
        /// Otherwise, it calls updatePriceFeeds method to update the prices.
        ///
        /// @dev Reverts if update is not needed or the transferred fee is not sufficient or the updateData is invalid.
        /// @param updateData Array of price update data.
        /// @param priceIds Array of price ids.
        /// @param publishTimes Array of publishTimes. `publishTimes[i]` corresponds to known `publishTime` of `priceIds[i]`
        function updatePriceFeedsIfNecessary(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64[] calldata publishTimes
        ) external payable;

        /// @notice Returns the required fee to update an array of price updates.
        /// @param updateData Array of price update data.
        /// @return feeAmount The required fee in Wei.
        function getUpdateFee(
            bytes[] calldata updateData
        ) external view returns (uint feeAmount);

        /// @notice Parse `updateData` and return price feeds of the given `priceIds` if they are all published
        /// within `minPublishTime` and `maxPublishTime`.
        ///
        /// You can use this method if you want to use a Pyth price at a fixed time and not the most recent price;
        /// otherwise, please consider using `updatePriceFeeds`. This method may store the price updates on-chain, if they
        /// are more recent than the current stored prices.
        ///
        /// This method requires the caller to pay a fee in wei; the required fee can be computed by calling
        /// `getUpdateFee` with the length of the `updateData` array.
        ///
        ///
        /// @dev Reverts if the transferred fee is not sufficient or the updateData is invalid or there is
        /// no update for any of the given `priceIds` within the given time range.
        /// @param updateData Array of price update data.
        /// @param priceIds Array of price ids.
        /// @param minPublishTime minimum acceptable publishTime for the given `priceIds`.
        /// @param maxPublishTime maximum acceptable publishTime for the given `priceIds`.
        /// @return priceFeeds Array of the price feeds corresponding to the given `priceIds` (with the same order).
        function parsePriceFeedUpdates(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64 minPublishTime,
            uint64 maxPublishTime
        ) external payable returns (PriceFeed[] memory priceFeeds);

        /// @notice Similar to `parsePriceFeedUpdates` but ensures the updates returned are
        /// the first updates published in minPublishTime. That is, if there are multiple updates for a given timestamp,
        /// this method will return the first update. This method may store the price updates on-chain, if they
        /// are more recent than the current stored prices.
        ///
        ///
        /// @dev Reverts if the transferred fee is not sufficient or the updateData is invalid or there is
        /// no update for any of the given `priceIds` within the given time range and uniqueness condition.
        /// @param updateData Array of price update data.
        /// @param priceIds Array of price ids.
        /// @param minPublishTime minimum acceptable publishTime for the given `priceIds`.
        /// @param maxPublishTime maximum acceptable publishTime for the given `priceIds`.
        /// @return priceFeeds Array of the price feeds corresponding to the given `priceIds` (with the same order).
        function parsePriceFeedUpdatesUnique(
            bytes[] calldata updateData,
            bytes32[] calldata priceIds,
            uint64 minPublishTime,
            uint64 maxPublishTime
        ) external payable returns (PriceFeed[] memory priceFeeds);


        function queryPriceFeed(
            bytes32 id
        ) public view virtual returns (PriceFeed memory priceFeed);

        function priceFeedExists(
           bytes32 id
        ) public view virtual returns (bool exists);


    /// @notice This function is deprecated and is only kept for backward compatibility.
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
            publishTime: self.publish_time.get()
        }
    }
}

impl StoragePriceFeed {
    pub  fn to_price_feed(&self)-> PriceFeed {
        PriceFeed {
            id: self.id.get(),
            price: self.price.to_price(),
            emaPrice: self.ema_price.to_price()
        }
    }
}

    