use {
    crate::{
        api::{
            rest::RestError,
            types::PriceIdInput,
        },
        doc_examples,
        store::types::RequestTime,
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
    pyth_sdk::PriceIdentifier,
    serde_qs::axum::QsQuery,
    utoipa::IntoParams,
};

#[derive(Debug, serde::Deserialize, IntoParams)]
#[into_params(parameter_in=Query)]
pub struct LatestVaasQueryParams {
    /// Get the VAAs for this set of price feed ids.
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


/// Get VAAs for a set of price feed ids.
///
/// Given a collection of price feed ids, retrieve the latest VAA for each. The returned VAA(s) can
/// be submitted to the Pyth contract to update the on-chain price. If VAAs are not found for every
/// provided price ID the call will fail.
#[utoipa::path(
    get,
    path = "/api/latest_vaas",
    params(
        LatestVaasQueryParams
    ),
    responses(
        (status = 200, description = "VAAs retrieved successfully", body = Vec<String>, example=json!([doc_examples::vaa_example()]))
    ),
)]
pub async fn latest_vaas(
    State(state): State<crate::api::State>,
    QsQuery(params): QsQuery<LatestVaasQueryParams>,
) -> Result<Json<Vec<String>>, RestError> {
    let price_ids: Vec<PriceIdentifier> = params.ids.into_iter().map(|id| id.into()).collect();
    let price_feeds_with_update_data = crate::store::get_price_feeds_with_update_data(
        &*state.store,
        price_ids,
        RequestTime::Latest,
    )
    .await
    .map_err(|_| RestError::UpdateDataNotFound)?;

    Ok(Json(
        price_feeds_with_update_data
            .update_data
            .iter()
            .map(|bytes| base64_standard_engine.encode(bytes)) // TODO: Support multiple
            // encoding formats
            .collect(),
    ))
}
