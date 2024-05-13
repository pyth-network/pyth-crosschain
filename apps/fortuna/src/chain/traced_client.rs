use {
    crate::api::ChainId,
    anyhow::Result,
    axum::async_trait,
    ethers::{
        prelude::Http,
        providers::{
            HttpClientError,
            JsonRpcClient,
            Provider,
        },
    },
    prometheus_client::{
        encoding::EncodeLabelSet,
        metrics::{
            counter::Counter,
            family::Family,
            histogram::Histogram,
        },
        registry::Registry,
    },
    std::sync::Arc,
    tokio::{
        sync::RwLock,
        time::Instant,
    },
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, EncodeLabelSet)]
pub struct ChainLabel {
    chain_id: ChainId,
}

#[derive(Debug)]
pub struct TracedClient {
    inner: Http,

    chain_id:                  ChainId,
    rpc_requests_count:        Family<ChainLabel, Counter>,
    rpc_requests_latency:      Family<ChainLabel, Histogram>,
    rpc_requests_errors_count: Family<ChainLabel, Counter>,
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
        self.rpc_requests_count
            .get_or_create(&ChainLabel {
                chain_id: self.chain_id.clone(),
            })
            .inc();
        let res = match self.inner.request(method, params).await {
            Ok(result) => Ok(result),
            Err(e) => {
                self.rpc_requests_errors_count
                    .get_or_create(&ChainLabel {
                        chain_id: self.chain_id.clone(),
                    })
                    .inc();
                Err(e)
            }
        };

        let latency = start.elapsed().as_secs_f64();
        println!(
            "RPC request to {:?} took {:.2} seconds",
            self.chain_id, latency
        );
        self.rpc_requests_latency
            .get_or_create(&ChainLabel {
                chain_id: self.chain_id.clone(),
            })
            .observe(latency);
        res
    }
}

impl TracedClient {
    pub async fn new_provider(
        chain_id: ChainId,
        url: &str,
        metrics_registry: Arc<RwLock<Registry>>,
    ) -> Result<Provider<TracedClient>> {
        let mut writable_registry = metrics_registry.write().await;

        let rpc_requests_count = Family::default();
        writable_registry.register(
            "rpc_requests_count",
            "The number of RPC requests made to the chain.",
            rpc_requests_count.clone(),
        );

        let rpc_requests_latency = Family::<ChainLabel, Histogram>::new_with_constructor(|| {
            Histogram::new(
                [
                    0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0,
                ]
                .into_iter(),
            )
        });
        writable_registry.register(
            "rpc_requests_latency",
            "The latency of RPC requests to the chain.",
            rpc_requests_latency.clone(),
        );

        let rpc_requests_errors_count = Family::default();
        writable_registry.register(
            "rpc_requests_errors_count",
            "The number of RPC requests made to the chain that failed.",
            rpc_requests_errors_count.clone(),
        );

        let url = url::Url::parse(url)?;
        Ok(Provider::new(TracedClient {
            inner: Http::new(url),
            chain_id,
            rpc_requests_count,
            rpc_requests_latency,
            rpc_requests_errors_count,
        }))
    }
}
