use std::net::SocketAddr;

use pyth_lazer_protocol::publisher::{PriceFeedDataV1, PriceFeedDataV2};
use pyth_lazer_publisher_sdk::publisher_update::feed_update::Update;
use pyth_lazer_publisher_sdk::publisher_update::{FeedUpdate, FundingRateUpdate, PriceUpdate};

use crate::{http_server, lazer_publisher::LazerPublisher};
use crate::config::Config;
use crate::http_server::InnerHandlerResult;

#[derive(Debug, Copy, Clone)]
pub struct PublisherConnectionContext {
    pub request_type: http_server::PublisherRequest,
    pub _remote_addr: SocketAddr,
}


pub(crate) fn publisher_inner_handler(_: Config, receive_buf: Vec<u8>, lazer_publisher: LazerPublisher, context: PublisherConnectionContext) -> InnerHandlerResult {
    Box::pin(async move {
        // reply with an error if we can't parse the binary update
        let feed_update: FeedUpdate = match context.request_type {
            http_server::PublisherRequest::PublisherV1 => {
                let (data, _) = bincode::serde::decode_from_slice::<PriceFeedDataV1, _>(
                    &receive_buf,
                    bincode::config::legacy(),
                )?;

                FeedUpdate {
                    feed_id: Some(data.price_feed_id.0),
                    source_timestamp: data.source_timestamp_us.into(),
                    update: Some(Update::PriceUpdate(PriceUpdate {
                        price: data.price.map(|p| p.0.get()),
                        best_bid_price: data.best_bid_price.map(|p| p.0.get()),
                        best_ask_price: data.best_ask_price.map(|p| p.0.get()),
                        ..PriceUpdate::default()
                    })),
                    special_fields: Default::default(),
                }
            }
            http_server::PublisherRequest::PublisherV2 => {
                let (data, _) = bincode::serde::decode_from_slice::<PriceFeedDataV2, _>(
                    &receive_buf,
                    bincode::config::legacy(),
                )?;

                FeedUpdate {
                    feed_id: Some(data.price_feed_id.0),
                    source_timestamp: data.source_timestamp_us.into(),
                    update: Some(Update::FundingRateUpdate(FundingRateUpdate {
                        price: data.price.map(|p| p.0.get()),
                        rate: data.funding_rate.map(|r| r.0),
                        ..FundingRateUpdate::default()
                    })),
                    special_fields: Default::default(),
                }
            }
        };

        lazer_publisher.push_feed_update(feed_update).await?;
        Ok(None)
    })
}
