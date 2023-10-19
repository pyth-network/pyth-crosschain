use {
    super::verify_price_ids_exist,
    crate::{
        aggregate::RequestTime,
        api::{
            rest::RestError,
            types::PriceIdInput,
        },
        state::cache::AggregateCache,
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    pyth_sdk::PriceIdentifier,
    pythnet_sdk::messages::{
        Message,
        MessageType,
    },
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct LatestTwapUpdatesQueryParams {
    /// Get the most recent price update for this set of price feed ids.
    ///
    /// This parameter can be provided multiple times to retrieve multiple price updates,
    /// for example see the following query string:
    ///
    /// ```
    /// ?ids[]=a12...&ids[]=b4c...
    /// ```
    #[param(rename = "ids[]")]
    #[param(example = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43")]
    ids: Vec<PriceIdInput>,
}

pub async fn latest_twap_updates(
    State(state): State<crate::api::ApiState>,
    QsQuery(params): QsQuery<LatestTwapUpdatesQueryParams>,
) -> Result<Json<Vec<Message>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();

    verify_price_ids_exist(&state, &price_ids).await?;

    state
        .state
        .fetch_message_states(
            price_ids
                .iter()
                .map(|price_id| price_id.to_bytes())
                .collect(),
            RequestTime::Latest,
            crate::state::cache::MessageStateFilter::Only(MessageType::TwapMessage),
        )
        .await
        .map_err(|_| RestError::UpdateDataNotFound)
        .map(|messages| Json(messages.iter().map(|message| message.message).collect()))
}
