use axum::{response::IntoResponse, Json};

/// This is the index page for the REST service. It lists all the available endpoints.
///
/// TODO: Dynamically generate this list if possible.
pub async fn index() -> impl IntoResponse {
    Json([
        "/live",
        "/ready",
        "/api/price_feed_ids",
        "/api/latest_price_feeds?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..(&verbose=true)(&binary=true)",
        "/api/latest_vaas?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&...",
        "/api/get_price_feed?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>(&verbose=true)(&binary=true)",
        "/api/get_vaa?id=<price_feed_id>&publish_time=<publish_time_in_unix_timestamp>",
        "/api/get_vaa_ccip?data=<0x<price_feed_id_32_bytes>+<publish_time_unix_timestamp_be_8_bytes>>",

        "/v2/updates/price/latest?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..(&encoding=hex|base64)(&parsed=false)",
        "/v2/updates/price/stream?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..(&encoding=hex|base64)(&parsed=false)(&allow_unordered=false)(&benchmarks_only=false)",
        "/v2/updates/price/<timestamp>?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..(&encoding=hex|base64)(&parsed=false)",
        "/v2/price_feeds?(query=btc)(&asset_type=crypto|equity|fx|metal|rates)",
        "/v2/updates/twap/<window_seconds>/latest?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..(&encoding=hex|base64)(&parsed=false)",
        "/v2/updates/twap/<window_seconds>/<timestamp>?ids[]=<price_feed_id>&ids[]=<price_feed_id_2>&..(&encoding=hex|base64)(&parsed=false)",
    ])
}
