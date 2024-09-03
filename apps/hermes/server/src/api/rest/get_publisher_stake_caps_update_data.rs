use {
    crate::{
        api::{
            rest::RestError,
            types::{
                BinaryUpdate,
                EncodingType,
                GetPublisherStakeCapsUpdateDataResponse,
                ParsedPublisherStakeCapsUpdate,
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
pub struct GetPublisherStakeCapsUpdateData {
    /// Optional encoding type. If true, return the message in the encoding specified by the encoding parameter. Default is `hex`.
    #[serde(default)]
    encoding: EncodingType,

    /// If true, include the parsed update in the `parsed` field of each returned feed. Default is `true`.
    #[serde(default = "default_true")]
    parsed: bool,
}

fn default_true() -> bool {
    true
}


/// Get the publisher stake caps update data
#[utoipa::path(
    get,
    path = "/api/get_publisher_stake_caps_update_data",
    responses(
        (status = 200, description = "Publisher stake caps update data retrieved succesfully", body = Vec<PriceFeedMetadata>)
    ),
    params(
        GetPublisherStakeCapsUpdateData
    )
)]
pub async fn get_publisher_stake_caps_update_data<S>(
    State(state): State<ApiState<S>>,
    QsQuery(params): QsQuery<GetPublisherStakeCapsUpdateData>,
) -> Result<Json<GetPublisherStakeCapsUpdateDataResponse>, RestError>
where
    S: Aggregates,
{
    let state = &*state.state;
    let publisher_stake_caps_with_update_data =
        Aggregates::get_publisher_stake_caps_with_update_data(state)
            .await
            .map_err(|e| {
                tracing::warn!(
                    "Error getting publisher stake caps with update data: {:?}",
                    e
                );
                RestError::UpdateDataNotFound
            })?;

    let encoded_data: Vec<String> = publisher_stake_caps_with_update_data
        .update_data
        .into_iter()
        .map(|data| match params.encoding {
            EncodingType::Base64 => base64_standard_engine.encode(data),
            EncodingType::Hex => hex::encode(data),
        })
        .collect();

    let binary = BinaryUpdate {
        encoding: params.encoding,
        data:     encoded_data,
    };

    let parsed: Option<Vec<ParsedPublisherStakeCapsUpdate>> = if params.parsed {
        Some(publisher_stake_caps_with_update_data.publisher_stake_caps)
    } else {
        None
    };

    Ok(Json(GetPublisherStakeCapsUpdateDataResponse {
        binary,
        parsed,
    }))
}
