use alloc::vec::Vec;
use alloy_primitives::{Uint, FixedBytes, U256, Bytes};
use alloy_sol_types::{ sol_data::Uint as SolUInt, SolType, SolValue};
use stylus_sdk::{abi::Bytes as AbiBytes,evm, msg, prelude::*};
use crate::{pyth::errors::{FalledDecodeData, InsufficientFee, InvalidArgument}, utils::helpers::CALL_RETDATA_DECODING_ERROR_MESSAGE};
use crate::pyth::errors::{Error, PriceFeedNotFound};
use crate::pyth::types::{ PriceFeed,Price, StoragePriceFeed};
use crate::pyth::events::PriceFeedUpdate;
use crate::pyth::functions::create_price_feed_update_data;

///Decode data type PriceFeed and uint64
pub type DecodeDataType = (PriceFeed, SolUInt<64>);

sol_storage! {
    struct MockPythContract {
        uint single_update_fee_in_wei;
        uint valid_time_period;
        mapping(bytes32 => StoragePriceFeed) price_feeds;
    }
}

#[public]
impl MockPythContract {

    fn initialize(&mut self, single_update_fee_in_wei: Uint<256, 4>, valid_time_period: Uint<256, 4>) -> Result<(), Vec<u8>> {
        if single_update_fee_in_wei <= U256::from(0) || valid_time_period <= U256::from(0) {
            return Err(Error::InvalidArgument(InvalidArgument {}).into());
         }
        self.single_update_fee_in_wei.set(single_update_fee_in_wei);
        self.valid_time_period.set(valid_time_period);
        Ok(())
    }


    fn query_price_feed(&self, id: FixedBytes<32>) -> Result<Vec<u8>, Vec<u8>> {
        let price_feed  =  self.price_feeds.get(id).to_price_feed();
        if price_feed.id.eq(&FixedBytes::<32>::ZERO) {
            return Err(Error::PriceFeedNotFound(PriceFeedNotFound {}).into());
        }
        Ok(price_feed.abi_encode())
    }

    fn price_feed_exists(&self, id:FixedBytes<32>) -> bool {
         self.price_feeds.getter(id).id.is_empty()
    }

    fn get_valid_time_period(&self) -> Uint<256, 4> {
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

    #[payable]
    fn update_price_feeds(&mut self, 
        update_data : Vec<AbiBytes>
    ) -> Result<(), Vec<u8>> {
        let  required_fee = self.get_update_fee(update_data.clone());
         if required_fee.lt(&U256::from(msg::value())) {
             return Err(Error::InsufficientFee(InsufficientFee {}).into());
        }

        for i in 0..update_data.len() {
          let price_feed_data =  <PriceFeed as SolType>::abi_decode(&update_data[i], false)
            .map_err( |_| CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec())?;
          let last_publish_time = &self.price_feeds.get(price_feed_data.id).price.publish_time;
          if  last_publish_time.lt(&price_feed_data.price.publish_time) {
          self.price_feeds.setter(price_feed_data.id).set(price_feed_data);
          evm::log(PriceFeedUpdate { 
                id: price_feed_data.id, 
                publishTime: price_feed_data.price.publish_time.to(), 
                price: price_feed_data.price.price,
                conf: price_feed_data.price.conf
           });
          }
        }
       Ok(())
    }

    fn get_update_fee(&self, update_data: Vec<AbiBytes>) -> Uint<256, 4> {
         self.single_update_fee_in_wei.get() * U256::from(update_data.len())
    }
     #[payable]
    fn parse_price_feed_updates(
        &mut self,
        update_data:Vec<AbiBytes>,
        price_ids:Vec<FixedBytes<32>>,
        min_publish_time:u64,
        max_publish_time:u64
    ) -> Result<Vec<u8>, Vec<u8>>{
        self.parse_price_feed_updates_internal(update_data, price_ids, min_publish_time, max_publish_time, false)
    }

    #[payable]
    fn parse_price_feed_updates_unique(
        &mut self,
        update_data:Vec<AbiBytes>,
        price_ids:Vec<FixedBytes<32>>,
        min_publish_time:u64,
        max_publish_time:u64
    ) ->  Result<Vec<u8>, Vec<u8>>{
        self.parse_price_feed_updates_internal(update_data, price_ids, min_publish_time, max_publish_time, true)
    }

    fn create_price_feed_update_data(&self,
        id:FixedBytes<32>,
        price:i64,
        conf:u64,
        expo:i32,
        ema_price:i64,
        ema_conf:u64,
        publish_time:U256,
        prev_publish_time:u64
    ) -> Vec<u8> {
        let price = Price { price: price, conf, expo, publish_time };
        let ema_price = Price { price:ema_price, conf:ema_conf, expo:expo,publish_time};
        
        let price_feed_data = PriceFeed {
          id,price,ema_price
        };
        
        let price_feed_data_encoding = (price_feed_data, prev_publish_time);
        return  DecodeDataType::abi_encode(&price_feed_data_encoding);
    }
}

impl  MockPythContract  {

     fn parse_price_feed_updates_internal(&mut self,
        update_data: Vec<AbiBytes>,
        price_ids: Vec<FixedBytes<32>>,
        min_publish_time:u64,
        max_publish_time:u64,
        unique:bool
    )  -> Result<Vec<u8>, Vec<u8>> {
        let  required_fee = self.get_update_fee(update_data.clone());
        if required_fee.lt(&U256::from(msg::value())) {
             return Err(Error::InsufficientFee(InsufficientFee {}).into());
        }

        let mut feeds = Vec::<PriceFeed>::with_capacity(price_ids.len());
       
        for i in 0..price_ids.len() {
          for j in 0..update_data.len() {
                let (price_feed, prev_publish_time) =  match DecodeDataType::abi_decode(&update_data[j], false) {
                    Ok(res) =>{ res },
                    Err(_) => {
                        return  Err(Error::FalledDecodeData(FalledDecodeData {}).into())
                    }
                };
                feeds[j] = price_feed.clone();

                let publish_time = price_feed.price.publish_time;
                if self.price_feeds.get(feeds[i].id).price.publish_time.lt(&publish_time) {
                   self.price_feeds.setter(feeds[i].id).set(feeds[i]);
                    evm::log( 
                        PriceFeedUpdate {
                            id:feeds[i].id,
                            publishTime: publish_time.to(), 
                            price: feeds[i].price.price, 
                            conf: feeds[i].price.conf
                        });
                }
                

                if feeds[i].id == price_ids[i] {
                     if  publish_time.gt(&U256::from(min_publish_time))  
                         && publish_time.le(&U256::from(max_publish_time)) &&
                         (!unique || prev_publish_time.lt(&min_publish_time))
                     {
                        break;
                  } else {
                       feeds[i].id = FixedBytes::<32>::ZERO;
                   }
                }

            }

            if feeds[i].id != price_ids[i] {
                return  Err(Error::FalledDecodeData(FalledDecodeData {}).into())
            }
        }
     Ok(feeds.abi_encode())
    }  
}

pub fn create_price_feed_update_data_list() -> (Vec<Bytes>, Vec<FixedBytes<32>>) {
    let id = ["ETH","SOL","BTC"].map(|x| {
        let x =  keccak_const::Keccak256::new().update(x.as_bytes()).finalize().to_vec();
        return  FixedBytes::<32>::from_slice(&x) ;
    });
    let mut price_feed_data_list = Vec::new();
    for i in 0..3 {
        let price_feed_data = create_price_feed_update_data( id[i],100,100,100,100,100,U256::from(U256::MAX - U256::from(10)),0);
        let price_feed_data = Bytes::from(AbiBytes::from(price_feed_data).0);
        price_feed_data_list.push(price_feed_data);
    }
    return (price_feed_data_list, id.to_vec())
}

#[cfg(all(test, feature = "std"))]
mod tests {
    use alloc::vec;
    use alloy_primitives::{address, uint, Address, U64, U256, FixedBytes, fixed_bytes};
    use stylus_sdk::{abi::Bytes, contract, msg::{self, value}};
    use 
    crate::pyth::{
        mock::{MockPythContract, DecodeDataType}, 
        errors::{Error, InvalidArgument}, types::{PriceFeed, Price, StoragePriceFeed}
    };
    use alloy_sol_types::SolType;

    use std::{println as info, println as warn};

    // Updated constants to use uppercase naming convention
    const PRICE: i64 = 1000;
    const CONF: u64 = 1000;
    const EXPO: i32 = 1000;
    const EMA_PRICE: i64 = 1000;
    const EMA_CONF: u64 = 1000;
    const PREV_PUBLISH_TIME: u64 = 1000;

    fn generate_bytes() -> FixedBytes<32> {
        FixedBytes::<32>::repeat_byte(30)
    }

    #[motsu::test]
    fn can_initialize_mock_contract(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        assert_eq!(contract.single_update_fee_in_wei.get(), U256::from(1000));
        assert_eq!(contract.valid_time_period.get(), U256::from(1000));
    }

    #[motsu::test]
    fn error_initialize_mock_contract(contract: MockPythContract) {
      let err = contract.initialize(U256::from(0), U256::from(0)).expect_err("should not initialize with invalid parameters");
    }

    #[motsu::test]
    fn created_price_feed_data(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let id = generate_bytes();
        let publish_time = U256::from(1000);
        let price_feed_created = contract.create_price_feed_update_data(id, PRICE, CONF, EXPO, EMA_PRICE, EMA_CONF, publish_time, PREV_PUBLISH_TIME);    
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
            let price_feed_created = contract.create_price_feed_update_data(id, PRICE, CONF, EXPO, EMA_PRICE, EMA_CONF, publish_time, PREV_PUBLISH_TIME);    
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
        let _price_feed = contract.query_price_feed(id).expect_err("should not query if price feed does not exist");
    }

    #[motsu::test]
    fn can_get_valid_time_period(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let valid_time_period = contract.get_valid_time_period();
        assert_eq!(valid_time_period, U256::from(1000));
    }

    #[motsu::test]
    fn can_update_price_feeds(contract: MockPythContract) {
        let _ = contract.initialize(U256::from(1000), U256::from(1000));
        let id = generate_bytes();
        //let price_feed_created = contract.create_price_feed_update_data(id, PRICE, CONF, EXPO, EMA_PRICE, EMA_CONF, U256::from(1000), PREV_PUBLISH_TIME);    
        //let mut update_data: Vec<Bytes> = vec![];
        //update_data.push(Bytes::from(price_feed_created));
    }
}
