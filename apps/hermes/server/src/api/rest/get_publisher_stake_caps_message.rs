use {
    crate::{
        api::{
            rest::RestError,
            types::{
                BinaryPriceUpdate,
                EncodingType,
            },
            ApiState,
        },
        state::Aggregates,
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
    },
    serde::Deserialize,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct GetPublisherStakeCapsMessageQueryParams {
    /// Optional encoding type. If true, return the message in the encoding specified by the encoding parameter. Default is `hex`.
    #[serde(default)]
    encoding: EncodingType,
}

/// Get the publisher stake caps message
///
#[utoipa::path(
    get,
    path = "/api/get_publisher_stake_caps_message",
    responses(
        (status = 200, description = "Publisher stake caps message retrieved succesfully", body = Vec<PriceFeedMetadata>)
    ),
    params(
        GetPublisherStakeCapsMessageQueryParams
    )
)]
pub async fn get_publisher_stake_caps_message<S>(
    State(state): State<ApiState<S>>,
    QsQuery(params): QsQuery<GetPublisherStakeCapsMessageQueryParams>,
) -> Result<Json<BinaryPriceUpdate>, RestError>
where
    S: Aggregates,
{
    let state = &state.state;
    let publisher_update_caps_data =
        state
            .get_publisher_stake_caps_update_data()
            .await
            .map_err(|e| {
                tracing::warn!("RPC connection error: {}", e);
                RestError::RpcConnectionError {
                    message: format!("RPC connection error: {}", e),
                }
            })?;

    let encoded_data: Vec<String> = publisher_update_caps_data
        .into_iter()
        .map(|data| match params.encoding {
            EncodingType::Base64 => base64_standard_engine.encode(data),
            EncodingType::Hex => hex::encode(data),
        })
        .collect();

    let binary_price_update = BinaryPriceUpdate {
        encoding: params.encoding,
        data:     encoded_data,
    };

    Ok(Json(binary_price_update))
}
