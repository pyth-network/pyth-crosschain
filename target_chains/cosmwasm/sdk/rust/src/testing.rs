use {
    crate::{error::PythContractError, PriceFeed, PriceFeedResponse, PriceIdentifier, QueryMsg},
    cosmwasm_std::{
        from_binary, to_binary, Binary, Coin, ContractResult, QuerierResult, SystemError,
        SystemResult,
    },
    std::{collections::HashMap, time::Duration},
};

/// Mock version of Pyth for testing cosmwasm contracts.
/// This mock stores some price feeds and responds to query messages.
#[derive(Clone)]
pub struct MockPyth {
    pub valid_time_period: Duration,
    pub fee_per_vaa: Coin,
    pub feeds: HashMap<PriceIdentifier, PriceFeed>,
}

impl MockPyth {
    /// Create a new `MockPyth`. You can either provide the full list of price feeds up front,
    /// or add them later via `add_feed`.
    pub fn new(valid_time_period: Duration, fee_per_vaa: Coin, feeds: &[PriceFeed]) -> Self {
        let mut feeds_map = HashMap::new();
        for feed in feeds {
            feeds_map.insert(feed.id, *feed);
        }

        MockPyth {
            valid_time_period,
            fee_per_vaa,
            feeds: feeds_map,
        }
    }

    /// Add a price feed that will be returned on queries.
    pub fn add_feed(&mut self, feed: PriceFeed) {
        self.feeds.insert(feed.id, feed);
    }

    /// Handler for processing query messages.
    /// See the tests in `contract.rs`
    /// `https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/cosmwasm/examples/cw-contract/src/contract.rs#L13`
    /// for how to use this handler within your tests.
    pub fn handle_wasm_query(&self, msg: &Binary) -> QuerierResult {
        let query_msg = from_binary::<QueryMsg>(msg);
        match query_msg {
            Ok(QueryMsg::PriceFeed { id }) => match self.feeds.get(&id) {
                Some(feed) => {
                    SystemResult::Ok(to_binary(&PriceFeedResponse { price_feed: *feed }).into())
                }
                None => SystemResult::Ok(ContractResult::from(Err(
                    PythContractError::PriceFeedNotFound,
                ))),
            },
            Ok(QueryMsg::GetValidTimePeriod) => {
                SystemResult::Ok(to_binary(&self.valid_time_period).into())
            }

            Ok(QueryMsg::GetUpdateFee { vaas }) => {
                let new_amount = self
                    .fee_per_vaa
                    .amount
                    .u128()
                    .checked_mul(vaas.len() as u128)
                    .unwrap();
                SystemResult::Ok(to_binary(&Coin::new(new_amount, &self.fee_per_vaa.denom)).into())
            }
            #[cfg(feature = "osmosis")]
            Ok(QueryMsg::GetUpdateFeeForDenom { vaas, denom }) => {
                let new_amount = self
                    .fee_per_vaa
                    .amount
                    .u128()
                    .checked_mul(vaas.len() as u128)
                    .unwrap();
                SystemResult::Ok(to_binary(&Coin::new(new_amount, denom)).into())
            }
            Err(_e) => SystemResult::Err(SystemError::InvalidRequest {
                error: "Invalid message".into(),
                request: msg.clone(),
            }),
        }
    }
}
