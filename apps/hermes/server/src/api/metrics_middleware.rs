use {
    super::ApiState,
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
    pub latencies: Family<Labels, Histogram>,
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
        };

        {
            let requests = new.requests.clone();
            let latencies = new.latencies.clone();

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
    let response = next.run(req).await;
    let latency = start.elapsed().as_secs_f64();
    let status = response.status().as_u16();
    let labels = Labels {
        method: method.to_string(),
        path,
        status,
    };

    api_state.metrics.requests.get_or_create(&labels).inc();
    api_state
        .metrics
        .latencies
        .get_or_create(&labels)
        .observe(latency);

    response
}
