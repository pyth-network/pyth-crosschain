use alloy::primitives::Bytes;
use alloy::rpc::types::Filter;
use alloy::rpc::types::Log;
use alloy::sol;
use alloy::sol_types::SolEvent;
use eyre::Result;

use crate::types::UnixTimestamp;

sol!(
    #[allow(missing_docs)]
    PriceUpdater,
    "abi/PriceUpdater.abi.json"
);

#[derive(Debug, Clone)]
pub struct PriceUpdate {
    pub publish_time: UnixTimestamp,
    pub price_ids: Vec<[u8; 32]>,
    pub client_context: Bytes,
}

impl PriceUpdate {
    pub fn filter() -> Filter {
        Filter::new().event(&PriceUpdater::PriceUpdate::SIGNATURE.to_string())
    }

    pub fn decode_log(log: &Log) -> Result<Self> {
        let PriceUpdater::PriceUpdate {
            publish_time,
            price_ids,
            client_context,
        } = log.log_decode()?.inner.data;

        Ok(Self {
            publish_time: UnixTimestamp::from(publish_time),
            price_ids: price_ids.into_iter().map(|id| id.into()).collect(),
            client_context,
        })
    }
}
