use std::collections::BTreeMap;
use std::convert::identity;
use std::sync::Arc;
use std::time::Instant;

use alloy::primitives::Bytes;
use futures::future::BoxFuture;
use futures::stream::FuturesUnordered;
use futures::Stream;
use futures::StreamExt;
use log::info;
use log::warn;
use tokio::sync::mpsc::Receiver;
use tokio::{
    select,
    sync::mpsc::{self, Sender},
};

use crate::config::Config;
use crate::hermes_client::{HermesClient, HermesUpdate};

const CHANNEL_CAPACITY: usize = 1000;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PriceRequest {
    #[allow(dead_code)]
    pub price_feed_id: String,
    pub timestamp: u64,
    pub context: Bytes,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PriceResponse {
    #[allow(dead_code)]
    pub update_data: Vec<u8>,
    #[allow(dead_code)]
    pub context: Bytes,
}

#[derive(Debug, Clone)]
pub struct PriceFetcher {
    sender: Sender<PriceRequest>,
}

impl PriceFetcher {
    pub fn new(
        price_feed_id: &str,
        config: Config,
        hermes_client: Arc<HermesClient>,
    ) -> (Self, Receiver<PriceResponse>) {
        let (sender, receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let (response_sender, response_receiver) = mpsc::channel(CHANNEL_CAPACITY);
        let mut task = Task {
            receiver,
            single_requests: Default::default(),
            price_feed_id: price_feed_id.into(),
            hermes_client,
            requests: Default::default(),
            last_stream_timestamp: None,
            response_sender,
            config,
            last_activity_at: Instant::now(),
        };
        tokio::spawn(async move { task.run().await });
        (Self { sender }, response_receiver)
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub fn new_mock(request_sender: Sender<PriceRequest>) -> Self {
        Self {
            sender: request_sender,
        }
    }

    pub async fn handle(&self, request: PriceRequest) {
        if self.sender.send(request).await.is_err() {
            warn!("cannot handle price request: task is shut down");
        }
    }
}

struct Task {
    receiver: Receiver<PriceRequest>,
    config: Config,
    single_requests: FuturesUnordered<BoxFuture<'static, (u64, anyhow::Result<HermesUpdate>)>>,
    price_feed_id: String,
    hermes_client: Arc<HermesClient>,
    // TODO: small vec?
    requests: BTreeMap<u64, Vec<PriceRequest>>,
    last_stream_timestamp: Option<u64>,
    response_sender: Sender<PriceResponse>,
    // Last time when a request was added or removed.
    last_activity_at: Instant,
}

impl Task {
    async fn run(&mut self) {
        loop {
            self.last_stream_timestamp = None;
            // Wait for the first request before requesting a stream from Hermes.
            if self.requests.is_empty() {
                let Some(first_request) = self.receiver.recv().await else {
                    return;
                };
                self.handle_request(first_request);
            }

            let result = self.hermes_client.fetch_updates(&self.price_feed_id).await;
            let stream = match result {
                Ok(stream) => stream,
                Err(err) => {
                    warn!(
                        "fatal error while fetching price feed {}: {:?}",
                        self.price_feed_id, err
                    );
                    return;
                }
            };
            self.handle_stream(stream).await;
        }
    }

    async fn handle_stream(
        &mut self,
        mut stream: impl Stream<Item = anyhow::Result<Vec<HermesUpdate>>> + Unpin,
    ) {
        loop {
            select! {
                Some(updates) = stream.next() => {
                    let updates = match updates {
                        Ok(updates) => updates,
                        Err(err) => {
                            warn!(
                                "price stream error while fetching price feed {}: {:?}",
                                self.price_feed_id, err
                            );
                            return;
                        }
                    };
                    for update in updates {
                        self.handle_update(update).await;
                    }
                    if self.requests.is_empty() &&
                        self.last_activity_at.elapsed() > self.config.hermes.stream_disconnect_delay
                    {
                        info!(
                            "no more activity for price feed {}, disconnecting from hermes stream",
                            self.price_feed_id
                        );
                        return;
                    }
                },
                Some(request) = self.receiver.recv() => {
                    self.handle_request(request);
                },
                Some((timestamp, item)) = self.single_requests.next() => {
                    match item {
                        Ok(item) => {self.handle_update(item).await; },
                        Err(err) => {
                            let num_removed = self.requests.remove(&timestamp).unwrap_or_default().len();
                            warn!(
                                "error while fetching single price for {}: {:?}; discarding {} requests",
                                self.price_feed_id, err, num_removed
                            );
                        }
                    };
                }
                else => break,
            }
        }
    }

    async fn handle_update(&mut self, update: HermesUpdate) {
        if self.last_stream_timestamp.is_none() {
            // If requested timestamp is in the past, we're not going to receive it
            // in this stream, so we have to make a separate request.
            let previous_timestamps: Vec<_> = self
                .requests
                .range(..update.publish_time)
                .map(|(k, _v)| *k)
                .collect();
            for timestamp in previous_timestamps {
                self.do_single_request(timestamp);
            }
        }
        self.last_stream_timestamp = Some(update.publish_time);
        if update.prev_publish_time == update.publish_time {
            // We only use the first update for each timestamp.
            return;
        }
        // Remove and fulfill all requests in the
        // (update.prev_publish_time + 1 ..= update.publish_time) range.
        let mut after_prev_time = self.requests.split_off(&(update.prev_publish_time + 1));
        let after_publish_time = after_prev_time.split_off(&(update.publish_time + 1));
        self.requests.extend(after_publish_time);
        for (_, requests) in after_prev_time {
            for request in requests {
                let response = PriceResponse {
                    update_data: update.binary.clone(),
                    context: request.context,
                };
                if self.response_sender.send(response).await.is_err() {
                    warn!("cannot send price response: receiver not available");
                }
                self.last_activity_at = Instant::now();
            }
        }
    }

    fn do_single_request(&mut self, timestamp: u64) {
        let hermes_client = Arc::clone(&self.hermes_client);
        let price_feed_id = self.price_feed_id.clone();
        let task = async move { hermes_client.price_at(&price_feed_id, timestamp).await };
        let handle = tokio::spawn(task);
        self.single_requests.push(Box::pin(async move {
            let result = handle.await.map_err(anyhow::Error::from).and_then(identity);
            (timestamp, result)
        }));
    }

    fn handle_request(&mut self, request: PriceRequest) {
        let expected_in_stream = self
            .last_stream_timestamp
            .map_or(true, |last_stream_timestamp| {
                request.timestamp > last_stream_timestamp
            });
        if !expected_in_stream {
            self.do_single_request(request.timestamp);
        }
        self.requests
            .entry(request.timestamp)
            .or_default()
            .push(request);
        self.last_activity_at = Instant::now();
    }
}

#[cfg(test)]
mod tests {
    use std::{sync::Arc, time::Duration};

    use alloy::primitives::address;
    use anyhow::format_err;
    use futures::stream::BoxStream;
    use tokio::{
        sync::{mpsc, oneshot},
        time::sleep,
    };
    use tokio_stream::wrappers::ReceiverStream;

    use crate::{
        config::{Config, HermesConfig},
        hermes_client::{HermesClient, HermesUpdate},
        price_fetcher::{PriceFetcher, PriceRequest, PriceResponse},
    };

    #[tokio::test]
    async fn price_fetcher_works() -> anyhow::Result<()> {
        let delay = Duration::from_millis(300);
        let price_feed_id = "abc";
        let config = Config {
            contract_address: address!("5FbDB2315678afecb367f032d93F642f64180aa3"),
            hermes: HermesConfig {
                endpoint: "https://hermes.pyth.network/".parse()?,
                single_request_timeout: Duration::from_secs(10),
                total_retry_timeout: Duration::from_secs(30),
                stream_progress_timeout: Duration::from_millis(1500),
                stream_disconnect_delay: Duration::from_secs(2),
            },
        };
        let hermes_client = Arc::new(HermesClient::new_mock());

        let (hermes_updates_sender, hermes_updates_receiver) = mpsc::channel(1000);
        hermes_client
            .mock
            .queue(|m| &mut m.fetch_updates)
            .await
            .push_back(Box::new(move |id| {
                Box::pin(async move {
                    assert_eq!(id, price_feed_id);
                    Ok(Box::pin(ReceiverStream::new(hermes_updates_receiver)) as BoxStream<_>)
                })
            }));

        let (price_fetcher, mut response_receiver) =
            PriceFetcher::new(price_feed_id, config, hermes_client.clone());

        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1001,
                context: [0, 1, 2].into(),
            })
            .await;
        // Initiate hermes stream and fetch the first price normally.
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 2].into(),
                publish_time: 999,
                prev_publish_time: 998,
            }]))
            .await?;
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 3].into(),
                publish_time: 1000,
                prev_publish_time: 999,
            }]))
            .await?;
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 4].into(),
                publish_time: 1001,
                prev_publish_time: 1000,
            }]))
            .await?;

        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 2, 4].into(),
                context: [0, 1, 2].into(),
            }
        );

        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 5].into(),
                publish_time: 1002,
                prev_publish_time: 1001,
            }]))
            .await?;

        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1004,
                context: [0, 1, 3].into(),
            })
            .await;
        sleep(delay).await;

        // Fetch next price from already established stream.
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 6].into(),
                publish_time: 1003,
                prev_publish_time: 1002,
            }]))
            .await?;

        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 7].into(),
                publish_time: 1004,
                prev_publish_time: 1003,
            }]))
            .await?;

        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 2, 7].into(),
                context: [0, 1, 3].into(),
            }
        );

        // When we send a request for 1004, timestamp will already have been missed in stream,
        // so a new request will be made.
        hermes_client
            .mock
            .queue(|m| &mut m.price_at)
            .await
            .push_back(Box::new(move |id, time| {
                Box::pin(async move {
                    assert_eq!(id, price_feed_id);
                    assert_eq!(time, 1004);
                    Ok(HermesUpdate {
                        binary: [2, 2, 7].into(),
                        publish_time: 1004,
                        prev_publish_time: 1003,
                    })
                })
            }));

        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1004,
                context: [0, 1, 4].into(),
            })
            .await;

        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 2, 7].into(),
                context: [0, 1, 4].into(),
            }
        );
        sleep(delay).await;

        // No requests after 2 s - stream should be disconnected.
        for i in 0..3 {
            hermes_updates_sender
                .send(Ok(vec![HermesUpdate {
                    binary: [2, 2, 8, i].into(),
                    publish_time: 1004,
                    prev_publish_time: 1004,
                }]))
                .await?;
            sleep(Duration::from_secs(1)).await;
        }
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 8, 7].into(),
                publish_time: 1004,
                prev_publish_time: 1004,
            }]))
            .await
            .expect_err("stream should be disconnected");

        // New stream connection will be established upon the next request.
        let (hermes_updates_sender, hermes_updates_receiver) = mpsc::channel(1000);
        hermes_client
            .mock
            .queue(|m| &mut m.fetch_updates)
            .await
            .push_back(Box::new(move |id| {
                Box::pin(async move {
                    assert_eq!(id, price_feed_id);
                    Ok(Box::pin(ReceiverStream::new(hermes_updates_receiver)) as BoxStream<_>)
                })
            }));

        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1010,
                context: [0, 1, 5].into(),
            })
            .await;

        println!("ok1");
        // New single request will be made after the first stream update because
        // the request is in the past.
        let (response1010_sender, response1010_receiver) = oneshot::channel();
        hermes_client
            .mock
            .queue(|m| &mut m.price_at)
            .await
            .push_back(Box::new(move |id, time| {
                Box::pin(async move {
                    assert_eq!(id, price_feed_id);
                    assert_eq!(time, 1010);
                    println!("ok2");
                    response1010_receiver.await.unwrap()
                })
            }));
        println!("ok3");

        // While request for 1010 is in progress, we send two requests for 1017.
        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1017,
                context: [0, 1, 6].into(),
            })
            .await;
        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1017,
                context: [0, 1, 7].into(),
            })
            .await;
        sleep(delay).await;
        // Stream update for 1017 arrives and should trigger response for both requests.
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 3].into(),
                publish_time: 1016,
                prev_publish_time: 1015,
            }]))
            .await?;
        println!("ok4");

        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 3, 2].into(),
                publish_time: 1017,
                prev_publish_time: 1016,
            }]))
            .await?;
        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 3, 2].into(),
                context: [0, 1, 6].into(),
            }
        );
        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 3, 2].into(),
                context: [0, 1, 7].into(),
            }
        );

        // Request for 1010 resolves and should result in a response.
        response1010_sender
            .send(Ok(HermesUpdate {
                binary: [2, 3, 1].into(),
                publish_time: 1010,
                prev_publish_time: 1009,
            }))
            .unwrap();

        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 3, 1].into(),
                context: [0, 1, 5].into(),
            }
        );

        // Stream should disconnect on error or timeout.
        hermes_updates_sender
            .send(Err(format_err!("timeout")))
            .await?;
        sleep(delay).await;
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 8, 7].into(),
                publish_time: 1004,
                prev_publish_time: 1004,
            }]))
            .await
            .expect_err("stream should be disconnected");

        // New stream connection will be established upon the next request.
        let (hermes_updates_sender, hermes_updates_receiver) = mpsc::channel(1000);
        hermes_client
            .mock
            .queue(|m| &mut m.fetch_updates)
            .await
            .push_back(Box::new(move |id| {
                Box::pin(async move {
                    assert_eq!(id, price_feed_id);
                    Ok(Box::pin(ReceiverStream::new(hermes_updates_receiver)) as BoxStream<_>)
                })
            }));

        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1020,
                context: [0, 1, 8].into(),
            })
            .await;

        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 3, 5].into(),
                publish_time: 1018,
                prev_publish_time: 1017,
            }]))
            .await?;
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 3, 6].into(),
                publish_time: 1020,
                prev_publish_time: 1018,
            }]))
            .await?;
        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 3, 6].into(),
                context: [0, 1, 8].into(),
            }
        );

        price_fetcher
            .handle(PriceRequest {
                price_feed_id: price_feed_id.into(),
                timestamp: 1030,
                context: [0, 1, 9].into(),
            })
            .await;
        sleep(delay).await;

        // Stream should disconnect on error or timeout.
        // New stream connection will be established immediately because there is a pending request.
        let (hermes_updates_sender2, hermes_updates_receiver2) = mpsc::channel(1000);
        hermes_client
            .mock
            .queue(|m| &mut m.fetch_updates)
            .await
            .push_back(Box::new(move |id| {
                Box::pin(async move {
                    assert_eq!(id, price_feed_id);
                    Ok(Box::pin(ReceiverStream::new(hermes_updates_receiver2)) as BoxStream<_>)
                })
            }));

        hermes_updates_sender
            .send(Err(format_err!("Segmentation fault (core dumped)")))
            .await?;
        sleep(delay).await;
        hermes_updates_sender
            .send(Ok(vec![HermesUpdate {
                binary: [2, 2, 8, 7].into(),
                publish_time: 1022,
                prev_publish_time: 1020,
            }]))
            .await
            .expect_err("stream should be disconnected");

        hermes_updates_sender2
            .send(Ok(vec![HermesUpdate {
                binary: [2, 3, 7].into(),
                publish_time: 1028,
                prev_publish_time: 1027,
            }]))
            .await?;

        hermes_updates_sender2
            .send(Ok(vec![HermesUpdate {
                binary: [2, 3, 8].into(),
                publish_time: 1030,
                prev_publish_time: 1028,
            }]))
            .await?;
        assert_eq!(
            response_receiver.recv().await.unwrap(),
            PriceResponse {
                update_data: [2, 3, 8].into(),
                context: [0, 1, 9].into(),
            }
        );

        Ok(())
    }
}
