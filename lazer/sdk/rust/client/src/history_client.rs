use {
    anyhow::{bail, format_err, Context as _},
    arc_swap::ArcSwap,
    atomicwrites::replace_atomic,
    backoff::{exponential::ExponentialBackoff, future::retry_notify, SystemClock},
    futures::{future::BoxFuture, stream::FuturesUnordered, StreamExt},
    pyth_lazer_protocol::{jrpc::SymbolMetadata, PriceFeedId, PublisherId},
    pyth_lazer_publisher_sdk::state::State,
    serde::{de::DeserializeOwned, Deserialize, Serialize},
    std::{
        collections::HashMap,
        future::Future,
        io::Write,
        path::{Path, PathBuf},
        sync::{Arc, Weak},
        time::Duration,
    },
    tokio::{sync::mpsc, time::sleep},
    tracing::{info, warn},
    url::Url,
};

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
    /// Access token for publisher or governance endpoints.
    pub access_token: Option<String>,
}

fn default_urls() -> Vec<Url> {
    vec![Url::parse("https://history.pyth-lazer.dourolabs.app/").unwrap()]
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
            access_token: None,
        }
    }
}

/// Client to the history service API.
#[derive(Debug, Clone)]
pub struct PythLazerHistoryClient {
    config: Arc<PythLazerHistoryClientConfig>,
    client: reqwest::Client,
}

enum UpdateHandle<T> {
    ArcSwap(Weak<ArcSwap<T>>),
    Sender(mpsc::Sender<Arc<T>>),
}

impl<T> UpdateHandle<T> {
    fn is_closed(&self) -> bool {
        match self {
            UpdateHandle::ArcSwap(weak) => weak.upgrade().is_none(),
            UpdateHandle::Sender(sender) => sender.is_closed(),
        }
    }

    async fn update(&mut self, new_data: Arc<T>) -> bool {
        match self {
            UpdateHandle::ArcSwap(weak) => {
                let Some(handle) = weak.upgrade() else {
                    return false;
                };
                handle.store(new_data);
                true
            }
            UpdateHandle::Sender(sender) => sender.send(new_data).await.is_ok(),
        }
    }
}

impl PythLazerHistoryClient {
    pub fn new(config: PythLazerHistoryClientConfig) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(config.request_timeout)
                .build()
                .expect("failed to initialize reqwest"),
            config: Arc::new(config),
        }
    }

    fn symbols_cache_file_path(&self) -> Option<PathBuf> {
        self.config
            .cache_dir
            .as_ref()
            .map(|path| path.join("symbols_v1.json"))
    }

    fn publishers_cache_file_path(&self) -> Option<PathBuf> {
        self.config
            .cache_dir
            .as_ref()
            .map(|path| path.join("publishers_v1.json"))
    }

    /// Fetch current metadata for all symbols.
    pub async fn all_symbols_metadata(
        &self,
    ) -> anyhow::Result<HashMap<PriceFeedId, SymbolMetadata>> {
        self.fetch_from_all_urls_or_file(false, self.symbols_cache_file_path(), |url| {
            self.request_symbols(url)
        })
        .await
    }

    /// Fetch metadata for all symbols as an auto-updating handle.
    ///
    /// Returns an error if the initial fetch failed.
    /// The returned `AutoUpdatedHandle` will be updated by a background task when the data changes.
    pub async fn all_symbols_metadata_handle(
        &self,
    ) -> anyhow::Result<AutoUpdatedHandle<HashMap<PriceFeedId, SymbolMetadata>>> {
        self.auto_updated_handle(self.symbols_cache_file_path(), |client, url| {
            Box::pin(client.request_symbols(url))
        })
        .await
    }

    async fn auto_updated_handle<F, R, IR>(
        &self,
        cache_file_path: Option<PathBuf>,
        f: F,
    ) -> anyhow::Result<AutoUpdatedHandle<IR>>
    where
        for<'a> F: Fn(&'a Self, &'a Url) -> BoxFuture<'a, Result<R, backoff::Error<anyhow::Error>>>
            + Send
            + Sync
            + 'static,
        R: Clone + Serialize + DeserializeOwned + PartialEq + Default + Send + 'static,
        IR: From<R> + Send + Sync + 'static,
    {
        let symbols = self
            .fetch_from_all_urls_or_file(true, cache_file_path.clone(), |url| f(self, url))
            .await?;
        let previous_symbols = symbols.clone();
        let handle = Arc::new(ArcSwap::new(Arc::new(IR::from(symbols))));
        let client = self.clone();
        let weak_handle = Arc::downgrade(&handle);
        tokio::spawn(async move {
            client
                .keep_handle_updated(
                    cache_file_path,
                    UpdateHandle::ArcSwap(weak_handle),
                    previous_symbols,
                    |url| f(&client, url),
                )
                .await;
        });
        Ok(AutoUpdatedHandle(handle))
    }

    /// Fetch metadata for all symbols as an auto-updating handle.
    ///
    /// The returned `SymbolMetadataHandle` will be updated by a background task when the data changes.
    /// If the initial fetch failed, the handle will initially contain an empty hashmap.
    pub async fn all_symbols_metadata_fault_tolerant_handle(
        &self,
    ) -> AutoUpdatedHandle<HashMap<PriceFeedId, SymbolMetadata>> {
        self.fault_tolerant_auto_updated_handle(self.symbols_cache_file_path(), |client, url| {
            Box::pin(client.request_symbols(url))
        })
        .await
    }

    async fn fault_tolerant_auto_updated_handle<F, R, IR>(
        &self,
        cache_file_path: Option<PathBuf>,
        f: F,
    ) -> AutoUpdatedHandle<IR>
    where
        for<'a> F: Fn(&'a Self, &'a Url) -> BoxFuture<'a, Result<R, backoff::Error<anyhow::Error>>>
            + Send
            + Sync
            + 'static,
        R: Clone + Serialize + DeserializeOwned + PartialEq + Default + Send + 'static,
        IR: From<R> + Send + Sync + 'static,
    {
        let initial_result = self
            .fetch_from_all_urls_or_file(true, cache_file_path.clone(), |url| f(self, url))
            .await;
        let symbols = match initial_result {
            Ok(data) => data,
            Err(err) => {
                warn!(?err, "failed to fetch data, proceeding with empty data");
                R::default()
            }
        };
        let previous_symbols = symbols.clone();
        let symbols = Arc::new(IR::from(symbols));
        let handle = Arc::new(ArcSwap::new(symbols));
        let weak_handle = Arc::downgrade(&handle);
        let client = self.clone();
        tokio::spawn(async move {
            client
                .keep_handle_updated(
                    cache_file_path,
                    UpdateHandle::ArcSwap(weak_handle),
                    previous_symbols,
                    |url| f(&client, url),
                )
                .await;
        });
        AutoUpdatedHandle(handle)
    }

    /// Fetch metadata for all symbols as a receiver.
    ///
    /// Returns an error if the initial fetch failed.
    /// On a successful return, the channel will always contain the initial data that can be fetched
    /// immediately from the returned receiver.
    /// You should continuously poll the receiver to receive updates.
    pub async fn all_symbols_metadata_stream(
        &self,
    ) -> anyhow::Result<mpsc::Receiver<Arc<HashMap<PriceFeedId, SymbolMetadata>>>> {
        self.update_stream(self.symbols_cache_file_path(), |client, url| {
            Box::pin(client.request_symbols(url))
        })
        .await
    }

    async fn update_stream<F, R>(
        &self,
        cache_file_path: Option<PathBuf>,
        f: F,
    ) -> anyhow::Result<mpsc::Receiver<Arc<R>>>
    where
        for<'a> F: Fn(&'a Self, &'a Url) -> BoxFuture<'a, Result<R, backoff::Error<anyhow::Error>>>
            + Send
            + Sync
            + 'static,
        R: Clone + Serialize + DeserializeOwned + PartialEq + Send + Sync + 'static,
    {
        if self.config.channel_capacity == 0 {
            bail!("channel_capacity cannot be 0");
        }
        let symbols = self
            .fetch_from_all_urls_or_file(true, cache_file_path.clone(), |url| f(self, url))
            .await?;
        let (sender, receiver) = mpsc::channel(self.config.channel_capacity);

        let previous_symbols = symbols.clone();
        let symbols = Arc::new(symbols);
        sender
            .send(symbols)
            .await
            .expect("send to new channel failed");
        let client = self.clone();
        tokio::spawn(async move {
            client
                .keep_handle_updated(
                    cache_file_path,
                    UpdateHandle::Sender(sender),
                    previous_symbols,
                    |url| f(&client, url),
                )
                .await;
        });
        Ok(receiver)
    }

    async fn keep_handle_updated<'a, F, Fut, R, IR>(
        &'a self,
        cache_file_path: Option<PathBuf>,
        mut handle: UpdateHandle<IR>,
        mut previous_data: R,
        f: F,
    ) where
        F: Fn(&'a Url) -> Fut,
        Fut: Future<Output = Result<R, backoff::Error<anyhow::Error>>>,
        R: Serialize + DeserializeOwned + PartialEq + Clone,
        IR: From<R>,
    {
        info!("starting background task for updating data");
        loop {
            sleep(self.config.update_interval).await;
            if handle.is_closed() {
                info!("data handle dropped, stopping background task");
                return;
            }
            match self.fetch_from_all_urls(true, &f).await {
                Ok(new_data) => {
                    if previous_data != new_data {
                        info!("data changed");
                        if let Some(cache_file_path) = &cache_file_path {
                            if let Err(err) = atomic_save_file(cache_file_path, &new_data) {
                                warn!(?err, ?cache_file_path, "failed to save data to cache file");
                            }
                        }

                        previous_data = new_data.clone();
                        let new_data = Arc::new(IR::from(new_data));
                        if !handle.update(new_data.clone()).await {
                            info!("update handle dropped, stopping background task");
                            return;
                        }
                    }
                }
                Err(err) => {
                    warn!(?err, "failed to fetch data");
                }
            }
        }
    }

    async fn fetch_from_all_urls_or_file<'a, F, Fut, R>(
        &'a self,
        limit_by_update_interval: bool,
        cache_file_path: Option<PathBuf>,
        f: F,
    ) -> anyhow::Result<R>
    where
        F: Fn(&'a Url) -> Fut,
        Fut: Future<Output = Result<R, backoff::Error<anyhow::Error>>>,
        R: Serialize + DeserializeOwned,
    {
        let result = self.fetch_from_all_urls(limit_by_update_interval, f).await;
        match result {
            Ok(data) => {
                info!("fetched initial data from history service");
                if let Some(cache_file_path) = cache_file_path {
                    if let Err(err) = atomic_save_file::<R>(&cache_file_path, &data) {
                        warn!(?err, ?cache_file_path, "failed to save data to cache file");
                    }
                }
                Ok(data)
            }
            Err(err) => match cache_file_path {
                Some(cache_file_path) => match load_file::<R>(&cache_file_path) {
                    Ok(Some(data)) => {
                        info!(
                            ?err,
                            "failed to fetch initial data from history service, \
                            but fetched last known data from cache"
                        );
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

    async fn fetch_from_all_urls<'a, F, Fut, R>(
        &'a self,
        limit_by_update_interval: bool,
        f: F,
    ) -> anyhow::Result<R>
    where
        F: Fn(&'a Url) -> Fut,
        Fut: Future<Output = Result<R, backoff::Error<anyhow::Error>>>,
    {
        if self.config.urls.is_empty() {
            bail!("no history urls provided");
        }
        let mut futures = self
            .config
            .urls
            .iter()
            .map(|url| {
                Box::pin(self.fetch_from_single_url_with_retry(limit_by_update_interval, || f(url)))
            })
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
            "failed to fetch data from any urls ({:?})",
            self.config.urls
        );
    }

    async fn fetch_from_single_url_with_retry<F, Fut, R>(
        &self,
        limit_by_update_interval: bool,
        f: F,
    ) -> anyhow::Result<R>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = Result<R, backoff::Error<anyhow::Error>>>,
    {
        let mut backoff = ExponentialBackoff::<SystemClock>::default();
        if limit_by_update_interval {
            backoff.max_elapsed_time = Some(self.config.update_interval);
        }
        retry_notify(backoff, f, |e, _| warn!(?e, "operation failed, will retry")).await
    }

    async fn request_symbols(
        &self,
        url: &Url,
    ) -> Result<HashMap<PriceFeedId, SymbolMetadata>, backoff::Error<anyhow::Error>> {
        let url = url
            .join("v1/symbols")
            .map_err(|err| backoff::Error::permanent(anyhow::Error::from(err)))?;

        let response = self
            .client
            .get(url.clone())
            .send()
            .await
            .map_err(|err| backoff::Error::transient(anyhow::Error::from(err)))?
            .backoff_error_for_status()?;
        let vec = response
            .json::<Vec<SymbolMetadata>>()
            .await
            .map_err(|err| backoff::Error::transient(anyhow::Error::from(err)))?;
        Ok(vec
            .into_iter()
            .map(|f| (f.pyth_lazer_id, f))
            .collect::<HashMap<_, _>>())
    }

    /// Fetch current list of publishers.
    ///
    /// Requires a token with governance permission.
    pub async fn publishers(&self) -> anyhow::Result<Publishers> {
        self.fetch_from_all_urls_or_file(false, self.publishers_cache_file_path(), |url| {
            self.request_publishers(url)
        })
        .await
        .map(Into::into)
    }

    async fn request_publishers(
        &self,
        url: &Url,
    ) -> Result<Vec<Publisher>, backoff::Error<anyhow::Error>> {
        let url = url
            .join("v1/state?publishers=true")
            .map_err(|err| backoff::Error::permanent(anyhow::Error::from(err)))?;
        let access_token = self.config.access_token.as_ref().ok_or_else(|| {
            backoff::Error::permanent(format_err!("missing access_token in config"))
        })?;
        let response = self
            .client
            .get(url.clone())
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|err| {
                backoff::Error::transient(
                    anyhow::Error::from(err).context(format!("failed to fetch state from {url}")),
                )
            })?
            .backoff_error_for_status()?;
        let bytes = response.bytes().await.map_err(|err| {
            backoff::Error::transient(
                anyhow::Error::from(err).context(format!("failed to fetch state from {url}")),
            )
        })?;
        let json = String::from_utf8(bytes.into()).map_err(|err| {
            backoff::Error::permanent(
                anyhow::Error::from(err).context(format!("failed to parse state from {url}")),
            )
        })?;
        let state = protobuf_json_mapping::parse_from_str::<State>(&json).map_err(|err| {
            backoff::Error::permanent(
                anyhow::Error::from(err).context(format!("failed to parse state from {url}")),
            )
        })?;
        convert_publishers(state).map_err(|err| {
            backoff::Error::permanent(err.context(format!("failed to parse response from {url}")))
        })
    }

    /// Fetch publishers as an auto-updating handle.
    ///
    /// Returns an error if the initial fetch failed.
    /// The returned `AutoUpdatedHandle` will be updated by a background task when the data changes.
    ///
    /// Requires a token with governance permission.
    pub async fn publishers_handle(&self) -> anyhow::Result<AutoUpdatedHandle<Publishers>> {
        self.auto_updated_handle(self.publishers_cache_file_path(), |client, url| {
            Box::pin(client.request_publishers(url))
        })
        .await
    }

    /// Fetch publishers as an auto-updating handle.
    ///
    /// The returned `AutoUpdatedHandle` will be updated by a background task when the data changes.
    /// If the initial fetch failed, the handle will initially contain an empty publisher list.
    ///
    /// Requires a token with governance permission.
    pub async fn publishers_fault_tolerant_handle(&self) -> AutoUpdatedHandle<Publishers> {
        self.fault_tolerant_auto_updated_handle(self.publishers_cache_file_path(), |client, url| {
            Box::pin(client.request_publishers(url))
        })
        .await
    }
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Publishers {
    pub by_id: HashMap<PublisherId, Publisher>,
    pub by_public_key: HashMap<Vec<u8>, Publisher>,
}

impl From<Vec<Publisher>> for Publishers {
    fn from(value: Vec<Publisher>) -> Self {
        let mut output = Self::default();
        for publisher in value {
            for key in &publisher.public_keys {
                output.by_public_key.insert(key.clone(), publisher.clone());
            }
            output.by_id.insert(publisher.id, publisher);
        }
        output
    }
}

fn convert_publishers(state: State) -> anyhow::Result<Vec<Publisher>> {
    let mut output = Vec::new();
    for item in state.publishers {
        let publisher = Publisher {
            id: PublisherId(
                item.publisher_id
                    .context("missing publishers[i].publisher_id")?
                    .try_into()
                    .context("publishers[i].publisher_id overflow")?,
            ),
            name: item.name.context("missing publishers[i].name")?,
            is_active: item.is_active.context("missing publishers[i].isActive")?,
            public_keys: item.public_keys,
            allowed_feed_ids: item.allowed_feed_ids.into_iter().map(PriceFeedId).collect(),
        };
        output.push(publisher);
    }

    Ok(output)
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Publisher {
    pub id: PublisherId,
    pub name: String,
    pub is_active: bool,
    pub public_keys: Vec<Vec<u8>>,
    pub allowed_feed_ids: Vec<PriceFeedId>,
}

#[derive(Debug, Clone)]
pub struct AutoUpdatedHandle<R>(Arc<ArcSwap<R>>);

impl<R> AutoUpdatedHandle<R> {
    pub fn get(&self) -> arc_swap::Guard<Arc<R>> {
        self.0.load()
    }

    pub fn new_for_test(data: R) -> Self {
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

fn atomic_save_file<T: Serialize>(path: &Path, data: &T) -> anyhow::Result<()> {
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
