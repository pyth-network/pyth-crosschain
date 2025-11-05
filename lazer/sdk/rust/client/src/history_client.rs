use {
    anyhow::{bail, format_err, Context as _},
    atomicwrites::replace_atomic,
    backoff::{exponential::ExponentialBackoff, future::retry_notify, SystemClock},
    futures::{future::BoxFuture, stream::FuturesUnordered, Stream, StreamExt},
    pyth_lazer_protocol::jrpc::SymbolMetadata,
    pyth_lazer_publisher_sdk::state::State,
    serde::{
        de::{DeserializeOwned, Error as _},
        ser::Error as _,
        Deserialize, Serialize,
    },
    std::{
        future::Future,
        io::Write,
        path::{Path, PathBuf},
        sync::Arc,
        time::Duration,
    },
    tokio::{sync::mpsc, time::sleep},
    tokio_stream::wrappers::ReceiverStream,
    tracing::{info, info_span, warn, Instrument},
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
    /// Access token for publisher or governance restricted endpoints.
    ///
    /// Not needed for consumer facing endpoints.
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

/// Specifies which parts of the state should be present in the output.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct GetStateParams {
    #[serde(default)]
    pub all: bool,
    #[serde(default)]
    pub publishers: bool,
    #[serde(default)]
    pub feeds: bool,
    #[serde(default)]
    pub governance_sources: bool,
    #[serde(default)]
    pub feature_flags: bool,
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

    fn state_cache_file_path(&self, params: &GetStateParams) -> Option<PathBuf> {
        let GetStateParams {
            all,
            publishers,
            feeds,
            governance_sources,
            feature_flags,
        } = params;

        self.config.cache_dir.as_ref().map(|path| {
            path.join(format!(
                "state_{}{}{}{}{}_v1.json",
                *all as u8,
                *publishers as u8,
                *feeds as u8,
                *governance_sources as u8,
                *feature_flags as u8,
            ))
        })
    }

    /// Fetch current metadata for all symbols.
    pub async fn all_symbols_metadata(&self) -> anyhow::Result<Vec<SymbolMetadata>> {
        self.fetch_from_all_urls_or_file(self.symbols_cache_file_path(), |url| {
            self.request_symbols(url)
        })
        .instrument(info_span!("all_symbols_metadata"))
        .await
    }

    /// Creates a fault-tolerant stream that requests the list of symbols and yields new items
    /// when a change of value occurs.
    ///
    /// Returns an error if the initial fetch failed.
    /// On a successful return, the channel will always contain the initial data that can be fetched
    /// immediately from the returned stream.
    /// You should continuously poll the stream to receive updates.
    pub async fn all_symbols_metadata_stream(
        &self,
    ) -> anyhow::Result<impl Stream<Item = Vec<SymbolMetadata>> + Unpin> {
        self.stream(self.symbols_cache_file_path(), |client, url| {
            Box::pin(client.request_symbols(url))
        })
        .instrument(info_span!("all_symbols_metadata_stream"))
        .await
    }

    /// Creates a fault-tolerant stream that requests data using `f` and yields new items
    /// when a change of value occurs.
    ///
    /// Returns an error if the initial fetch failed.
    /// On a successful return, the channel will always contain the initial data that can be fetched
    /// immediately from the returned stream.
    /// You should continuously poll the stream to receive updates.
    async fn stream<F, R>(
        &self,
        cache_file_path: Option<PathBuf>,
        f: F,
    ) -> anyhow::Result<impl Stream<Item = R> + Unpin>
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
            .fetch_from_all_urls_or_file(cache_file_path.clone(), |url| f(self, url))
            .await?;
        let (sender, receiver) = mpsc::channel(self.config.channel_capacity);

        let previous_symbols = symbols.clone();
        sender
            .send(symbols)
            .await
            .expect("send to new channel failed");
        let client = self.clone();
        tokio::spawn(
            async move {
                client
                    .keep_stream_updated(cache_file_path, sender, previous_symbols, |url| {
                        f(&client, url)
                    })
                    .await;
            }
            .in_current_span(),
        );
        Ok(ReceiverStream::new(receiver))
    }

    /// Requests new data using `f` repeatedly,
    /// writes new data to the cache file and sends it using `sender`.
    async fn keep_stream_updated<'a, F, Fut, R>(
        &'a self,
        cache_file_path: Option<PathBuf>,
        sender: mpsc::Sender<R>,
        mut previous_data: R,
        f: F,
    ) where
        F: Fn(&'a Url) -> Fut,
        Fut: Future<Output = Result<R, backoff::Error<anyhow::Error>>>,
        R: Serialize + DeserializeOwned + PartialEq + Clone,
    {
        info!("starting background task for updating data");
        loop {
            sleep(self.config.update_interval).await;
            if sender.is_closed() {
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
                        if sender.send(new_data.clone()).await.is_err() {
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

    /// Uses all configured URLs to perform request `f` and handles retrying on error.
    /// Returns the value once any of the requests succeeds. If all requests fail,
    /// tries to fetch the data from local cache. If loading from cache also fails,
    /// it keeps retrying the requests until any of them succeeds.
    async fn fetch_from_all_urls_or_file<'a, F, Fut, R>(
        &'a self,
        cache_file_path: Option<PathBuf>,
        f: F,
    ) -> anyhow::Result<R>
    where
        F: Fn(&'a Url) -> Fut,
        Fut: Future<Output = Result<R, backoff::Error<anyhow::Error>>>,
        R: Serialize + DeserializeOwned,
    {
        let result = self.fetch_from_all_urls(true, &f).await;
        match result {
            Ok(data) => {
                info!("fetched initial data from history service");
                if let Some(cache_file_path) = cache_file_path {
                    if let Err(err) = atomic_save_file::<R>(&cache_file_path, &data) {
                        warn!(?err, ?cache_file_path, "failed to save data to cache file");
                    }
                }
                return Ok(data);
            }
            Err(err) => {
                warn!(?err, "all requests failed");
            }
        }

        if let Some(cache_file_path) = cache_file_path {
            match load_file::<R>(&cache_file_path) {
                Ok(Some(data)) => {
                    info!(
                        "failed to fetch initial data from history service, \
                        but fetched last known data from cache"
                    );
                    return Ok(data);
                }
                Ok(None) => {
                    info!("no data found in cache");
                }
                Err(err) => {
                    warn!(?err, "failed to fetch data from cache");
                }
            }
        }

        self.fetch_from_all_urls(false, f).await
    }

    /// Uses all configured URLs to perform request `f` and handles retrying on error.
    ///
    /// Returns the value once any of the requests succeeds.
    /// If `limit_by_update_interval` is true, the total time spent retrying it limited to
    /// `self.config.update_interval`. If `limit_by_update_interval` is false, the requests
    /// will be retried indefinitely.
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
    ) -> Result<Vec<SymbolMetadata>, backoff::Error<anyhow::Error>> {
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
        Ok(vec)
    }

    /// Fetch a partial state snapshot containing data specified in `params`.
    pub async fn state(&self, params: GetStateParams) -> anyhow::Result<State> {
        self.fetch_from_all_urls_or_file(self.state_cache_file_path(&params), move |url| {
            self.request_state(url, params.clone())
        })
        .instrument(info_span!("state"))
        .await
        .map(|s| s.0)
    }

    /// Fetch a part of the current state specified by `params`.
    ///
    /// Creates a fault-tolerant stream that requests a partial state snapshot
    /// containing data specified in `params`. It yields new items
    /// when a change of value occurs.
    ///
    /// Returns an error if the initial fetch failed.
    /// On a successful return, the stream will always contain the initial data that can be fetched
    /// immediately from the returned stream.
    /// You should continuously poll the stream to receive updates.
    pub async fn state_stream(
        &self,
        params: GetStateParams,
    ) -> anyhow::Result<impl Stream<Item = State> + Unpin> {
        let stream = self
            .stream(self.state_cache_file_path(&params), move |client, url| {
                Box::pin(client.request_state(url, params.clone()))
            })
            .instrument(info_span!("state_stream"))
            .await?;
        Ok(stream.map(|s| s.0))
    }

    /// Fetch data from /v1/state endpoint without any timeouts or retries.
    async fn request_state(
        &self,
        url: &Url,
        params: GetStateParams,
    ) -> Result<StateWithSerde, backoff::Error<anyhow::Error>> {
        let url = url
            .join("v1/state")
            .map_err(|err| backoff::Error::permanent(anyhow::Error::from(err)))?;
        let access_token = self.config.access_token.as_ref().ok_or_else(|| {
            backoff::Error::permanent(format_err!("missing access_token in config"))
        })?;
        let response = self
            .client
            .get(url.clone())
            .query(&params)
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
        Ok(StateWithSerde(state))
    }
}

// State wrapper that delegates serialization and deserialization to `protobuf_json_mapping`.
#[derive(Debug, Clone, PartialEq)]
struct StateWithSerde(State);

impl Serialize for StateWithSerde {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let json = protobuf_json_mapping::print_to_string(&self.0).map_err(S::Error::custom)?;
        let json_value =
            serde_json::from_str::<serde_json::Value>(&json).map_err(S::Error::custom)?;
        json_value.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for StateWithSerde {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let json_value = serde_json::Value::deserialize(deserializer)?;
        let json = serde_json::to_string(&json_value).map_err(D::Error::custom)?;
        let value = protobuf_json_mapping::parse_from_str(&json).map_err(D::Error::custom)?;
        Ok(Self(value))
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
