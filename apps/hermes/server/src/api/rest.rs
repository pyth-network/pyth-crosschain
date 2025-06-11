use {
    super::ApiState,
    crate::state::aggregate::Aggregates,
    axum::{
        http::StatusCode,
        response::{IntoResponse, Response},
    },
    pyth_sdk::PriceIdentifier,
};

mod get_price_feed;
mod get_vaa;
mod get_vaa_ccip;
mod index;
mod latest_price_feeds;
mod latest_vaas;
mod live;
mod price_feed_ids;
mod ready;
mod v2;

pub use {
    get_price_feed::*,
    get_vaa::*,
    get_vaa_ccip::*,
    index::*,
    latest_price_feeds::*,
    latest_vaas::*,
    live::*,
    price_feed_ids::*,
    ready::*,
    v2::{
        latest_price_updates::*, latest_publisher_stake_caps::*, latest_twaps::*,
        price_feeds_metadata::*, sse::*, timestamp_price_updates::*,
    },
};

#[derive(Debug)]
pub enum RestError {
    BenchmarkPriceNotUnique,
    UpdateDataNotFound,
    CcipUpdateDataNotFound,
    InvalidCCIPInput,
    PriceIdsNotFound { missing_ids: Vec<PriceIdentifier> },
    RpcConnectionError { message: String },
}

impl IntoResponse for RestError {
    fn into_response(self) -> Response {
        match self {
            RestError::BenchmarkPriceNotUnique => {
                (StatusCode::NOT_FOUND, "Benchmark price is not unique").into_response()
            }
            RestError::UpdateDataNotFound => {
                (StatusCode::NOT_FOUND, "Update data not found").into_response()
            }
            RestError::CcipUpdateDataNotFound => {
                // Return "Bad Gateway" error because CCIP expects a 5xx error if it needs to retry
                // or try other endpoints. "Bad Gateway" seems the best choice here as this is not
                // an internal error and could happen on two scenarios:
                //
                // 1. DB Api is not responding well (Bad Gateway is appropriate here)
                // 2. Publish time is a few seconds before current time and a VAA Will be available
                //    in a few seconds. So we want the client to retry.
                (StatusCode::BAD_GATEWAY, "CCIP update data not found").into_response()
            }
            RestError::InvalidCCIPInput => {
                (StatusCode::BAD_REQUEST, "Invalid CCIP input").into_response()
            }
            RestError::PriceIdsNotFound { missing_ids } => {
                let missing_ids = missing_ids
                    .into_iter()
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
                    .join(", ");

                (
                    StatusCode::NOT_FOUND,
                    format!("Price ids not found: {}", missing_ids),
                )
                    .into_response()
            }
            RestError::RpcConnectionError { message } => {
                (StatusCode::INTERNAL_SERVER_ERROR, message).into_response()
            }
        }
    }
}

/// Validate that the passed in price_ids exist in the aggregate state. Return a Vec of valid price ids.
/// # Returns
/// If `remove_invalid` is true, invalid price ids are filtered out and only valid price ids are returned.
/// If `remove_invalid` is false and any passed in IDs are invalid, an error is returned.
pub async fn validate_price_ids<S>(
    state: &ApiState<S>,
    price_ids: &[PriceIdentifier],
    remove_invalid: bool,
) -> Result<Vec<PriceIdentifier>, RestError>
where
    S: Aggregates,
{
    let state = &*state.state;
    let available_ids = Aggregates::get_price_feed_ids(state).await;

    // Partition into (valid_ids, invalid_ids)
    let (valid_ids, invalid_ids): (Vec<_>, Vec<_>) = price_ids
        .iter()
        .copied()
        .partition(|id| available_ids.contains(id));

    if invalid_ids.is_empty() || remove_invalid {
        // All IDs are valid
        Ok(valid_ids)
    } else {
        // Return error with list of missing IDs
        Err(RestError::PriceIdsNotFound {
            missing_ids: invalid_ids,
        })
    }
}
#[cfg(test)]
#[allow(clippy::unwrap_used, reason = "tests")]
mod tests {
    use {
        super::*,
        crate::state::{
            aggregate::{
                AggregationEvent, PriceFeedsWithUpdateData, PublisherStakeCapsWithUpdateData,
                ReadinessMetadata, RequestTime, TwapsWithUpdateData, Update,
            },
            benchmarks::BenchmarksState,
            cache::CacheState,
            metrics::MetricsState,
            price_feeds_metadata::PriceFeedMetaState,
        },
        anyhow::Result,
        std::{collections::HashSet, sync::Arc},
        tokio::sync::broadcast::Receiver,
    };

    // Simplified mock that only contains what we need
    struct MockAggregates {
        available_ids: HashSet<PriceIdentifier>,
    }

    // Implement all required From traits with unimplemented!()
    impl<'a> From<&'a MockAggregates> for &'a CacheState {
        fn from(_: &'a MockAggregates) -> Self {
            unimplemented!("Not needed for this test")
        }
    }

    impl<'a> From<&'a MockAggregates> for &'a BenchmarksState {
        fn from(_: &'a MockAggregates) -> Self {
            unimplemented!("Not needed for this test")
        }
    }

    impl<'a> From<&'a MockAggregates> for &'a PriceFeedMetaState {
        fn from(_: &'a MockAggregates) -> Self {
            unimplemented!("Not needed for this test")
        }
    }

    impl<'a> From<&'a MockAggregates> for &'a MetricsState {
        fn from(_: &'a MockAggregates) -> Self {
            unimplemented!("Not needed for this test")
        }
    }

    #[async_trait::async_trait]
    impl Aggregates for MockAggregates {
        async fn get_price_feed_ids(&self) -> HashSet<PriceIdentifier> {
            self.available_ids.clone()
        }

        fn subscribe(&self) -> Receiver<AggregationEvent> {
            unimplemented!("Not needed for this test")
        }

        async fn is_ready(&self) -> (bool, ReadinessMetadata) {
            unimplemented!("Not needed for this test")
        }

        async fn store_update(&self, _update: Update) -> Result<()> {
            unimplemented!("Not needed for this test")
        }

        async fn get_price_feeds_with_update_data(
            &self,
            _price_ids: &[PriceIdentifier],
            _request_time: RequestTime,
        ) -> Result<PriceFeedsWithUpdateData> {
            unimplemented!("Not needed for this test")
        }

        async fn get_latest_publisher_stake_caps_with_update_data(
            &self,
        ) -> Result<PublisherStakeCapsWithUpdateData> {
            unimplemented!("Not needed for this test")
        }
        async fn get_twaps_with_update_data(
            &self,
            _price_ids: &[PriceIdentifier],
            _window_seconds: u64,
            _end_time: RequestTime,
        ) -> Result<TwapsWithUpdateData> {
            unimplemented!("Not needed for this test")
        }
    }

    #[tokio::test]
    async fn validate_price_ids_accepts_all_valid_ids() {
        let id1 = PriceIdentifier::new([1; 32]);
        let id2 = PriceIdentifier::new([2; 32]);

        let mut available_ids = HashSet::new();
        available_ids.insert(id1);
        available_ids.insert(id2);

        let mock_state = MockAggregates { available_ids };
        let api_state = ApiState::new(Arc::new(mock_state), vec![], String::new());

        let input_ids = vec![id1, id2];
        let result = validate_price_ids(&api_state, &input_ids, false).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), input_ids);
    }

    #[tokio::test]
    async fn validate_price_ids_removes_invalid_ids_when_requested() {
        let id1 = PriceIdentifier::new([1; 32]);
        let id2 = PriceIdentifier::new([2; 32]);
        let id3 = PriceIdentifier::new([3; 32]);

        let mut available_ids = HashSet::new();
        available_ids.insert(id1);
        available_ids.insert(id2);

        let mock_state = MockAggregates { available_ids };
        let api_state = ApiState::new(Arc::new(mock_state), vec![], String::new());

        let input_ids = vec![id1, id2, id3];
        let result = validate_price_ids(&api_state, &input_ids, true).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), vec![id1, id2]);
    }

    #[tokio::test]
    async fn validate_price_ids_errors_on_invalid_ids() {
        let id1 = PriceIdentifier::new([1; 32]);
        let id2 = PriceIdentifier::new([2; 32]);
        let id3 = PriceIdentifier::new([3; 32]);

        let mut available_ids = HashSet::new();
        available_ids.insert(id1);
        available_ids.insert(id2);

        let mock_state = MockAggregates { available_ids };
        let api_state = ApiState::new(Arc::new(mock_state), vec![], String::new());

        let input_ids = vec![id1, id2, id3];
        let result = validate_price_ids(&api_state, &input_ids, false).await;
        assert!(
            matches!(result, Err(RestError::PriceIdsNotFound { missing_ids }) if missing_ids == vec![id3])
        );
    }
}
