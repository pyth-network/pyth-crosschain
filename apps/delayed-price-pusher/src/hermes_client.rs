use anyhow::{bail, ensure, Context};
use backoff::{future::retry, ExponentialBackoff};
use futures::{Stream, StreamExt, TryFutureExt, TryStreamExt};
use log::warn;
use reqwest::Client;
use reqwest_eventsource::{Event, EventSource};
use serde::Deserialize;

use crate::config::HermesConfig;

#[derive(Debug, Deserialize)]
pub struct HermesUpdate {
    pub binary: Vec<u8>,
    pub publish_time: u64,
    pub prev_publish_time: u64,
}

#[derive(Debug, Deserialize)]
struct UpdatePayload {
    binary: UpdateBinary,
    parsed: Vec<UpdateParsed>,
}

#[derive(Debug, Deserialize)]
struct UpdateBinary {
    data: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateParsed {
    price: UpdatePrice,
    metadata: UpdateMetadata,
}

#[derive(Debug, Deserialize)]
struct UpdatePrice {
    publish_time: u64,
}

#[derive(Debug, Deserialize)]
struct UpdateMetadata {
    prev_publish_time: u64,
}

impl TryFrom<UpdatePayload> for Vec<HermesUpdate> {
    type Error = anyhow::Error;

    fn try_from(value: UpdatePayload) -> Result<Self, Self::Error> {
        if value.binary.data.len() != value.parsed.len() {
            bail!("length mismatch between binary and parsed in hermes response");
        }
        value
            .binary
            .data
            .into_iter()
            .zip(value.parsed)
            .map(|(binary, parsed)| {
                Ok(HermesUpdate {
                    binary: hex::decode(&binary)?,
                    publish_time: parsed.price.publish_time,
                    prev_publish_time: parsed.metadata.prev_publish_time,
                })
            })
            .collect()
    }
}

#[derive(Debug)]
pub struct HermesClient {
    config: HermesConfig,
    client: Client,
    #[cfg(test)]
    pub mock: tests::HermesClientMock,
}

impl HermesClient {
    pub fn new(config: HermesConfig) -> Self {
        Self {
            client: Client::builder()
                .timeout(config.single_request_timeout)
                .build()
                .unwrap(),
            config,
            #[cfg(test)]
            mock: tests::HermesClientMock::disabled(),
        }
    }

    #[cfg(test)]
    pub fn new_mock() -> Self {
        Self {
            client: Client::new(),
            config: HermesConfig {
                endpoint: "http://tmp/".parse().unwrap(),
                single_request_timeout: Default::default(),
                total_retry_timeout: Default::default(),
                stream_progress_timeout: Default::default(),
                stream_disconnect_delay: Default::default(),
            },
            mock: tests::HermesClientMock::enabled(),
        }
    }

    // Requests a stream of price feed updates for the specified `price_feed_id`.
    // If the initial request returns an error, retries indefinitely.
    // The stream will return an error:
    // - in case of a communication error with the server;
    // - in case of a decoding error;
    // - in case no updated are received for the duration of `stream_progress_timeout`.
    pub async fn fetch_updates(
        &self,
        price_feed_id: &str,
    ) -> anyhow::Result<impl Stream<Item = anyhow::Result<Vec<HermesUpdate>>> + Unpin> {
        #[cfg(test)]
        if self.mock.is_enabled() {
            let mock = self.mock.pop(|m| &mut m.fetch_updates).await;
            return mock(price_feed_id.into()).await;
        }

        let mut url = self.config.endpoint.join("/v2/updates/price/stream")?;
        url.query_pairs_mut().append_pair("ids[]", price_feed_id);
        // This never returns Err for now, but we may consider treating some error kinds
        // as permanent failures later.
        let event_source = retry(ExponentialBackoff::default(), || {
            async {
                // This intentionally doesn't use `self.client` so that the default timeout
                // is not applied to a potentially long-living stream request.
                let mut event_source = EventSource::get(url.clone());
                let first = event_source
                    .try_next()
                    .await?
                    .context("unexpected end of stream")?;
                ensure!(first == Event::Open);
                Ok(event_source)
            }
            .map_err(|err| {
                warn!("request to hermes failed: {:?}", err);
                backoff::Error::transient(err)
            })
        })
        .await?;

        let stream_with_timeout =
            tokio_stream::StreamExt::timeout(event_source, self.config.stream_progress_timeout);
        let mapped_stream = stream_with_timeout.map(|result| match result?? {
            Event::Open => bail!("unexpected Open event"),
            Event::Message(event) => {
                Ok(serde_json::from_str::<UpdatePayload>(&event.data)?.try_into()?)
            }
        });

        Ok(Box::pin(mapped_stream))
    }

    // Requests a price update for the specified price feed at the specified time.
    // In case of an error, it retries for a limited time.
    // The method will fail if no price is available for this timestamp.
    pub async fn price_at(&self, price_feed_id: &str, time: u64) -> anyhow::Result<HermesUpdate> {
        #[cfg(test)]
        if self.mock.is_enabled() {
            let mock = self.mock.pop(|m| &mut m.price_at).await;
            return mock(price_feed_id.into(), time).await;
        }

        let mut url = self
            .config
            .endpoint
            .join(&format!("/v2/updates/price/{}", time))?;
        url.query_pairs_mut().append_pair("ids[]", price_feed_id);
        let response = retry(
            ExponentialBackoff {
                max_elapsed_time: Some(self.config.total_retry_timeout),
                ..ExponentialBackoff::default()
            },
            || async {
                self.client
                    .get(url.clone())
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|err| {
                        warn!("failed to fetch price at timestamp from hermes: {:?}", err);
                        backoff::Error::transient(err)
                    })
            },
        )
        .await?;

        let mut data: Vec<HermesUpdate> = response.json::<UpdatePayload>().await?.try_into()?;
        if data.len() != 1 {
            bail!("expected hermes to return exactly one update");
        }
        Ok(data.remove(0))
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::VecDeque, fmt};

    use futures::{future::BoxFuture, stream::BoxStream};
    use tokio::sync::{MappedMutexGuard, Mutex, MutexGuard};

    use super::HermesUpdate;

    #[derive(Default)]
    pub struct HermesClientMockData {
        pub fetch_updates: VecDeque<
            Box<
                dyn FnOnce(
                        String,
                    ) -> BoxFuture<
                        'static,
                        anyhow::Result<BoxStream<'static, anyhow::Result<Vec<HermesUpdate>>>>,
                    > + Send
                    + Sync,
            >,
        >,
        pub price_at: VecDeque<
            Box<
                dyn FnOnce(String, u64) -> BoxFuture<'static, anyhow::Result<HermesUpdate>>
                    + Send
                    + Sync,
            >,
        >,
    }

    impl fmt::Debug for HermesClientMockData {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.debug_struct("HermesClientMock").finish()
        }
    }

    #[derive(Debug)]
    pub struct HermesClientMock(Option<Mutex<HermesClientMockData>>);
    impl HermesClientMock {
        pub fn enabled() -> Self {
            Self(Some(Mutex::new(HermesClientMockData::default())))
        }

        pub fn disabled() -> Self {
            Self(None)
        }

        pub fn is_enabled(&self) -> bool {
            self.0.is_some()
        }
        pub async fn pop<T>(
            &self,
            field: impl FnOnce(&mut HermesClientMockData) -> &mut VecDeque<T>,
        ) -> T {
            field(&mut *self.0.as_ref().expect("not mocked").lock().await)
                .pop_front()
                .expect("too many calls")
        }

        // pub async fn push<T>(
        //     &self,
        //     field: impl FnOnce(&mut HermesClientMockData) -> &mut VecDeque<T>,
        //     value: T,
        // ) {
        //     field(&mut *self.0.as_ref().expect("not mocked").lock().await).push_front(value);
        // }

        pub async fn queue<T: 'static>(
            &self,
            field: impl FnOnce(&mut HermesClientMockData) -> &mut VecDeque<T>,
        ) -> MappedMutexGuard<VecDeque<T>> {
            let guard = self.0.as_ref().expect("not mocked").lock().await;
            MutexGuard::map(guard, |v| field(v))
        }
    }
}
