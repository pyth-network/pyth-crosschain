use {
    crate::api::ChainId,
    anyhow::Result,
    axum::async_trait,
    ethers::{
        prelude::Http,
        providers::{HttpClientError, JsonRpcClient, Provider},
    },
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{counter::Counter, family::Family, histogram::Histogram},
        registry::Registry,
    },
    std::{str::FromStr, sync::Arc},
    tokio::{sync::RwLock, time::Instant},
    tracing,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, EncodeLabelSet)]
pub struct RpcLabel {
    chain_id: ChainId,
    method: String,
}

#[derive(Debug)]
pub struct RpcMetrics {
    count: Family<RpcLabel, Counter>,
    latency: Family<RpcLabel, Histogram>,
    errors_count: Family<RpcLabel, Counter>,
    unrecoverable_errors_count: Family<RpcLabel, Counter>,
}

impl RpcMetrics {
    pub async fn new(metrics_registry: Arc<RwLock<Registry>>) -> Self {
        let count = Family::default();
        let mut guard = metrics_registry.write().await;
        let sub_registry = guard.sub_registry_with_prefix("rpc_requests");
        sub_registry.register(
            "count",
            "The number of RPC requests made to the chain with the specified method.",
            count.clone(),
        );

        let latency = Family::<RpcLabel, Histogram>::new_with_constructor(|| {
            Histogram::new(
                [
                    0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0,
                ]
                .into_iter(),
            )
        });
        sub_registry.register(
            "latency",
            "The latency of RPC requests to the chain with the specified method.",
            latency.clone(),
        );

        let errors_count = Family::default();
        sub_registry.register(
            "errors_count",
            "The number of RPC requests made to the chain that failed.",
            errors_count.clone(),
        );

        let unrecoverable_errors_count = Family::default();
        sub_registry.register(
            "unrecoverable_errors_count",
            "The number of RPC requests made to the chain that failed with unrecoverable errors.",
            unrecoverable_errors_count.clone(),
        );

        Self {
            count,
            latency,
            errors_count,
            unrecoverable_errors_count,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TracedClient {
    inner: Http,

    chain_id: ChainId,
    metrics: Arc<RpcMetrics>,
}

#[async_trait]
impl JsonRpcClient for TracedClient {
    type Error = HttpClientError;

    async fn request<
        T: serde::Serialize + Send + Sync + std::fmt::Debug,
        R: serde::de::DeserializeOwned + Send,
    >(
        &self,
        method: &str,
        params: T,
    ) -> Result<R, HttpClientError> {
        let start = Instant::now();
        let label = &RpcLabel {
            chain_id: self.chain_id.clone(),
            method: method.to_string(),
        };
        self.metrics.count.get_or_create(label).inc();
        let res = match self.inner.request(method, params).await {
            Ok(result) => Ok(result),
            Err(e) => {
                // Always increment the total error count for metrics
                self.metrics.errors_count.get_or_create(label).inc();

                // Only log unrecoverable errors
                if self.is_unrecoverable_error(&e) {
                    self.metrics
                        .unrecoverable_errors_count
                        .get_or_create(label)
                        .inc();
                    tracing::error!("Unrecoverable RPC error: {:?}", e);
                } else {
                    // For recoverable errors, just log at debug level
                    tracing::debug!("Recoverable RPC error (will retry): {:?}", e);
                }

                Err(e)
            }
        };

        let latency = start.elapsed().as_secs_f64();
        self.metrics.latency.get_or_create(label).observe(latency);
        res
    }
}

impl TracedClient {
    pub fn new(
        chain_id: ChainId,
        url: &str,
        metrics: Arc<RpcMetrics>,
    ) -> Result<Provider<TracedClient>> {
        Ok(Provider::new(TracedClient {
            inner: Http::from_str(url)?,
            chain_id,
            metrics,
        }))
    }

    // Helper method to determine if an error is unrecoverable
    fn is_unrecoverable_error(&self, error: &HttpClientError) -> bool {
        // Errors that are considered unrecoverable:
        // - Authentication errors
        // - Invalid request errors
        // - Method not found errors
        // - Other errors that are not related to network or server issues
        match error {
            HttpClientError::ReqwestError(e) => {
                // Network errors are typically recoverable
                !e.is_timeout() && !e.is_connect() && !e.is_request()
            }
            HttpClientError::JsonRpcError(e) => {
                // JSON-RPC errors with codes that indicate client errors are unrecoverable
                // Codes -32700 to -32600 are parse errors and invalid requests
                // Codes -32601 to -32603 are method not found, invalid params, and internal errors
                let code = e.code;
                (-32700..=-32600).contains(&code)
            }
            _ => true, // Consider other errors as unrecoverable by default
        }
    }
}
