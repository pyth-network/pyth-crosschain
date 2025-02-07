#![allow(clippy::clone_on_copy)]
#![allow(clippy::too_many_arguments)]
use crate::pyth::errors::{Error, PriceFeedNotFound};
use crate::pyth::events::PriceFeedUpdate;
use crate::pyth::functions::create_price_feed_update_data;
use crate::pyth::types::{Price, PriceFeed, StoragePriceFeed};
use crate::{
    pyth::errors::{FalledDecodeData, InsufficientFee, InvalidArgument},
    utils::CALL_RETDATA_DECODING_ERROR_MESSAGE,
};
use alloc::vec::Vec;
use alloy_primitives::{Bytes, B256, U256};
use alloy_sol_types::{sol_data::Uint as SolUInt, SolType, SolValue};
use stylus_sdk::storage::{StorageMap, StorageUint};
use stylus_sdk::{
    abi::Bytes as AbiBytes,
    evm, msg,
    prelude::{public, storage},
};

/// Decode data type PriceFeed and uint64
pub type DecodeDataType = (PriceFeed, SolUInt<64>);

#[storage]
pub struct MockPythContract {
    single_update_fee_in_wei: StorageUint<256, 4>,
    valid_time_period: StorageUint<256, 4>,
    price_feeds: StorageMap<B256, StoragePriceFeed>,
}

#[public]
impl MockPythContract {
    fn initialize(
        &mut self,
        single_update_fee_in_wei: U256,
        valid_time_period: U256,
    ) -> Result<(), Vec<u8>> {
        if single_update_fee_in_wei <= U256::ZERO || valid_time_period <= U256::ZERO {
            return Err(Error::InvalidArgument(InvalidArgument {}).into());
        }
        self.single_update_fee_in_wei.set(single_update_fee_in_wei);
        self.valid_time_period.set(valid_time_period);
        Ok(())
    }

    fn query_price_feed(&self, id: B256) -> Result<Vec<u8>, Vec<u8>> {
        let price_feed = self.price_feeds.get(id).to_price_feed();
        if price_feed.id.is_zero() {
            return Err(Error::PriceFeedNotFound(PriceFeedNotFound {}).into());
        }
        Ok(price_feed.abi_encode())
    }

    fn price_feed_exists(&self, id: B256) -> bool {
        self.price_feeds.getter(id).id.is_empty()
    }

    fn get_valid_time_period(&self) -> U256 {
        self.valid_time_period.get()
    }

    /// Takes an array of encoded price feeds and stores them.
    /// You can create this data either by calling createPriceFeedUpdateData or
    /// by using web3.js or ethers abi utilities.
    /// @note: The updateData expected here is different from the one used in the main contract.
    /// In particular, the expected format is:
    /// [
    ///     abi.encode(
    ///         PythStructs.PriceFeed(
    ///             bytes32 id,
    ///             PythStructs.Price price,
    ///             PythStructs.Price emaPrice
    ///         ),
    ///         uint64 prevPublishTime
    ///     )
    /// ]

    #[payable]
    fn update_price_feeds(&mut self, update_data: Vec<AbiBytes>) -> Result<(), Vec<u8>> {
        let required_fee = self.get_update_fee(update_data.clone());
        if required_fee < msg::value() {
            return Err(Error::InsufficientFee(InsufficientFee {}).into());
        }

        for item in update_data.iter() {
            let price_feed_data = <PriceFeed as SolType>::abi_decode(item, false)
                .map_err(|_| CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec())?;
            let last_publish_time = &self
                .price_feeds
                .get(price_feed_data.id)
                .price
                .publish_time
                .get();
            if last_publish_time < &price_feed_data.price.publish_time {
                self.price_feeds
                    .setter(price_feed_data.id)
                    .set(price_feed_data);
                evm::log(PriceFeedUpdate {
                    id: price_feed_data.id,
                    publishTime: price_feed_data.price.publish_time.to(),
                    price: price_feed_data.price.price,
                    conf: price_feed_data.price.conf,
                });
            }
        }
        Ok(())
    }

    fn get_update_fee(&self, update_data: Vec<AbiBytes>) -> U256 {
        self.single_update_fee_in_wei.get() * U256::from(update_data.len())
    }

    #[payable]
    fn parse_price_feed_updates(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Vec<u8>> {
        self.parse_price_feed_updates_internal(
            update_data,
            price_ids,
            min_publish_time,
            max_publish_time,
            false,
        )
    }

    #[payable]
    fn parse_price_feed_updates_unique(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        min_publish_time: u64,
        max_publish_time: u64,
    ) -> Result<Vec<u8>, Vec<u8>> {
        self.parse_price_feed_updates_internal(
            update_data,
            price_ids,
            min_publish_time,
            max_publish_time,
            true,
        )
    }

    fn create_price_feed_update_data(
        &self,
        id: B256,
        price: i64,
        conf: u64,
        expo: i32,
        ema_price: i64,
        ema_conf: u64,
        publish_time: U256,
        prev_publish_time: u64,
    ) -> Vec<u8> {
        let price = Price {
            price,
            conf,
            expo,
            publish_time,
        };
        let ema_price = Price {
            price: ema_price,
            conf: ema_conf,
            expo,
            publish_time,
        };

        let price_feed_data = PriceFeed {
            id,
            price,
            ema_price,
        };

        let price_feed_data_encoding = (price_feed_data, prev_publish_time);
        DecodeDataType::abi_encode(&price_feed_data_encoding)
    }
}

impl MockPythContract {
    fn parse_price_feed_updates_internal(
        &mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<B256>,
        min_publish_time: u64,
        max_publish_time: u64,
        unique: bool,
    ) -> Result<Vec<u8>, Vec<u8>> {
        let required_fee = self.get_update_fee(update_data.clone());
        if required_fee > msg::value() {
            return Err(Error::InsufficientFee(InsufficientFee {}).into());
        }

        let mut result_feeds = Vec::new();

        for price_id in price_ids {
            let mut matched_feed: Option<PriceFeed> = None;

            for data in &update_data {
                // Decode the update_data
                let (price_feed, _prev_publish_time) = match DecodeDataType::abi_decode(data, false)
                {
                    Ok(res) => res,
                    Err(_) => {
                        return Err(Error::FalledDecodeData(FalledDecodeData {}).into());
                    }
                };

                if price_feed.id == price_id {
                    let publish_time = price_feed.price.publish_time;
                    let previous_publish_time =
                        self.price_feeds.get(price_id).price.publish_time.get();

                    // Validate publish time and uniqueness
                    if publish_time > U256::from(min_publish_time)
                        && publish_time <= U256::from(max_publish_time)
                        && (!unique || previous_publish_time < U256::from(min_publish_time))
                    {
                        // Store the matched feed
                        matched_feed = Some(price_feed.clone());

                        // Update storage if the feed is newer
                        if previous_publish_time < publish_time {
                            self.price_feeds.setter(price_id).set(price_feed.clone());
                            evm::log(PriceFeedUpdate {
                                id: price_feed.id,
                                publishTime: publish_time.to(),
                                price: price_feed.price.price,
                                conf: price_feed.price.conf,
                            });
                        }
                        break;
                    }
                }
            }

            // Check if a matching feed was found for the price_id
            if let Some(feed) = matched_feed {
                result_feeds.push(feed);
            } else {
                return Err(Error::FalledDecodeData(FalledDecodeData {}).into());
            }
        }

        Ok(result_feeds.abi_encode())
    }
}

pub fn create_price_feed_update_data_list() -> (Vec<Bytes>, Vec<B256>) {
    let id = ["ETH", "SOL", "BTC"].map(|x| {
        let x = keccak_const::Keccak256::new()
            .update(x.as_bytes())
            .finalize()
            .to_vec();
        B256::from_slice(&x)
    });
    let mut price_feed_data_list = Vec::new();
    for item in &id {
        let price_feed_data = create_price_feed_update_data(
            *item,
            100,
            100,
            100,
            100,
            100,
            U256::from(U256::MAX - U256::from(10)),
            0,
        );
        let price_feed_data = Bytes::from(AbiBytes::from(price_feed_data).0);
        price_feed_data_list.push(price_feed_data);
    }
    (price_feed_data_list, id.to_vec())
}

#[cfg(all(test, feature = "std"))]
mod tests {
    use crate::pyth::mock::{DecodeDataType, MockPythContract};
    use alloc::vec;
    use alloy_primitives::{B256, U256};
    use alloy_sol_types::SolType;
    use stylus_sdk::abi::Bytes;

    /// Updated constants to use uppercase naming convention
    const PRICE: i64 = 1000;
    const CONF: u64 = 1000;
    const EXPO: i32 = 1000;
    const EMA_PRICE: i64 = 1000;
    const EMA_CONF: u64 = 1000;
    const PREV_PUBLISH_TIME: u64 = 1000;

    fn generate_bytes() -> B256 {
        B256::repeat_byte(30)
    }

    #[motsu::test]
    fn can_initialize_mock_contract(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        assert_eq!(contract.single_update_fee_in_wei.get(), U256::from(1000));
        assert_eq!(contract.valid_time_period.get(), U256::from(1000));
    }

    #[motsu::test]
    fn error_initialize_mock_contract(contract: MockPythContract) {
        let err = contract.initialize(U256::from(0), U256::from(0));
        assert!(err.is_err())
    }

    #[motsu::test]
    fn created_price_feed_data(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let id = generate_bytes();
        let publish_time = U256::from(1000);
        let price_feed_created = contract.create_price_feed_update_data(
            id,
            PRICE,
            CONF,
            EXPO,
            EMA_PRICE,
            EMA_CONF,
            publish_time,
            PREV_PUBLISH_TIME,
        );
        let price_feed_decoded = DecodeDataType::abi_decode(&price_feed_created, true).unwrap();
        assert_eq!(price_feed_decoded.0.id, id);
        assert_eq!(price_feed_decoded.0.price.price, PRICE);
        assert_eq!(price_feed_decoded.0.price.conf, CONF);
        assert_eq!(price_feed_decoded.0.price.expo, EXPO);
        assert_eq!(price_feed_decoded.0.ema_price.price, EMA_PRICE);
        assert_eq!(price_feed_decoded.0.ema_price.conf, EMA_CONF);
        assert_eq!(price_feed_decoded.1, PREV_PUBLISH_TIME);
    }

    #[motsu::test]
    fn can_get_update_fee(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let publish_time = U256::from(1000);
        let mut update_data: Vec<Bytes> = vec![];
        let mut x = 0;
        while x < 10 {
            let id = generate_bytes();
            let price_feed_created = contract.create_price_feed_update_data(
                id,
                PRICE,
                CONF,
                EXPO,
                EMA_PRICE,
                EMA_CONF,
                publish_time,
                PREV_PUBLISH_TIME,
            );
            update_data.push(Bytes::from(price_feed_created));
            x += 1;
        }
        let required_fee = contract.get_update_fee(update_data.clone());
        assert_eq!(required_fee, U256::from(1000 * x));
    }

    #[motsu::test]
    fn price_feed_does_not_exist(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let id = generate_bytes();
        let price_feed_found = contract.price_feed_exists(id);
        assert_eq!(price_feed_found, false);
    }

    #[motsu::test]
    fn query_price_feed_failed(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let id = generate_bytes();
        let _price_feed = contract
            .query_price_feed(id)
            .expect_err("should not query if price feed does not exist");
    }

    #[motsu::test]
    fn can_get_valid_time_period(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let valid_time_period = contract.get_valid_time_period();
        assert_eq!(valid_time_period, U256::from(1000));
    }
}
