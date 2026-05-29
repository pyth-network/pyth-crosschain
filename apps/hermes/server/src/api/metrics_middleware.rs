use {
    super::{token, ApiState},
    crate::state::metrics::Metrics,
    axum::{
        extract::{MatchedPath, State},
        http::Request,
        middleware::Next,
        response::IntoResponse,
    },
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{counter::Counter, family::Family, histogram::Histogram},
    },
    std::sync::Arc,
    tokio::time::Instant,
};

pub struct ApiMetrics {
    pub requests: Family<Labels, Counter>,
    pub latencies: Family<LatencyLabels, Histogram>,
    pub sse_broadcast_latency: Histogram,
    /// Number of SSE connections closed because the client could not keep up
    /// with the price update stream (slow consumer).
    pub sse_slow_consumer_disconnects: Counter,
    /// Number of SSE connections closed because they reached the 24h hard
    /// connection deadline.
    pub sse_connection_timeouts: Counter,
}

impl ApiMetrics {
    pub fn new<S>(state: Arc<S>) -> Self
    where
        S: Metrics,
        S: Send + Sync + 'static,
    {
        let new = Self {
            requests: Family::default(),
            latencies: Family::new_with_constructor(|| {
                Histogram::new(
                    [
                        0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0,
                    ]
                    .into_iter(),
                )
            }),
            sse_broadcast_latency: Histogram::new(
                [
                    0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0,
                ]
                .into_iter(),
            ),
            sse_slow_consumer_disconnects: Counter::default(),
            sse_connection_timeouts: Counter::default(),
        };

        {
            let requests = new.requests.clone();
            let latencies = new.latencies.clone();
            let sse_broadcast_latency = new.sse_broadcast_latency.clone();
            let sse_slow_consumer_disconnects = new.sse_slow_consumer_disconnects.clone();
            let sse_connection_timeouts = new.sse_connection_timeouts.clone();

            tokio::spawn(async move {
                Metrics::register(
                    &*state,
                    ("api_requests", "Total number of API requests", requests),
                )
                .await;

                Metrics::register(
                    &*state,
                    (
                        "api_request_latency_seconds",
                        "API request latency in seconds",
                        latencies,
                    ),
                )
                .await;

                Metrics::register(
                    &*state,
                    (
                        "sse_broadcast_latency_seconds",
                        "Latency from Hermes receive_time to SSE send in seconds",
                        sse_broadcast_latency,
                    ),
                )
                .await;

                Metrics::register(
                    &*state,
                    (
                        "sse_slow_consumer_disconnects",
                        "Number of SSE connections closed due to a slow consumer",
                        sse_slow_consumer_disconnects,
                    ),
                )
                .await;

                Metrics::register(
                    &*state,
                    (
                        "sse_connection_timeouts",
                        "Number of SSE connections closed after reaching the 24h deadline",
                        sse_connection_timeouts,
                    ),
                )
                .await;
            });
        }

        new
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, EncodeLabelSet)]
pub struct Labels {
    pub method: String,
    pub path: String,
    pub status: u16,
    /// Last 4 characters of the API token, or "none" if no token provided
    pub token_suffix: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, EncodeLabelSet)]
pub struct LatencyLabels {
    pub method: String,
    pub path: String,
    pub status: u16,
}

pub async fn track_metrics<B, S>(
    State(api_state): State<ApiState<S>>,
    req: Request<B>,
    next: Next<B>,
) -> impl IntoResponse {
    let start = Instant::now();
    let path = if let Some(matched_path) = req.extensions().get::<MatchedPath>() {
        matched_path.as_str().to_owned()
    } else {
        req.uri().path().to_owned()
    };

    let method = req.method().clone();

    // Extract the token from the request
    let token = token::extract_token_from_headers_and_uri(req.headers(), req.uri());
    let token_suffix = token::get_token_suffix(token.as_deref());

    let response = next.run(req).await;
    let latency = start.elapsed().as_secs_f64();
    let status = response.status().as_u16();
    let labels = Labels {
        method: method.to_string(),
        path: path.clone(),
        status,
        token_suffix,
    };
    let latency_labels = LatencyLabels {
        method: method.to_string(),
        path,
        status,
    };

    api_state.metrics.requests.get_or_create(&labels).inc();
    api_state
        .metrics
        .latencies
        .get_or_create(&latency_labels)
        .observe(latency);

    response
}
