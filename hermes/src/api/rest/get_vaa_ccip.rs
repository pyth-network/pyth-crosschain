use {
    super::verify_price_ids_exist,
    crate::{
        aggregate::{
            RequestTime,
            UnixTimestamp,
        },
        api::rest::RestError,
    },
    anyhow::Result,
    axum::{
        extract::State,
        Json,
    },
    derive_more::{
        Deref,
        DerefMut,
    },
    pyth_sdk::PriceIdentifier,
    serde::{
        Deserialize,
        Serialize,
    },
    serde_qs::axum::QsQuery,
    utoipa::{
        IntoParams,
        ToSchema,
    },
};

#[derive(Clone, Debug, Deref, DerefMut, Deserialize, Serialize, ToSchema)]
pub struct GetVaaCcipInput(#[serde(with = "crate::serde::hex")] [u8; 40]);

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct GetVaaCcipQueryParams {
    data: GetVaaCcipInput,
}

#[derive(Debug, serde::Serialize, ToSchema)]
pub struct GetVaaCcipResponse {
    data: String, // TODO: Use a typed wrapper for the hex output with leading 0x.
}

/// Get a VAA for a price feed using CCIP
///
/// This endpoint accepts a single argument which is a hex-encoded byte string of the following form:
/// `<price feed id (32 bytes> <publish time as unix timestamp (8 bytes, big endian)>`
#[utoipa::path(
    get,
    path = "/api/get_vaa_ccip",
    responses(
        (status = 200, description = "Price update retrieved successfully", body = GetVaaCcipResponse)
    ),
    params(
        GetVaaCcipQueryParams
    )
)]
pub async fn get_vaa_ccip(
    State(state): State<crate::api::ApiState>,
    QsQuery(params): QsQuery<GetVaaCcipQueryParams>,
) -> Result<Json<GetVaaCcipResponse>, RestError> {
    let price_id: PriceIdentifier = PriceIdentifier::new(
        params.data[0..32]
            .try_into()
            .map_err(|_| RestError::InvalidCCIPInput)?,
    );
    let publish_time = UnixTimestamp::from_be_bytes(
        params.data[32..40]
            .try_into()
            .map_err(|_| RestError::InvalidCCIPInput)?,
    );

    verify_price_ids_exist(&state, &[price_id]).await?;

    let price_feeds_with_update_data = crate::aggregate::get_price_feeds_with_update_data(
        &*state.state,
        &[price_id],
        RequestTime::FirstAfter(publish_time),
    )
    .await
    .map_err(|e| {
        tracing::warn!(
            "Error getting price feed {:?} with update data: {:?}",
            price_id,
            e
        );
        RestError::CcipUpdateDataNotFound
    })?;

    let bytes = price_feeds_with_update_data
        .update_data
        .get(0) // One price feed has only a single VAA as proof.
        .ok_or(RestError::UpdateDataNotFound)?;

    Ok(Json(GetVaaCcipResponse {
        data: format!("0x{}", hex::encode(bytes)),
    }))
}
