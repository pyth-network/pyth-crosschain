use std::{
    collections::HashMap,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Weak},
    time::Duration,
};

use anyhow::{bail, Context as _};
use arc_swap::ArcSwap;
use atomicwrites::replace_atomic;
use backoff::{exponential::ExponentialBackoff, future::retry_notify, SystemClock};
use futures::{stream::FuturesUnordered, StreamExt};
use pyth_lazer_protocol::{jrpc::SymbolMetadata, PriceFeedId};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tokio::{sync::mpsc, time::sleep};
use tracing::{info, warn};
use url::Url;

const DEFAULT_URLS: &[&str] = &["https://history.pyth-lazer.dourolabs.app/"];
const DEFAULT_UPDATE_INTERVAL: Duration = Duration::from_secs(30);
const DEFAULT_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// Configuration for the history client.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PythLazerHistoryClientConfig {
    /// URLs of the history services.
    #[serde(default = "default_urls")]
    pub urls: Vec<Url>,
    /// Interval of queries to the history services.
    /// Note: if the request fails, it will be retried using exponential backoff regardless of this setting.
    #[serde(with = "humantime_serde", default = "default_update_interval")]
    pub update_interval: Duration,
    /// Timeout of an individual request.
    #[serde(with = "humantime_serde", default = "default_request_timeout")]
    pub request_timeout: Duration,
    /// Path to the cache directory that can be used to provide latest data if history service is unavailable.
    pub cache_dir: Option<PathBuf>,
    /// Capacity of communication channels created by this client. It must be above zero.
    #[serde(default = "default_channel_capacity")]
    pub channel_capacity: usize,
}

fn default_urls() -> Vec<Url> {
    DEFAULT_URLS
        .iter()
        .map(|url| Url::parse(url).unwrap())
        .collect()
}

fn default_update_interval() -> Duration {
    Duration::from_secs(30)
}

fn default_request_timeout() -> Duration {
    Duration::from_secs(15)
}

fn default_channel_capacity() -> usize {
    1000
}

impl Default for PythLazerHistoryClientConfig {
    fn default() -> Self {
        Self {
            urls: default_urls(),
            update_interval: default_update_interval(),
            request_timeout: default_request_timeout(),
            cache_dir: None,
            channel_capacity: default_channel_capacity(),
        }
    }
}

/// Client to the history service API.
#[derive(Debug, Clone)]
pub struct PythLazerHistoryClient {
    config: Arc<PythLazerHistoryClientConfig>,
    client: reqwest::Client,
}

impl PythLazerHistoryClient {
    pub fn new(config: PythLazerHistoryClientConfig) -> Self {
        Self {
            config: Arc::new(config),
            client: reqwest::Client::builder()
                .timeout(DEFAULT_REQUEST_TIMEOUT)
                .build()
                .expect("failed to initialize reqwest"),
        }
    }

    fn symbols_cache_file_path(&self) -> Option<PathBuf> {
        self.config
            .cache_dir
            .as_ref()
            .map(|path| path.join("symbols_v1.json"))
    }

    /// Fetch current metadata for all symbols.
    pub async fn all_symbols_metadata(&self) -> anyhow::Result<Vec<SymbolMetadata>> {
        self.fetch_symbols_initial().await
    }

    /// Fetch metadata for all symbols as an auto-updating handle.
    ///
    /// Returns an error if the initial fetch failed.
    /// The returned `SymbolMetadataHandle` will be updated by a background task when the data changes.
    pub async fn all_symbols_metadata_handle(&self) -> anyhow::Result<SymbolMetadataHandle> {
        let symbols = Arc::new(
            self.fetch_symbols_initial()
                .await?
                .into_iter()
                .map(|f| (f.pyth_lazer_id, f))
                .collect::<HashMap<_, _>>(),
        );
        let previous_symbols = symbols.clone();
        let handle = Arc::new(ArcSwap::new(symbols));
        let client = self.clone();
        let weak_handle = Arc::downgrade(&handle);
        tokio::spawn(async move {
            client
                .update_symbols_handle(weak_handle, previous_symbols)
                .await;
        });
        Ok(SymbolMetadataHandle(handle))
    }

    /// Fetch metadata for all symbols as an auto-updating handle.
    ///
    /// The returned `SymbolMetadataHandle` will be updated by a background task when the data changes.
    /// If the initial fetch failed, the handle will initially contain an empty hashmap.
    pub async fn all_symbols_metadata_fault_tolerant_handle(&self) -> SymbolMetadataHandle {
        let initial_result = self.fetch_symbols_initial().await;
        let symbols = match initial_result {
            Ok(data) => data
                .into_iter()
                .map(|f| (f.pyth_lazer_id, f))
                .collect::<HashMap<_, _>>(),
            Err(err) => {
                warn!(
                    ?err,
                    "failed to fetch symbols, proceeding with empty symbol list"
                );
                HashMap::new()
            }
        };
        let symbols = Arc::new(symbols);
        let previous_symbols = symbols.clone();
        let handle = Arc::new(ArcSwap::new(symbols));
        let weak_handle = Arc::downgrade(&handle);
        let client = self.clone();
        tokio::spawn(async move {
            client
                .update_symbols_handle(weak_handle, previous_symbols)
                .await;
        });
        SymbolMetadataHandle(handle)
    }

    /// Fetch metadata for all symbols as a receiver.
    ///
    /// Returns an error if the initial fetch failed.
    /// On a successful return, the channel will always contain the initial data that can be fetched
    /// immediately from the returned receiver.
    /// You should continuously poll the receiver to receive updates.
    pub async fn all_symbols_metadata_stream(
        &self,
    ) -> anyhow::Result<mpsc::Receiver<Vec<SymbolMetadata>>> {
        if self.config.channel_capacity == 0 {
            bail!("channel_capacity cannot be 0");
        }
        let symbols = self.fetch_symbols_initial().await?;
        let (sender, receiver) = mpsc::channel(self.config.channel_capacity);

        let previous_symbols = symbols.clone();
        sender
            .send(symbols)
            .await
            .expect("send to new channel failed");
        let client = self.clone();
        tokio::spawn(async move {
            client.update_symbols_stream(sender, previous_symbols).await;
        });
        Ok(receiver)
    }

    async fn update_symbols_handle(
        &self,
        handle: Weak<ArcSwap<HashMap<PriceFeedId, SymbolMetadata>>>,
        mut previous_symbols: Arc<HashMap<PriceFeedId, SymbolMetadata>>,
    ) {
        info!("starting background task for updating symbols");
        loop {
            sleep(DEFAULT_UPDATE_INTERVAL).await;
            if handle.upgrade().is_none() {
                info!("symbols handle dropped, stopping background task");
                return;
            }
            match self.fetch_symbols().await {
                Ok(new_symbols) => {
                    let new_symbols = new_symbols
                        .into_iter()
                        .map(|f| (f.pyth_lazer_id, f))
                        .collect::<HashMap<_, _>>();
                    if *previous_symbols != new_symbols {
                        let Some(handle) = handle.upgrade() else {
                            info!("symbols handle dropped, stopping background task");
                            return;
                        };
                        info!("symbols changed");
                        if let Some(cache_file_path) = self.symbols_cache_file_path() {
                            if let Err(err) = atomic_save_file(&cache_file_path, &new_symbols) {
                                warn!(?err, ?cache_file_path, "failed to save data to cache file");
                            }
                        }
                        let new_symbols = Arc::new(new_symbols);
                        previous_symbols = new_symbols.clone();
                        handle.store(new_symbols);
                    }
                }
                Err(err) => {
                    warn!(?err, "failed to fetch symbols");
                }
            }
        }
    }

    async fn update_symbols_stream(
        &self,
        handle: mpsc::Sender<Vec<SymbolMetadata>>,
        mut previous_symbols: Vec<SymbolMetadata>,
    ) {
        info!("starting background task for updating symbols");
        loop {
            sleep(DEFAULT_UPDATE_INTERVAL).await;
            if handle.is_closed() {
                info!("symbols channel closed, stopping background task");
                return;
            }
            match self.fetch_symbols().await {
                Ok(new_symbols) => {
                    if *previous_symbols != new_symbols {
                        info!("symbols changed");
                        if let Some(cache_file_path) = self.symbols_cache_file_path() {
                            if let Err(err) = atomic_save_file(&cache_file_path, &new_symbols) {
                                warn!(?err, ?cache_file_path, "failed to save data to cache file");
                            }
                        }
                        previous_symbols = new_symbols.clone();
                        if handle.send(new_symbols).await.is_err() {
                            info!("symbols channel closed, stopping background task");
                            return;
                        }
                    }
                }
                Err(err) => {
                    warn!(?err, "failed to fetch symbols");
                }
            }
        }
    }

    async fn fetch_symbols_initial(&self) -> anyhow::Result<Vec<SymbolMetadata>> {
        let result = self.fetch_symbols().await;
        match result {
            Ok(data) => {
                info!("fetched initial symbols from history service");
                if let Some(cache_file_path) = self.symbols_cache_file_path() {
                    if let Err(err) = atomic_save_file(&cache_file_path, &data) {
                        warn!(?err, ?cache_file_path, "failed to save data to cache file");
                    }
                }
                Ok(data)
            }
            Err(err) => match self.symbols_cache_file_path() {
                Some(cache_file_path) => match load_file::<Vec<SymbolMetadata>>(&cache_file_path) {
                    Ok(Some(data)) => {
                        info!(?err, "failed to fetch initial symbols from history service, but fetched last known symbols from cache");
                        Ok(data)
                    }
                    Ok(None) => Err(err),
                    Err(cache_err) => {
                        warn!(?cache_err, "failed to fetch data from cache");
                        Err(err)
                    }
                },
                None => Err(err),
            },
        }
    }

    async fn fetch_symbols(&self) -> anyhow::Result<Vec<SymbolMetadata>> {
        if self.config.urls.is_empty() {
            bail!("no history urls provided");
        }
        let mut futures = self
            .config
            .urls
            .iter()
            .map(|url| Box::pin(self.fetch_symbols_single(url)))
            .collect::<FuturesUnordered<_>>();
        while let Some(result) = futures.next().await {
            match result {
                Ok(output) => return Ok(output),
                Err(err) => {
                    warn!("failed to fetch symbols: {:?}", err);
                }
            }
        }

        bail!(
            "failed to fetch symbols from any urls ({:?})",
            self.config.urls
        );
    }

    async fn fetch_symbols_single(&self, url: &Url) -> anyhow::Result<Vec<SymbolMetadata>> {
        let url = url.join("v1/symbols")?;
        retry_notify(
            ExponentialBackoff::<SystemClock> {
                // We will retry all requests after `update_interval`, so there is
                // no reason to continue retrying here.
                max_elapsed_time: Some(self.config.update_interval),
                ..Default::default()
            },
            || async {
                let response = self
                    .client
                    .get(url.clone())
                    .send()
                    .await
                    .map_err(|err| backoff::Error::transient(anyhow::Error::from(err)))?
                    .backoff_error_for_status()?;
                response
                    .json::<Vec<SymbolMetadata>>()
                    .await
                    .map_err(|err| backoff::Error::transient(anyhow::Error::from(err)))
            },
            |e, _| warn!("failed to fetch symbols from {} (will retry): {:?}", url, e),
        )
        .await
    }
}

#[derive(Debug, Clone)]
pub struct SymbolMetadataHandle(Arc<ArcSwap<HashMap<PriceFeedId, SymbolMetadata>>>);

impl SymbolMetadataHandle {
    pub fn symbols(&self) -> arc_swap::Guard<Arc<HashMap<PriceFeedId, SymbolMetadata>>> {
        self.0.load()
    }

    pub fn new_for_test(data: HashMap<PriceFeedId, SymbolMetadata>) -> Self {
        Self(Arc::new(ArcSwap::new(Arc::new(data))))
    }
}

trait BackoffErrorForStatusExt: Sized {
    fn backoff_error_for_status(self) -> Result<Self, backoff::Error<anyhow::Error>>;
}

impl BackoffErrorForStatusExt for reqwest::Response {
    fn backoff_error_for_status(self) -> Result<Self, backoff::Error<anyhow::Error>> {
        let status = self.status();
        self.error_for_status().map_err(|err| {
            if status.is_server_error() {
                backoff::Error::transient(err.into())
            } else {
                backoff::Error::permanent(err.into())
            }
        })
    }
}

fn load_file<T: DeserializeOwned>(path: &Path) -> anyhow::Result<Option<T>> {
    let parent_path = path.parent().context("invalid file path: no parent")?;
    fs_err::create_dir_all(parent_path)?;

    if !path.try_exists()? {
        return Ok(None);
    }
    let json_data = fs_err::read_to_string(path)?;
    let data = serde_json::from_str::<T>(&json_data)?;
    Ok(Some(data))
}

fn atomic_save_file(path: &Path, data: &impl Serialize) -> anyhow::Result<()> {
    let parent_path = path.parent().context("invalid file path: no parent")?;
    fs_err::create_dir_all(parent_path)?;

    let json_data = serde_json::to_string(&data)?;
    let tmp_path = path.with_extension("tmp");
    let mut tmp_file = fs_err::File::create(&tmp_path)?;
    tmp_file.write_all(json_data.as_bytes())?;
    tmp_file.flush()?;
    tmp_file.sync_all()?;
    replace_atomic(&tmp_path, path)?;

    Ok(())
}
