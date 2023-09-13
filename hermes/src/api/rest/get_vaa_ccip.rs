use {
    crate::{
        api::rest::RestError,
        impl_deserialize_for_hex_string_wrapper,
        store::types::{
            RequestTime,
            UnixTimestamp,
        },
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
    serde_qs::axum::QsQuery,
    utoipa::{
        IntoParams,
        ToSchema,
    },
};

#[derive(Debug, Clone, Deref, DerefMut, ToSchema)]
pub struct GetVaaCcipInput([u8; 40]);
impl_deserialize_for_hex_string_wrapper!(GetVaaCcipInput, 40);

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
    State(state): State<crate::api::State>,
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

    let price_feeds_with_update_data = crate::store::get_price_feeds_with_update_data(
        &state.store,
        vec![price_id],
        RequestTime::FirstAfter(publish_time),
    )
    .await
    .map_err(|_| RestError::CcipUpdateDataNotFound)?;

    let bytes = price_feeds_with_update_data
        .update_data
        .get(0) // One price feed has only a single VAA as proof.
        .ok_or(RestError::UpdateDataNotFound)?;

    Ok(Json(GetVaaCcipResponse {
        data: format!("0x{}", hex::encode(bytes)),
    }))
}
