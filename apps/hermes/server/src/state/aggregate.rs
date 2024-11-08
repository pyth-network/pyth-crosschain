#[cfg(test)]
use mock_instant::{SystemTime, UNIX_EPOCH};
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
    pub fn ring_index(&self) -> u32 {
        (self.slot % self.ring_size as u64) as u32
    }
}

#[derive(Debug)]
pub enum Update {
    Vaa(VaaBytes),
    AccumulatorMessages(AccumulatorMessages),
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

                        store_wormhole_merkle_verified_message(
                            self,
                            proof.clone(),
                            update_vaa.to_owned(),
                        )
                        .await?;

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

                self.store_accumulator_messages(accumulator_messages)
                    .await?;

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

        // Send update event to subscribers. We are purposefully ignoring the result
        // because there might be no subscribers.
        let _ = match aggregate_state.latest_completed_slot {
            None => {
                aggregate_state.latest_completed_slot.replace(slot);
                self.into()
                    .api_update_tx
                    .send(AggregationEvent::New { slot })
            }
            Some(latest) if slot > latest => {
                self.prune_removed_keys(message_state_keys).await;
                aggregate_state.latest_completed_slot.replace(slot);
                self.into()
                    .api_update_tx
                    .send(AggregationEvent::New { slot })
            }
            _ => self
                .into()
                .api_update_tx
                .send(AggregationEvent::OutOfOrder { slot }),
        };

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
            .unwrap();

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
                            .map(|d| d.as_secs() as i64)
                            .ok()
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

    let current_time: UnixTimestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as _;

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

#[cfg(test)]
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
            price: seed as _,
            conf: seed as _,
            exponent: 0,
            ema_conf: seed as _,
            ema_price: seed as _,
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
                    RequestTime::FirstAfter(slot as i64),
                )
                .await
                .is_err());
        }
    }
}
