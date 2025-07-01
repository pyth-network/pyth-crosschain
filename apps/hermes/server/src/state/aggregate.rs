use anyhow::Context;
use log::warn;
#[cfg(test)]
use mock_instant::{SystemTime, UNIX_EPOCH};
use pythnet_sdk::messages::TwapMessage;

#[cfg(not(test))]
use std::time::{SystemTime, UNIX_EPOCH};

use {
    self::wormhole_merkle::{
        construct_message_states_proofs, construct_update_data,
        store_wormhole_merkle_verified_message, WormholeMerkleMessageProof, WormholeMerkleState,
    },
    crate::{
        api::types::{ParsedPublisherStakeCap, ParsedPublisherStakeCapsUpdate},
        network::wormhole::VaaBytes,
        state::{
            benchmarks::Benchmarks,
            cache::{Cache, MessageState, MessageStateFilter},
            price_feeds_metadata::PriceFeedMeta,
            State,
        },
    },
    anyhow::{anyhow, Result},
    borsh::BorshDeserialize,
    byteorder::BigEndian,
    prometheus_client::registry::Registry,
    pyth_sdk::{Price, PriceFeed, PriceIdentifier},
    pythnet_sdk::{
        messages::{Message, MessageType, PUBLISHER_STAKE_CAPS_MESSAGE_FEED_ID},
        wire::{
            from_slice,
            v1::{WormholeMessage, WormholePayload},
        },
    },
    rust_decimal::Decimal,
    serde::Serialize,
    solana_sdk::pubkey::Pubkey,
    std::{collections::HashSet, time::Duration},
    tokio::sync::{
        broadcast::{Receiver, Sender},
        RwLock,
    },
    wormhole_sdk::Vaa,
};
pub mod metrics;
pub mod wormhole_merkle;

#[derive(Clone, PartialEq, Debug)]
pub struct ProofSet {
    pub wormhole_merkle_proof: WormholeMerkleMessageProof,
}

pub type Slot = u64;

/// The number of seconds since the Unix epoch (00:00:00 UTC on 1 Jan 1970). The timestamp is
/// always positive, but represented as a signed integer because that's the standard on Unix
/// systems and allows easy subtraction to compute durations.
pub type UnixTimestamp = i64;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RequestTime {
    Latest,
    LatestTimeEarliestSlot,
    FirstAfter(UnixTimestamp),
    AtSlot(Slot),
}

pub type RawMessage = Vec<u8>;

/// An event that is emitted when an aggregation is completed.
#[derive(Clone, PartialEq, Debug)]
pub enum AggregationEvent {
    New { slot: Slot },
    OutOfOrder { slot: Slot },
}

impl AggregationEvent {
    pub fn slot(&self) -> Slot {
        match self {
            AggregationEvent::New { slot } => *slot,
            AggregationEvent::OutOfOrder { slot } => *slot,
        }
    }
}

pub struct AggregateStateData {
    /// The latest completed slot. This is used to check whether a completed state is new or out of
    /// order.
    pub latest_completed_slot: Option<Slot>,

    /// Time of the latest completed update. This is used for the health probes.
    pub latest_completed_update_time: Option<SystemTime>,

    /// The latest observed slot among different Aggregate updates. This is used for the health
    /// probes. The slot is not necessarily the maximum observed slot but it should be close
    /// to the maximum. The maximum observed slot is not used because sometimes due to some
    /// network issues we might receive an update with a much higher slot specially during
    /// the forks.
    pub latest_observed_slot: Option<Slot>,

    /// The duration of no aggregation after which the readiness of the state is considered stale.
    pub readiness_staleness_threshold: Duration,

    /// The maximum allowed slot lag between the latest observed slot and the latest completed slot.
    pub readiness_max_allowed_slot_lag: Slot,

    /// Aggregate Specific Metrics
    pub metrics: metrics::Metrics,
}

impl AggregateStateData {
    pub fn new(
        readiness_staleness_threshold: Duration,
        readiness_max_allowed_slot_lag: Slot,
        metrics_registry: &mut Registry,
    ) -> Self {
        Self {
            latest_completed_slot: None,
            latest_completed_update_time: None,
            latest_observed_slot: None,
            metrics: metrics::Metrics::new(metrics_registry),
            readiness_staleness_threshold,
            readiness_max_allowed_slot_lag,
        }
    }
}

pub struct AggregateState {
    pub data: RwLock<AggregateStateData>,
    pub api_update_tx: Sender<AggregationEvent>,
}

impl AggregateState {
    pub fn new(
        update_tx: Sender<AggregationEvent>,
        readiness_staleness_threshold: Duration,
        readiness_max_allowed_slot_lag: Slot,
        metrics_registry: &mut Registry,
    ) -> Self {
        Self {
            data: RwLock::new(AggregateStateData::new(
                readiness_staleness_threshold,
                readiness_max_allowed_slot_lag,
                metrics_registry,
            )),
            api_update_tx: update_tx,
        }
    }
}

/// Accumulator messages coming from Pythnet validators.
///
/// The validators writes the accumulator messages using Borsh with
/// the following struct. We cannot directly have messages as Vec<Messages>
/// because they are serialized using big-endian byte order and Borsh
/// uses little-endian byte order.
#[derive(Clone, PartialEq, Debug, BorshDeserialize)]
pub struct AccumulatorMessages {
    pub magic: [u8; 4],
    pub slot: u64,
    pub ring_size: u32,
    pub raw_messages: Vec<RawMessage>,
}

impl AccumulatorMessages {
    #[allow(clippy::cast_possible_truncation, reason = "intended truncation")]
    pub fn ring_index(&self) -> u32 {
        (self.slot % u64::from(self.ring_size)) as u32
    }
}

#[derive(Debug)]
pub enum Update {
    Vaa(VaaBytes),
    AccumulatorMessages(AccumulatorMessages),
}

#[derive(Debug, PartialEq)]
pub struct PriceFeedTwap {
    pub id: PriceIdentifier,
    pub start_timestamp: UnixTimestamp,
    pub end_timestamp: UnixTimestamp,
    pub twap: Price,
    pub down_slots_ratio: Decimal,
}

#[derive(Debug, PartialEq)]
pub struct PriceFeedUpdate {
    pub price_feed: PriceFeed,
    pub slot: Option<Slot>,
    pub received_at: Option<UnixTimestamp>,
    pub update_data: Option<Vec<u8>>,
    pub prev_publish_time: Option<UnixTimestamp>,
}

#[derive(Debug, PartialEq)]
pub struct PriceFeedsWithUpdateData {
    pub price_feeds: Vec<PriceFeedUpdate>,
    pub update_data: Vec<Vec<u8>>,
}

#[derive(Debug, PartialEq)]
pub struct PublisherStakeCapsWithUpdateData {
    pub publisher_stake_caps: Vec<ParsedPublisherStakeCapsUpdate>,
    pub update_data: Vec<Vec<u8>>,
}

#[derive(Debug)]
pub struct TwapsWithUpdateData {
    pub twaps: Vec<PriceFeedTwap>,
    pub update_data: Vec<Vec<u8>>,
}

#[derive(Debug, Serialize)]
pub struct ReadinessMetadata {
    pub has_completed_recently: bool,
    pub is_not_behind: bool,
    pub is_metadata_loaded: bool,
    pub latest_completed_slot: Option<Slot>,
    pub latest_observed_slot: Option<Slot>,
    pub latest_completed_unix_timestamp: Option<UnixTimestamp>,
    pub price_feeds_metadata_len: usize,
}

#[async_trait::async_trait]
pub trait Aggregates
where
    Self: Cache,
    Self: Benchmarks,
    Self: PriceFeedMeta,
{
    fn subscribe(&self) -> Receiver<AggregationEvent>;
    async fn is_ready(&self) -> (bool, ReadinessMetadata);
    async fn store_update(&self, update: Update) -> Result<()>;
    async fn get_price_feed_ids(&self) -> HashSet<PriceIdentifier>;
    async fn get_price_feeds_with_update_data(
        &self,
        price_ids: &[PriceIdentifier],
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithUpdateData>;
    async fn get_latest_publisher_stake_caps_with_update_data(
        &self,
    ) -> Result<PublisherStakeCapsWithUpdateData>;
    async fn get_twaps_with_update_data(
        &self,
        price_ids: &[PriceIdentifier],
        window_seconds: u64,
        end_time: RequestTime,
    ) -> Result<TwapsWithUpdateData>;
}

/// Allow downcasting State into CacheState for functions that depend on the `Cache` service.
impl<'a> From<&'a State> for &'a AggregateState {
    fn from(state: &'a State) -> &'a AggregateState {
        &state.aggregates
    }
}

#[async_trait::async_trait]
impl<T> Aggregates for T
where
    for<'a> &'a T: Into<&'a AggregateState>,
    T: Sync,
    T: Send,
    T: Cache,
    T: Benchmarks,
    T: PriceFeedMeta,
{
    fn subscribe(&self) -> Receiver<AggregationEvent> {
        self.into().api_update_tx.subscribe()
    }

    /// Stores the update data in the store
    #[tracing::instrument(skip(self, update))]
    async fn store_update(&self, update: Update) -> Result<()> {
        // The slot that the update is originating from. It should be available
        // in all the updates.
        let slot = match update {
            Update::Vaa(update_vaa) => {
                let vaa = serde_wormhole::from_slice::<Vaa<&serde_wormhole::RawMessage>>(
                    update_vaa.as_ref(),
                )?;
                match WormholeMessage::try_from_bytes(vaa.payload)?.payload {
                    WormholePayload::Merkle(proof) => {
                        tracing::info!(slot = proof.slot, "Storing VAA Merkle Proof.");

                        // Store the wormhole merkle verified message and check if it was already stored
                        let is_new = store_wormhole_merkle_verified_message(
                            self,
                            proof.clone(),
                            update_vaa.to_owned(),
                        )
                        .await?;

                        // If the message was already stored, return early
                        if !is_new {
                            tracing::info!(
                                slot = proof.slot,
                                "VAA Merkle Proof already stored, skipping."
                            );
                            return Ok(());
                        }

                        self.into()
                            .data
                            .write()
                            .await
                            .metrics
                            .observe(proof.slot, metrics::Event::Vaa);

                        proof.slot
                    }
                }
            }
            Update::AccumulatorMessages(accumulator_messages) => {
                let slot = accumulator_messages.slot;
                tracing::info!(slot = slot, "Storing Accumulator Messages.");

                // Store the accumulator messages and check if they were already stored in a single operation
                // This avoids the race condition where multiple threads could check and find nothing
                // but then both store the same messages
                let is_new = self
                    .store_accumulator_messages(accumulator_messages)
                    .await?;

                // If the messages were already stored, return early
                if !is_new {
                    tracing::info!(
                        slot = slot,
                        "Accumulator Messages already stored, skipping."
                    );
                    return Ok(());
                }

                self.into()
                    .data
                    .write()
                    .await
                    .metrics
                    .observe(slot, metrics::Event::AccumulatorMessages);
                slot
            }
        };

        // Update the aggregate state with the latest observed slot
        {
            let mut aggregate_state = self.into().data.write().await;
            aggregate_state.latest_observed_slot = Some(slot);
        }

        let accumulator_messages = self.fetch_accumulator_messages(slot).await?;
        let wormhole_merkle_state = self.fetch_wormhole_merkle_state(slot).await?;

        let (accumulator_messages, wormhole_merkle_state) =
            match (accumulator_messages, wormhole_merkle_state) {
                (Some(accumulator_messages), Some(wormhole_merkle_state)) => {
                    (accumulator_messages, wormhole_merkle_state)
                }
                _ => return Ok(()),
            };

        tracing::info!(slot = wormhole_merkle_state.root.slot, "Completed Update.");

        // Once the accumulator reaches a complete state for a specific slot
        // we can build the message states
        let message_states = build_message_states(accumulator_messages, wormhole_merkle_state)?;

        let message_state_keys = message_states
            .iter()
            .map(|message_state| message_state.key())
            .collect::<HashSet<_>>();

        tracing::info!(len = message_states.len(), "Storing Message States.");
        self.store_message_states(message_states).await?;

        // Update the aggregate state
        let mut aggregate_state = self.into().data.write().await;

        // Atomic check and update
        let event = match aggregate_state.latest_completed_slot {
            None => {
                aggregate_state.latest_completed_slot = Some(slot);
                AggregationEvent::New { slot }
            }
            Some(latest) if slot > latest => {
                self.prune_removed_keys(message_state_keys).await;
                aggregate_state.latest_completed_slot = Some(slot);
                AggregationEvent::New { slot }
            }
            _ => AggregationEvent::OutOfOrder { slot },
        };

        // Only send the event after the state has been updated
        let _ = self.into().api_update_tx.send(event);

        aggregate_state.latest_completed_slot = aggregate_state
            .latest_completed_slot
            .map(|latest| latest.max(slot))
            .or(Some(slot));

        aggregate_state
            .latest_completed_update_time
            .replace(SystemTime::now());

        aggregate_state
            .metrics
            .observe(slot, metrics::Event::CompletedUpdate);

        Ok(())
    }

    async fn get_twaps_with_update_data(
        &self,
        price_ids: &[PriceIdentifier],
        window_seconds: u64,
        end_time: RequestTime,
    ) -> Result<TwapsWithUpdateData> {
        match get_verified_twaps_with_update_data(self, price_ids, window_seconds, end_time.clone())
            .await
        {
            Ok(twaps_with_update_data) => Ok(twaps_with_update_data),
            Err(e) => {
                // TODO: Hit benchmarks if data not found in the cache
                tracing::debug!("Update data not found in cache, falling back to Benchmarks");
                Err(e)
            }
        }
    }

    async fn get_price_feeds_with_update_data(
        &self,
        price_ids: &[PriceIdentifier],
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithUpdateData> {
        match get_verified_price_feeds(self, price_ids, request_time.clone()).await {
            Ok(price_feeds_with_update_data) => Ok(price_feeds_with_update_data),
            Err(e) => {
                if let RequestTime::FirstAfter(publish_time) = request_time {
                    return Benchmarks::get_verified_price_feeds(self, price_ids, publish_time)
                        .await;
                }
                Err(e)
            }
        }
    }

    async fn get_latest_publisher_stake_caps_with_update_data(
        &self,
    ) -> Result<PublisherStakeCapsWithUpdateData> {
        let messages = self
            .fetch_message_states(
                vec![PUBLISHER_STAKE_CAPS_MESSAGE_FEED_ID],
                RequestTime::Latest,
                MessageStateFilter::Only(MessageType::PublisherStakeCapsMessage),
            )
            .await?;

        let publisher_stake_caps = messages
            .iter()
            .map(|message_state| match message_state.message.clone() {
                Message::PublisherStakeCapsMessage(message) => Ok(ParsedPublisherStakeCapsUpdate {
                    publisher_stake_caps: message
                        .caps
                        .iter()
                        .map(|cap| ParsedPublisherStakeCap {
                            publisher: Pubkey::from(cap.publisher).to_string(),
                            cap: cap.cap,
                        })
                        .collect(),
                }),
                _ => Err(anyhow!("Invalid message state type")),
            })
            .collect::<Result<Vec<_>>>()?;

        let update_data = construct_update_data(messages.into_iter().map(|m| m.into()).collect())?;
        Ok(PublisherStakeCapsWithUpdateData {
            publisher_stake_caps,
            update_data,
        })
    }

    async fn get_price_feed_ids(&self) -> HashSet<PriceIdentifier> {
        Cache::message_state_keys(self)
            .await
            .iter()
            .filter(|key| key.feed_id != PUBLISHER_STAKE_CAPS_MESSAGE_FEED_ID)
            .map(|key| PriceIdentifier::new(key.feed_id))
            .collect()
    }

    async fn is_ready(&self) -> (bool, ReadinessMetadata) {
        let state_data = self.into().data.read().await;
        let price_feeds_metadata = PriceFeedMeta::retrieve_price_feeds_metadata(self)
            .await
            .unwrap_or_else(|err| {
                tracing::error!(
                    "unexpected failure of PriceFeedMeta::retrieve_price_feeds_metadata(self): {err}"
                );
                Vec::new()
            });

        let current_time = SystemTime::now();

        let has_completed_recently = match state_data.latest_completed_update_time {
            Some(latest_completed_update_time) => {
                current_time
                    .duration_since(latest_completed_update_time)
                    .unwrap_or(Duration::from_secs(0))
                    < state_data.readiness_staleness_threshold
            }
            None => false,
        };

        let is_not_behind = match (
            state_data.latest_completed_slot,
            state_data.latest_observed_slot,
        ) {
            (Some(latest_completed_slot), Some(latest_observed_slot)) => {
                latest_observed_slot.saturating_sub(latest_completed_slot)
                    <= state_data.readiness_max_allowed_slot_lag
            }
            _ => false,
        };

        let is_metadata_loaded = !price_feeds_metadata.is_empty();
        (
            has_completed_recently && is_not_behind && is_metadata_loaded,
            ReadinessMetadata {
                has_completed_recently,
                is_not_behind,
                is_metadata_loaded,
                latest_completed_slot: state_data.latest_completed_slot,
                latest_observed_slot: state_data.latest_observed_slot,
                latest_completed_unix_timestamp: state_data.latest_completed_update_time.and_then(
                    |t| {
                        t.duration_since(UNIX_EPOCH)
                            .ok()
                            .and_then(|d| d.as_secs().try_into().ok())
                    },
                ),
                price_feeds_metadata_len: price_feeds_metadata.len(),
            },
        )
    }
}

#[tracing::instrument(skip(accumulator_messages, wormhole_merkle_state))]
fn build_message_states(
    accumulator_messages: AccumulatorMessages,
    wormhole_merkle_state: WormholeMerkleState,
) -> Result<Vec<MessageState>> {
    let wormhole_merkle_message_states_proofs =
        construct_message_states_proofs(&accumulator_messages, &wormhole_merkle_state)?;

    let current_time: UnixTimestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)?
        .as_secs()
        .try_into()
        .context("timestamp overflow")?;

    accumulator_messages
        .raw_messages
        .into_iter()
        .enumerate()
        .map(|(idx, raw_message)| {
            Ok(MessageState::new(
                from_slice::<BigEndian, _>(raw_message.as_ref())
                    .map_err(|e| anyhow!("Failed to deserialize message: {:?}", e))?,
                raw_message,
                ProofSet {
                    wormhole_merkle_proof: wormhole_merkle_message_states_proofs
                        .get(idx)
                        .ok_or(anyhow!("Missing proof for message"))?
                        .clone(),
                },
                accumulator_messages.slot,
                current_time,
            ))
        })
        .collect::<Result<Vec<_>>>()
}

async fn get_verified_price_feeds<S>(
    state: &S,
    price_ids: &[PriceIdentifier],
    request_time: RequestTime,
) -> Result<PriceFeedsWithUpdateData>
where
    S: Cache,
{
    let messages = state
        .fetch_message_states(
            price_ids
                .iter()
                .map(|price_id| price_id.to_bytes())
                .collect(),
            request_time,
            MessageStateFilter::Only(MessageType::PriceFeedMessage),
        )
        .await?;

    let price_feeds = messages
        .iter()
        .map(|message_state| match message_state.message {
            Message::PriceFeedMessage(price_feed) => Ok(PriceFeedUpdate {
                price_feed: PriceFeed::new(
                    PriceIdentifier::new(price_feed.feed_id),
                    Price {
                        price: price_feed.price,
                        conf: price_feed.conf,
                        expo: price_feed.exponent,
                        publish_time: price_feed.publish_time,
                    },
                    Price {
                        price: price_feed.ema_price,
                        conf: price_feed.ema_conf,
                        expo: price_feed.exponent,
                        publish_time: price_feed.publish_time,
                    },
                ),
                received_at: Some(message_state.received_at),
                slot: Some(message_state.slot),
                update_data: Some(
                    construct_update_data(vec![message_state.clone().into()])?
                        .into_iter()
                        .next()
                        .ok_or(anyhow!("Missing update data for message"))?,
                ),
                prev_publish_time: Some(price_feed.prev_publish_time),
            }),
            _ => Err(anyhow!("Invalid message state type")),
        })
        .collect::<Result<Vec<_>>>()?;

    let update_data = construct_update_data(messages.into_iter().map(|m| m.into()).collect())?;

    Ok(PriceFeedsWithUpdateData {
        price_feeds,
        update_data,
    })
}

async fn get_verified_twaps_with_update_data<S>(
    state: &S,
    price_ids: &[PriceIdentifier],
    window_seconds: u64,
    end_time: RequestTime,
) -> Result<TwapsWithUpdateData>
where
    S: Cache,
{
    // Get all end messages for all price IDs
    let end_messages = state
        .fetch_message_states(
            price_ids.iter().map(|id| id.to_bytes()).collect(),
            end_time.clone(),
            MessageStateFilter::Only(MessageType::TwapMessage),
        )
        .await?;

    // Calculate start_time based on the publish time of the end messages
    // to guarantee that the start and end messages are window_seconds apart
    let start_timestamp = if end_messages.is_empty() {
        // If there are no end messages, we can't calculate a TWAP
        tracing::warn!(
            price_ids = ?price_ids,
            time = ?end_time,
            "Could not find TWAP messages"
        );
        return Err(anyhow!(
            "Update data not found for the specified timestamps"
        ));
    } else {
        // Use the publish time from the first end message
        end_messages
            .first()
            .context("no messages found")?
            .message
            .publish_time()
            - i64::try_from(window_seconds).context("window size overflow")?
    };
    let start_time = RequestTime::FirstAfter(start_timestamp);

    // Get all start messages for all price IDs
    let start_messages = state
        .fetch_message_states(
            price_ids.iter().map(|id| id.to_bytes()).collect(),
            start_time.clone(),
            MessageStateFilter::Only(MessageType::TwapMessage),
        )
        .await?;

    if start_messages.is_empty() {
        tracing::warn!(
            price_ids = ?price_ids,
            time = ?start_time,
            "Could not find TWAP messages"
        );
        return Err(anyhow!(
            "Update data not found for the specified timestamps"
        ));
    }

    // Verify we have matching start and end messages.
    // The cache should throw an error earlier, but checking just in case.
    if start_messages.len() != end_messages.len() {
        tracing::warn!(
            price_ids = ?price_ids,
            start_message_length = ?price_ids,
            end_message_length = ?start_time,
            "Start and end messages length mismatch"
        );
        return Err(anyhow!(
            "Update data not found for the specified timestamps"
        ));
    }

    let mut twaps = Vec::new();

    // Iterate through start and end messages together
    for (start_message, end_message) in start_messages.iter().zip(end_messages.iter()) {
        if let (Message::TwapMessage(start_twap), Message::TwapMessage(end_twap)) =
            (&start_message.message, &end_message.message)
        {
            match calculate_twap(start_twap, end_twap) {
                Ok(twap_price) => {
                    // down_slots_ratio describes the % of slots where the network was down
                    // over the TWAP window. A value closer to zero indicates higher confidence.
                    let total_slots = end_twap.publish_slot - start_twap.publish_slot;
                    let total_down_slots = end_twap.num_down_slots - start_twap.num_down_slots;
                    let down_slots_ratio =
                        Decimal::from(total_down_slots) / Decimal::from(total_slots);

                    // Add to calculated TWAPs
                    twaps.push(PriceFeedTwap {
                        id: PriceIdentifier::new(start_twap.feed_id),
                        twap: twap_price,
                        start_timestamp: start_twap.publish_time,
                        end_timestamp: end_twap.publish_time,
                        down_slots_ratio,
                    });
                }
                Err(e) => {
                    tracing::error!(
                        feed_id = ?start_twap.feed_id,
                        error = %e,
                        "Failed to calculate TWAP for price feed"
                    );
                    return Err(anyhow!(
                        "Failed to calculate TWAP for price feed {:?}: {}",
                        start_twap.feed_id,
                        e
                    ));
                }
            }
        }
    }

    // Construct update data.
    // update_data[0] contains the start VAA and merkle proofs
    // update_data[1] contains the end VAA and merkle proofs
    let mut update_data =
        construct_update_data(start_messages.into_iter().map(Into::into).collect())?;
    update_data.extend(construct_update_data(
        end_messages.into_iter().map(Into::into).collect(),
    )?);

    Ok(TwapsWithUpdateData { twaps, update_data })
}

fn calculate_twap(start_message: &TwapMessage, end_message: &TwapMessage) -> Result<Price> {
    if end_message.publish_slot <= start_message.publish_slot {
        return Err(anyhow!(
            "Cannot calculate TWAP - end slot must be greater than start slot"
        ));
    }

    // Validate that messages are the first ones in their timestamp
    // This is necessary to ensure that this TWAP is deterministic,
    // Since there can be multiple messages in a single second.
    if start_message.prev_publish_time >= start_message.publish_time {
        return Err(anyhow!(
            "Start message is not the first update for its timestamp"
        ));
    }

    if end_message.prev_publish_time >= end_message.publish_time {
        return Err(anyhow!(
            "End message is not the first update for its timestamp"
        ));
    }

    let slot_diff = end_message
        .publish_slot
        .checked_sub(start_message.publish_slot)
        .ok_or_else(|| anyhow!("Slot difference overflow"))?;

    let price_diff = end_message
        .cumulative_price
        .checked_sub(start_message.cumulative_price)
        .ok_or_else(|| anyhow!("Price difference overflow"))?;

    let conf_diff = end_message
        .cumulative_conf
        .checked_sub(start_message.cumulative_conf)
        .ok_or_else(|| anyhow!("Confidence difference overflow"))?;

    // Perform division before casting to maintain precision
    // Cast slot_diff to the same type as price / conf diff before division
    let price = i64::try_from(price_diff / i128::from(slot_diff))
        .map_err(|e| anyhow!("Price overflow after division: {}", e))?;
    let conf = u64::try_from(conf_diff / u128::from(slot_diff))
        .map_err(|e| anyhow!("Confidence overflow after division: {}", e))?;

    Ok(Price {
        price,
        conf,
        expo: end_message.exponent,
        publish_time: end_message.publish_time,
    })
}

#[cfg(test)]
#[allow(
    clippy::unwrap_used,
    clippy::indexing_slicing,
    clippy::cast_possible_wrap,
    reason = "tests"
)]
mod test {
    use {
        super::*,
        crate::{
            api::types::{PriceFeedMetadata, RpcPriceIdentifier},
            state::test::setup_state,
        },
        futures::future::join_all,
        mock_instant::MockClock,
        pythnet_sdk::{
            accumulators::{
                merkle::{MerkleRoot, MerkleTree},
                Accumulator,
            },
            hashers::keccak256_160::Keccak160,
            messages::PriceFeedMessage,
            wire::v1::{AccumulatorUpdateData, Proof, WormholeMerkleRoot},
        },
        rand::seq::SliceRandom,
        rust_decimal::prelude::FromPrimitive,
        serde_wormhole::RawMessage,
        std::sync::Arc,
        wormhole_sdk::{Address, Chain},
    };

    /// Generate list of updates for the given list of messages at a given slot with given sequence
    ///
    /// Sequence in Vaas is used to filter duplicate messages (as by wormhole design there is only
    /// one message per sequence).
    pub fn generate_update(messages: Vec<Message>, slot: Slot, sequence: u64) -> Vec<Update> {
        let mut updates = Vec::new();

        // Accumulator messages
        let accumulator_messages = AccumulatorMessages {
            slot,
            raw_messages: messages
                .iter()
                .map(|message| pythnet_sdk::wire::to_vec::<_, byteorder::BE>(message).unwrap())
                .collect(),
            magic: [0; 4],
            ring_size: 100,
        };
        updates.push(Update::AccumulatorMessages(accumulator_messages.clone()));

        // Wormhole merkle update
        let merkle_tree = MerkleTree::<Keccak160>::from_set(
            accumulator_messages.raw_messages.iter().map(|m| m.as_ref()),
        )
        .unwrap();

        let wormhole_message = WormholeMessage::new(WormholePayload::Merkle(WormholeMerkleRoot {
            slot,
            ring_size: 100,
            root: merkle_tree.root.as_bytes().try_into().unwrap(),
        }));

        let wormhole_message =
            pythnet_sdk::wire::to_vec::<_, byteorder::BE>(&wormhole_message).unwrap();

        let vaa = Vaa {
            nonce: 0,
            version: 0,
            sequence,
            timestamp: 0,
            signatures: vec![],    // We are bypassing signature check now
            guardian_set_index: 0, // We are bypassing signature check now
            emitter_chain: Chain::Pythnet,
            emitter_address: Address(pythnet_sdk::ACCUMULATOR_EMITTER_ADDRESS),
            consistency_level: 0,
            payload: serde_wormhole::RawMessage::new(wormhole_message.as_ref()),
        };

        updates.push(Update::Vaa(serde_wormhole::to_vec(&vaa).unwrap()));

        updates
    }
    /// Create a dummy price feed base on the given seed for all the fields except
    /// `publish_time` and `prev_publish_time`. Those are set to the given value.
    pub fn create_dummy_price_feed_message(
        seed: u8,
        publish_time: i64,
        prev_publish_time: i64,
    ) -> PriceFeedMessage {
        PriceFeedMessage {
            feed_id: [seed; 32],
            price: seed.into(),
            conf: seed.into(),
            exponent: 0,
            ema_conf: seed.into(),
            ema_price: seed.into(),
            publish_time,
            prev_publish_time,
        }
    }

    pub async fn store_multiple_concurrent_valid_updates<S>(state: Arc<S>, updates: Vec<Update>)
    where
        S: Aggregates,
        S: Send + Sync + 'static,
    {
        let res = join_all(updates.into_iter().map(|u| state.store_update(u))).await;
        // Check that all store_update calls succeeded
        assert!(res.into_iter().all(|r| r.is_ok()));
    }

    #[tokio::test]
    pub async fn test_store_works() {
        let (state, mut update_rx) = setup_state(10).await;

        let price_feed_message = create_dummy_price_feed_message(100, 10, 9);

        // Populate the state
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(vec![Message::PriceFeedMessage(price_feed_message)], 10, 20),
        )
        .await;

        // Check that the update_rx channel has received a message
        assert_eq!(
            update_rx.recv().await,
            Ok(AggregationEvent::New { slot: 10 })
        );

        // Check the price ids are stored correctly
        assert_eq!(
            (*state).get_price_feed_ids().await,
            vec![PriceIdentifier::new([100; 32])].into_iter().collect()
        );

        // Check get_price_feeds_with_update_data retrieves the correct
        // price feed with correct update data.
        let price_feeds_with_update_data = (*state)
            .get_price_feeds_with_update_data(
                &[PriceIdentifier::new([100; 32])],
                RequestTime::Latest,
            )
            .await
            .unwrap();

        assert_eq!(
            price_feeds_with_update_data.price_feeds,
            vec![PriceFeedUpdate {
                price_feed: PriceFeed::new(
                    PriceIdentifier::new(price_feed_message.feed_id),
                    Price {
                        price: price_feed_message.price,
                        conf: price_feed_message.conf,
                        expo: price_feed_message.exponent,
                        publish_time: price_feed_message.publish_time,
                    },
                    Price {
                        price: price_feed_message.ema_price,
                        conf: price_feed_message.ema_conf,
                        expo: price_feed_message.exponent,
                        publish_time: price_feed_message.publish_time,
                    }
                ),
                slot: Some(10),
                received_at: price_feeds_with_update_data.price_feeds[0].received_at, // Ignore checking this field.
                update_data: price_feeds_with_update_data.price_feeds[0]
                    .update_data
                    .clone(), // Ignore checking this field.
                prev_publish_time: Some(9),
            }]
        );

        // Check the update data is correct.
        assert_eq!(price_feeds_with_update_data.update_data.len(), 1);
        let update_data = price_feeds_with_update_data.update_data.first().unwrap();
        let update_data = AccumulatorUpdateData::try_from_slice(update_data.as_ref()).unwrap();
        match update_data.proof {
            Proof::WormholeMerkle { vaa, updates } => {
                // Check the vaa and get the root
                let vaa: Vec<u8> = vaa.into();
                let vaa: Vaa<&RawMessage> = serde_wormhole::from_slice(vaa.as_ref()).unwrap();
                assert_eq!(
                    vaa,
                    Vaa {
                        nonce: 0,
                        version: 0,
                        sequence: 20,
                        timestamp: 0,
                        signatures: vec![],
                        guardian_set_index: 0,
                        emitter_chain: Chain::Pythnet,
                        emitter_address: Address(pythnet_sdk::ACCUMULATOR_EMITTER_ADDRESS),
                        consistency_level: 0,
                        payload: vaa.payload, // Ignore checking this field.
                    }
                );
                let merkle_root = WormholeMessage::try_from_bytes(vaa.payload.as_ref()).unwrap();
                let WormholePayload::Merkle(merkle_root) = merkle_root.payload;
                assert_eq!(
                    merkle_root,
                    WormholeMerkleRoot {
                        slot: 10,
                        ring_size: 100,
                        root: merkle_root.root, // Ignore checking this field.
                    }
                );

                // Check the updates
                assert_eq!(updates.len(), 1);
                let update = updates.first().unwrap();
                let message: Vec<u8> = update.message.clone().into();
                // Check the serialized message is the price feed message generated above.
                assert_eq!(
                    pythnet_sdk::wire::from_slice::<byteorder::BE, Message>(message.as_ref())
                        .unwrap(),
                    Message::PriceFeedMessage(price_feed_message)
                );

                // Check the proof is correct with the Vaa root
                let merkle_root = MerkleRoot::<Keccak160>::new(merkle_root.root);
                assert!(merkle_root.check(update.proof.clone(), message.as_ref()));
            }
        }
    }

    /// On this test we will initially have two price feeds. Then we will send an update with only
    /// price feed 1 (without price feed 2) and make sure that price feed 2 is not stored anymore.
    #[tokio::test]
    pub async fn test_getting_price_ids_works_fine_after_price_removal() {
        let (state, mut update_rx) = setup_state(10).await;

        let price_feed_1 = create_dummy_price_feed_message(100, 10, 9);
        let price_feed_2 = create_dummy_price_feed_message(200, 10, 9);

        // Populate the state
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![
                    Message::PriceFeedMessage(price_feed_1),
                    Message::PriceFeedMessage(price_feed_2),
                ],
                10,
                20,
            ),
        )
        .await;

        // Check that the update_rx channel has received a message
        assert_eq!(
            update_rx.recv().await,
            Ok(AggregationEvent::New { slot: 10 })
        );

        // Check the price ids are stored correctly
        assert_eq!(
            (*state).get_price_feed_ids().await,
            vec![
                PriceIdentifier::new([100; 32]),
                PriceIdentifier::new([200; 32])
            ]
            .into_iter()
            .collect()
        );

        // Check that price feed 2 exists
        assert!((*state)
            .get_price_feeds_with_update_data(
                &[PriceIdentifier::new([200; 32])],
                RequestTime::Latest,
            )
            .await
            .is_ok());

        // Now send an update with only price feed 1 (without price feed 2)
        // and make sure that price feed 2 is not stored anymore.
        let price_feed_1 = create_dummy_price_feed_message(100, 12, 10);

        // Populate the state
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(vec![Message::PriceFeedMessage(price_feed_1)], 15, 30),
        )
        .await;

        // Check that the update_rx channel has received a message
        assert_eq!(
            update_rx.recv().await,
            Ok(AggregationEvent::New { slot: 15 })
        );

        // Check that price feed 2 does not exist anymore
        assert_eq!(
            (*state).get_price_feed_ids().await,
            vec![PriceIdentifier::new([100; 32]),].into_iter().collect()
        );

        assert!((*state)
            .get_price_feeds_with_update_data(
                &[PriceIdentifier::new([200; 32])],
                RequestTime::Latest,
            )
            .await
            .is_err());
    }

    #[tokio::test]
    pub async fn test_metadata_times_and_readiness_work() {
        // The receiver channel should stay open for the state to work
        // properly. That is why we don't use _ here as it drops the channel
        // immediately.
        let (state, _receiver_tx) = setup_state(10).await;

        let price_feed_message = create_dummy_price_feed_message(100, 10, 9);

        // Advance the clock
        MockClock::advance_system_time(Duration::from_secs(1));
        MockClock::advance(Duration::from_secs(1));

        // Get the current unix timestamp. It is mocked using
        // mock-instance module. So it should remain the same
        // on the next call.
        let unix_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Populate the state
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(vec![Message::PriceFeedMessage(price_feed_message)], 10, 20),
        )
        .await;

        // Advance the clock again
        MockClock::advance_system_time(Duration::from_secs(1));
        MockClock::advance(Duration::from_secs(1));

        // Get the price feeds with update data
        let price_feeds_with_update_data = (*state)
            .get_price_feeds_with_update_data(
                &[PriceIdentifier::new([100; 32])],
                RequestTime::Latest,
            )
            .await
            .unwrap();

        // check received_at is correct
        assert_eq!(price_feeds_with_update_data.price_feeds.len(), 1);
        assert_eq!(
            price_feeds_with_update_data.price_feeds[0].received_at,
            Some(unix_timestamp as i64)
        );

        // Add a dummy price feeds metadata
        state
            .store_price_feeds_metadata(&[PriceFeedMetadata {
                id: RpcPriceIdentifier::new([100; 32]),
                attributes: Default::default(),
            }])
            .await
            .unwrap();

        // Check the state is ready
        assert!(state.is_ready().await.0);

        // Advance the clock to make the prices stale
        let staleness_threshold = Duration::from_secs(30);
        MockClock::advance_system_time(staleness_threshold);
        MockClock::advance(staleness_threshold);
        // Check the state is not ready
        assert!(!state.is_ready().await.0);
    }

    /// Test that the state retains the latest slots upon cache eviction.
    ///
    /// state is set up with cache size of 100 and 1000 slot updates will
    /// be stored all at the same time with random order.
    /// After the cache eviction, the state should retain the latest 100
    /// slots regardless of the order.
    #[tokio::test]
    pub async fn test_store_retains_latest_slots_upon_cache_eviction() {
        // The receiver channel should stay open for the store to work
        // properly. That is why we don't use _ here as it drops the channel
        // immediately.
        let (state, _receiver_tx) = setup_state(100).await;

        let mut updates: Vec<Update> = (0..1000)
            .flat_map(|slot| {
                let messages = vec![
                    Message::PriceFeedMessage(create_dummy_price_feed_message(
                        100,
                        slot as i64,
                        slot as i64,
                    )),
                    Message::PriceFeedMessage(create_dummy_price_feed_message(
                        200,
                        slot as i64,
                        slot as i64,
                    )),
                ];
                generate_update(messages, slot, slot)
            })
            .collect();

        // Shuffle the updates
        let mut rng = rand::thread_rng();
        updates.shuffle(&mut rng);

        // Store the updates
        store_multiple_concurrent_valid_updates(state.clone(), updates).await;

        // Check the last 100 slots are retained
        for slot in 900..1000 {
            let price_feeds_with_update_data = (*state)
                .get_price_feeds_with_update_data(
                    &[
                        PriceIdentifier::new([100; 32]),
                        PriceIdentifier::new([200; 32]),
                    ],
                    RequestTime::FirstAfter(slot as i64),
                )
                .await
                .unwrap();
            assert_eq!(price_feeds_with_update_data.price_feeds.len(), 2);
            assert_eq!(price_feeds_with_update_data.price_feeds[0].slot, Some(slot));
            assert_eq!(price_feeds_with_update_data.price_feeds[1].slot, Some(slot));
        }

        // Check nothing else is retained
        for slot in 0..900 {
            assert!((*state)
                .get_price_feeds_with_update_data(
                    &[
                        PriceIdentifier::new([100; 32]),
                        PriceIdentifier::new([200; 32])
                    ],
                    RequestTime::FirstAfter(slot.into()),
                )
                .await
                .is_err());
        }
    }

    /// Helper function to create a TWAP message with basic defaults
    pub(crate) fn create_basic_twap_message(
        feed_id: [u8; 32],
        cumulative_price: i128,
        num_down_slots: u64,
        publish_time: i64,
        prev_publish_time: i64,
        publish_slot: u64,
    ) -> Message {
        Message::TwapMessage(TwapMessage {
            feed_id,
            cumulative_price,
            cumulative_conf: 100,
            num_down_slots,
            exponent: 8,
            publish_time,
            prev_publish_time,
            publish_slot,
        })
    }

    #[tokio::test]
    async fn test_get_verified_twaps_with_update_data_returns_correct_prices() {
        let (state, _update_rx) = setup_state(10).await;
        let feed_id_1 = [1u8; 32];
        let feed_id_2 = [2u8; 32];

        // Store start TWAP messages for both feeds
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![
                    create_basic_twap_message(
                        feed_id_1, 100,  // cumulative_price
                        0,    // num_down_slots
                        100,  // publish_time
                        90,   // prev_publish_time
                        1000, // publish_slot
                    ),
                    create_basic_twap_message(
                        feed_id_2, 500,  // cumulative_price
                        10,   // num_down_slots
                        100,  // publish_time
                        90,   // prev_publish_time
                        1000, // publish_slot
                    ),
                ],
                1000,
                20,
            ),
        )
        .await;

        // Store end TWAP messages for both feeds
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![
                    create_basic_twap_message(
                        feed_id_1, 300,  // cumulative_price
                        50,   // num_down_slots
                        200,  // publish_time
                        180,  // prev_publish_time
                        1100, // publish_slot
                    ),
                    create_basic_twap_message(
                        feed_id_2, 900,  // cumulative_price
                        30,   // num_down_slots
                        200,  // publish_time
                        180,  // prev_publish_time
                        1100, // publish_slot
                    ),
                ],
                1100,
                21,
            ),
        )
        .await;

        // Get TWAPs over timestamp window 100 -> 200 for both feeds
        let result = get_verified_twaps_with_update_data(
            &*state,
            &[
                PriceIdentifier::new(feed_id_1),
                PriceIdentifier::new(feed_id_2),
            ],
            100,                          // window seconds
            RequestTime::FirstAfter(200), // End time
        )
        .await
        .unwrap();

        // Verify calculations are accurate for both feeds
        assert_eq!(result.twaps.len(), 2);

        // Verify feed 1
        let twap_1 = result
            .twaps
            .iter()
            .find(|t| t.id == PriceIdentifier::new(feed_id_1))
            .unwrap();
        assert_eq!(twap_1.twap.price, 2); // (300-100)/(1100-1000) = 2
        assert_eq!(twap_1.down_slots_ratio, Decimal::from_f64(0.5).unwrap()); // (50-0)/(1100-1000) = 0.5
        assert_eq!(twap_1.start_timestamp, 100);
        assert_eq!(twap_1.end_timestamp, 200);

        // Verify feed 2
        let twap_2 = result
            .twaps
            .iter()
            .find(|t| t.id == PriceIdentifier::new(feed_id_2))
            .unwrap();
        assert_eq!(twap_2.twap.price, 4); // (900-500)/(1100-1000) = 4
        assert_eq!(twap_2.down_slots_ratio, Decimal::from_f64(0.2).unwrap()); // (30-10)/(1100-1000) = 0.2
        assert_eq!(twap_2.start_timestamp, 100);
        assert_eq!(twap_2.end_timestamp, 200);

        // update_data should have 2 elements, one for the start block and one for the end block.
        assert_eq!(result.update_data.len(), 2);
    }

    #[tokio::test]
    /// Tests that the TWAP calculation correctly selects TWAP messages that are the first ones
    /// for their timestamp (non-optional prices). This is important because if a message such that
    /// `publish_time == prev_publish_time`is chosen, the TWAP calculation will fail due to the optionality check.
    async fn test_get_verified_twaps_with_update_data_uses_non_optional_prices() {
        let (state, _update_rx) = setup_state(10).await;
        let feed_id = [1u8; 32];

        // Store start TWAP message
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![create_basic_twap_message(
                    feed_id, 100,  // cumulative_price
                    0,    // num_down_slots
                    100,  // publish_time
                    99,   // prev_publish_time
                    1000, // publish_slot
                )],
                1000,
                20,
            ),
        )
        .await;

        // Store end TWAP messages

        // This first message has the latest publish_time and earliest slot,
        // so it should be chosen as the end_message to calculate TWAP with.
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![create_basic_twap_message(
                    feed_id, 300,  // cumulative_price
                    50,   // num_down_slots
                    200,  // publish_time
                    180,  // prev_publish_time
                    1100, // publish_slot
                )],
                1100,
                21,
            ),
        )
        .await;

        // This second message has the same publish_time as the previous one and a later slot.
        // It will fail the optionality check since publish_time == prev_publish_time.
        // Thus, it should not be chosen to calculate TWAP with.
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![create_basic_twap_message(
                    feed_id, 900,  // cumulative_price
                    50,   // num_down_slots
                    200,  // publish_time
                    200,  // prev_publish_time
                    1101, // publish_slot
                )],
                1101,
                22,
            ),
        )
        .await;

        // Get TWAPs over timestamp window 100 -> 200
        let result = get_verified_twaps_with_update_data(
            &*state,
            &[PriceIdentifier::new(feed_id)],
            100,                                 // window seconds
            RequestTime::LatestTimeEarliestSlot, // End time
        )
        .await
        .unwrap();

        // Verify that the first end message was chosen to calculate the TWAP
        // and that the calculation is accurate
        assert_eq!(result.twaps.len(), 1);
        let twap_1 = result
            .twaps
            .iter()
            .find(|t| t.id == PriceIdentifier::new(feed_id))
            .unwrap();
        assert_eq!(twap_1.twap.price, 2); // (300-100)/(1100-1000) = 2
        assert_eq!(twap_1.down_slots_ratio, Decimal::from_f64(0.5).unwrap()); // (50-0)/(1100-1000) = 0.5
        assert_eq!(twap_1.start_timestamp, 100);
        assert_eq!(twap_1.end_timestamp, 200);

        // update_data should have 2 elements, one for the start block and one for the end block.
        assert_eq!(result.update_data.len(), 2);
    }
    #[tokio::test]

    async fn test_get_verified_twaps_with_missing_messages_throws_error() {
        let (state, _update_rx) = setup_state(10).await;
        let feed_id_1 = [1u8; 32];
        let feed_id_2 = [2u8; 32];

        // Store both messages for feed_1
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![
                    create_basic_twap_message(
                        feed_id_1, 100,  // cumulative_price
                        0,    // num_down_slots
                        100,  // publish_time
                        90,   // prev_publish_time
                        1000, // publish_slot
                    ),
                    create_basic_twap_message(
                        feed_id_2, 500,  // cumulative_price
                        0,    // num_down_slots
                        100,  // publish_time
                        90,   // prev_publish_time
                        1000, // publish_slot
                    ),
                ],
                1000,
                20,
            ),
        )
        .await;

        // Store end message only for feed_1 (feed_2 missing end message)
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(
                vec![create_basic_twap_message(
                    feed_id_1, 300,  // cumulative_price
                    0,    // num_down_slots
                    200,  // publish_time
                    180,  // prev_publish_time
                    1100, // publish_slot
                )],
                1100,
                21,
            ),
        )
        .await;

        let result = get_verified_twaps_with_update_data(
            &*state,
            &[
                PriceIdentifier::new(feed_id_1),
                PriceIdentifier::new(feed_id_2),
            ],
            100,
            RequestTime::FirstAfter(200),
        )
        .await;

        assert_eq!(result.unwrap_err().to_string(), "Message not found");
    }

    /// Test that verifies only one event is sent per slot, even when updates arrive out of order
    /// or when a slot is processed multiple times.
    #[tokio::test]
    pub async fn test_out_of_order_updates_send_single_event_per_slot() {
        let (state, mut update_rx) = setup_state(10).await;

        // Create price feed messages
        let price_feed_100 = create_dummy_price_feed_message(100, 10, 9);
        let price_feed_101 = create_dummy_price_feed_message(100, 11, 10);

        // First, process slot 100
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(vec![Message::PriceFeedMessage(price_feed_100)], 100, 20),
        )
        .await;

        // Check that we received the New event for slot 100
        assert_eq!(
            update_rx.recv().await,
            Ok(AggregationEvent::New { slot: 100 })
        );

        // Next, process slot 101
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(vec![Message::PriceFeedMessage(price_feed_101)], 101, 21),
        )
        .await;

        // Check that we received the New event for slot 101
        assert_eq!(
            update_rx.recv().await,
            Ok(AggregationEvent::New { slot: 101 })
        );

        // Now, process slot 100 again
        store_multiple_concurrent_valid_updates(
            state.clone(),
            generate_update(vec![Message::PriceFeedMessage(price_feed_100)], 100, 22),
        )
        .await;

        // Try to receive another event with a timeout to ensure no more events were sent
        // We should not receive an OutOfOrder event for slot 100 since we've already sent an event for it
        let timeout_result =
            tokio::time::timeout(std::time::Duration::from_millis(100), update_rx.recv()).await;

        // The timeout should occur, indicating no more events were received
        assert!(
            timeout_result.is_err(),
            "Received unexpected additional event"
        );

        // Verify that both price feeds were stored correctly
        let price_feed_ids = (*state).get_price_feed_ids().await;
        assert_eq!(price_feed_ids.len(), 1);
        assert!(price_feed_ids.contains(&PriceIdentifier::new([100; 32])));
    }

    /// Test that verifies only one event is sent when multiple concurrent updates
    /// for the same slot are processed.
    #[tokio::test]
    pub async fn test_concurrent_updates_same_slot_sends_single_event() {
        let (state, mut update_rx) = setup_state(10).await;

        // Create a single price feed message
        let price_feed = create_dummy_price_feed_message(100, 10, 9);

        // Generate 100 identical updates for the same slot but with different sequence numbers
        let mut all_updates = Vec::new();
        for seq in 0..100 {
            let updates = generate_update(vec![Message::PriceFeedMessage(price_feed)], 10, seq);
            all_updates.extend(updates);
        }

        // Process updates concurrently - we don't care if some fail due to the race condition
        // The important thing is that only one event is sent
        let state_arc = Arc::clone(&state);
        let futures = all_updates.into_iter().map(move |u| {
            let state_clone = Arc::clone(&state_arc);
            async move {
                let _ = state_clone.store_update(u).await;
            }
        });
        futures::future::join_all(futures).await;

        // Check that only one AggregationEvent::New is received
        assert_eq!(
            update_rx.recv().await,
            Ok(AggregationEvent::New { slot: 10 })
        );

        // Try to receive another event with a timeout to ensure no more events were sent
        let timeout_result =
            tokio::time::timeout(std::time::Duration::from_millis(100), update_rx.recv()).await;

        // The timeout should occur, indicating no more events were received
        assert!(
            timeout_result.is_err(),
            "Received unexpected additional event"
        );

        // Verify that the price feed was stored correctly
        let price_feed_ids = (*state).get_price_feed_ids().await;
        assert_eq!(price_feed_ids.len(), 1);
        assert!(price_feed_ids.contains(&PriceIdentifier::new([100; 32])));
    }
}
#[cfg(test)]
#[allow(clippy::unwrap_used, reason = "tests")]
/// Unit tests for the core TWAP calculation logic in `calculate_twap`
mod calculate_twap_unit_tests {
    use super::*;

    fn create_basic_twap_message(
        cumulative_price: i128,
        publish_time: i64,
        prev_publish_time: i64,
        publish_slot: u64,
    ) -> TwapMessage {
        TwapMessage {
            feed_id: [0; 32],
            cumulative_price,
            cumulative_conf: 100,
            num_down_slots: 0,
            exponent: 8,
            publish_time,
            prev_publish_time,
            publish_slot,
        }
    }

    #[test]
    fn test_valid_twap() {
        let start = create_basic_twap_message(100, 100, 90, 1000);
        let end = create_basic_twap_message(300, 200, 180, 1100);

        let price = calculate_twap(&start, &end).unwrap();
        assert_eq!(price.price, 2); // (300-100)/(1100-1000) = 2
    }
    #[test]
    fn test_invalid_slot_order() {
        let start = create_basic_twap_message(100, 100, 90, 1100);
        let end = create_basic_twap_message(300, 200, 180, 1000);

        let err = calculate_twap(&start, &end).unwrap_err();
        assert_eq!(
            err.to_string(),
            "Cannot calculate TWAP - end slot must be greater than start slot"
        );
    }

    #[test]
    fn test_invalid_timestamps() {
        let start = create_basic_twap_message(100, 100, 110, 1000);
        let end = create_basic_twap_message(300, 200, 180, 1100);

        let err = calculate_twap(&start, &end).unwrap_err();
        assert_eq!(
            err.to_string(),
            "Start message is not the first update for its timestamp"
        );

        let start = create_basic_twap_message(100, 100, 90, 1000);
        let end = create_basic_twap_message(300, 200, 200, 1100);

        let err = calculate_twap(&start, &end).unwrap_err();
        assert_eq!(
            err.to_string(),
            "End message is not the first update for its timestamp"
        );
    }

    #[test]
    fn test_overflow() {
        let start = create_basic_twap_message(i128::MIN, 100, 90, 1000);
        let end = create_basic_twap_message(i128::MAX, 200, 180, 1100);

        let err = calculate_twap(&start, &end).unwrap_err();
        assert_eq!(err.to_string(), "Price difference overflow");
    }
}
