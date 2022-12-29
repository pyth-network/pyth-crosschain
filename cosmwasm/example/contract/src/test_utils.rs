
use {
    cosmwasm_std::{
        from_binary,
        to_binary,
        Binary,
        ContractResult,
        QuerierResult,
        SystemError,
        SystemResult,
    },
    pyth_sdk_cw::{
        PriceFeed,
        PriceFeedResponse,
        PriceIdentifier,
        PriceStatus,
    },
    std::collections::HashMap,
};

pub fn make_feed(id: PriceIdentifier) -> PriceFeed {
    PriceFeed::new(
        id,
        PriceStatus::Trading,
        100,
        -2,
        32,
        3,
        id,
        100 * 100,
        100,
        75 * 100,
        100,
        99 * 100,
        100,
        99,
    )
}

pub struct MockPyth {
    pub feeds: HashMap<PriceIdentifier, PriceFeed>,
}

impl MockPyth {
    pub fn new(feeds: &[PriceFeed]) -> Self {
        let mut feeds_map = HashMap::new();
        for feed in feeds {
            feeds_map.insert(feed.id, *feed);
        }

        MockPyth { feeds: feeds_map }
    }

    pub fn handle_wasm_query(&self, msg: &Binary) -> QuerierResult {
        let query_msg = from_binary::<pyth_sdk_cw::QueryMsg>(msg);
        match query_msg {
            Ok(pyth_sdk_cw::QueryMsg::PriceFeed { id }) => match self.feeds.get(&id) {
                Some(feed) => SystemResult::Ok(ContractResult::Ok(
                    to_binary(&PriceFeedResponse {
                        price_feed: *feed,
                    })
                    .unwrap(),
                )),
                None => SystemResult::Ok(ContractResult::Err("unknown price feed".into())),
            },
            Err(_e) => SystemResult::Err(SystemError::InvalidRequest {
                error:   "Invalid message".into(),
                request: msg.clone(),
            }),
        }
    }
}
