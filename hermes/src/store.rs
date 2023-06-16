use {
    self::{
        proof::wormhole_merkle::construct_update_data,
        storage::{
            MessageState,
            MessageStateFilter,
            StorageInstance,
        },
        types::{
            PriceFeedUpdate,
            PriceFeedsWithUpdateData,
            RequestTime,
            Update,
        },
        wormhole::GuardianSet,
    },
    crate::store::{
        proof::wormhole_merkle::{
            construct_message_states_proofs,
            store_wormhole_merkle_verified_message,
        },
        storage::{
            AccumulatorState,
            CompletedAccumulatorState,
        },
        types::{
            ProofSet,
            UnixTimestamp,
        },
        wormhole::verify_vaa,
    },
    anyhow::{
        anyhow,
        Result,
    },
    moka::future::Cache,
    pyth_oracle::{
        Message,
        MessageType,
    },
    pyth_sdk::PriceIdentifier,
    pythnet_sdk::wire::v1::{
        WormholeMessage,
        WormholePayload,
    },
    std::{
        collections::{
            BTreeMap,
            HashSet,
        },
        sync::Arc,
        time::{
            SystemTime,
            UNIX_EPOCH,
        },
    },
    tokio::{
        sync::{
            mpsc::Sender,
            RwLock,
        },
        time::{
            Duration,
            Instant,
        },
    },
    wormhole_sdk::{
        Address,
        Chain,
        Vaa,
    },
};

pub mod proof;
pub mod storage;
pub mod types;
pub mod wormhole;

pub struct Store {
    pub storage:                  StorageInstance,
    pub observed_vaa_seqs:        Cache<u64, bool>,
    pub guardian_set:             RwLock<BTreeMap<u32, GuardianSet>>,
    pub update_tx:                Sender<()>,
    pub last_completed_update_at: RwLock<Option<Instant>>,
}

impl Store {
    pub fn new_with_local_cache(update_tx: Sender<()>, cache_size: u64) -> Arc<Self> {
        Arc::new(Self {
            storage: storage::local_storage::LocalStorage::new_instance(cache_size),
            observed_vaa_seqs: Cache::builder()
                .max_capacity(cache_size)
                .time_to_live(Duration::from_secs(60 * 5))
                .build(),
            guardian_set: RwLock::new(Default::default()),
            update_tx,
            last_completed_update_at: RwLock::new(None),
        })
    }

    /// Stores the update data in the store
    pub async fn store_update(&self, update: Update) -> Result<()> {
        let slot = match update {
            Update::Vaa(vaa_bytes) => {
                let vaa =
                    serde_wormhole::from_slice::<Vaa<&serde_wormhole::RawMessage>>(&vaa_bytes)?;

                if vaa.emitter_chain != Chain::Pythnet
                    || vaa.emitter_address != Address(pythnet_sdk::ACCUMULATOR_EMITTER_ADDRESS)
                {
                    return Ok(()); // Ignore VAA from other emitters
                }

                if self.observed_vaa_seqs.get(&vaa.sequence).is_some() {
                    return Ok(()); // Ignore VAA if we have already seen it
                }

                let vaa = verify_vaa(self, vaa).await;

                let vaa = match vaa {
                    Ok(vaa) => vaa,
                    Err(err) => {
                        log::info!("Ignoring invalid VAA: {:?}", err);
                        return Ok(());
                    }
                };

                self.observed_vaa_seqs.insert(vaa.sequence, true).await;

                match WormholeMessage::try_from_bytes(vaa.payload)?.payload {
                    WormholePayload::Merkle(proof) => {
                        log::info!("Storing merkle proof for slot {:?}", proof.slot,);
                        store_wormhole_merkle_verified_message(self, proof.clone(), vaa_bytes)
                            .await?;
                        proof.slot
                    }
                }
            }
            Update::AccumulatorMessages(accumulator_messages) => {
                let slot = accumulator_messages.slot;
                log::info!("Storing accumulator messages for slot {:?}.", slot,);
                let mut accumulator_state = self
                    .storage
                    .fetch_accumulator_state(slot)
                    .await?
                    .unwrap_or(AccumulatorState {
                        slot,
                        accumulator_messages: None,
                        wormhole_merkle_state: None,
                    });
                accumulator_state.accumulator_messages = Some(accumulator_messages);
                self.storage
                    .store_accumulator_state(accumulator_state)
                    .await?;
                slot
            }
        };

        let state = match self.storage.fetch_accumulator_state(slot).await? {
            Some(state) => state,
            None => return Ok(()),
        };

        let completed_state = state.try_into();
        let completed_state: CompletedAccumulatorState = match completed_state {
            Ok(completed_state) => completed_state,
            Err(_) => {
                return Ok(());
            }
        };

        // Once the accumulator reaches a complete state for a specific slot
        // we can build the message states
        self.build_message_states(completed_state).await?;

        self.update_tx.send(()).await?;

        self.last_completed_update_at
            .write()
            .await
            .replace(Instant::now());

        Ok(())
    }

    async fn build_message_states(&self, completed_state: CompletedAccumulatorState) -> Result<()> {
        let wormhole_merkle_message_states_proofs =
            construct_message_states_proofs(&completed_state)?;

        let current_time: UnixTimestamp =
            SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as _;

        let message_states = completed_state
            .accumulator_messages
            .messages
            .iter()
            .enumerate()
            .map(|(idx, message)| {
                Ok(MessageState::new(
                    *message,
                    ProofSet {
                        wormhole_merkle_proof: wormhole_merkle_message_states_proofs
                            .get(idx)
                            .ok_or(anyhow!("Missing proof for message"))?
                            .clone(),
                    },
                    completed_state.slot,
                    current_time,
                ))
            })
            .collect::<Result<Vec<_>>>()?;

        log::info!("Message states len: {:?}", message_states.len());

        self.storage.store_message_states(message_states).await?;

        Ok(())
    }

    pub async fn update_guardian_set(&self, id: u32, guardian_set: GuardianSet) {
        let mut guardian_sets = self.guardian_set.write().await;
        guardian_sets.insert(id, guardian_set);
    }

    pub async fn get_price_feeds_with_update_data(
        &self,
        price_ids: Vec<PriceIdentifier>,
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithUpdateData> {
        let messages = self
            .storage
            .fetch_message_states(
                price_ids,
                request_time,
                MessageStateFilter::Only(MessageType::PriceFeedMessage),
            )
            .await?;

        let price_feeds = messages
            .iter()
            .map(|message_state| match message_state.message {
                Message::PriceFeedMessage(price_feed) => Ok(PriceFeedUpdate {
                    price_feed,
                    received_at: message_state.received_at,
                    slot: message_state.slot,
                    wormhole_merkle_update_data: construct_update_data(vec![message_state])?
                        .into_iter()
                        .next()
                        .ok_or(anyhow!("Missing update data for message"))?,
                }),
                _ => Err(anyhow!("Invalid message state type")),
            })
            .collect::<Result<Vec<_>>>()?;

        let update_data = construct_update_data(messages.iter().collect())?;

        Ok(PriceFeedsWithUpdateData {
            price_feeds,
            wormhole_merkle_update_data: update_data,
        })
    }

    pub async fn get_price_feed_ids(&self) -> HashSet<PriceIdentifier> {
        self.storage
            .message_state_keys()
            .await
            .iter()
            .map(|key| PriceIdentifier::new(key.id))
            .collect()
    }

    pub async fn is_healthy(&self) -> bool {
        const STALENESS_THRESHOLD: Duration = Duration::from_secs(30);

        let last_completed_update_at = self.last_completed_update_at.read().await;
        match last_completed_update_at.as_ref() {
            Some(last_completed_update_at) => {
                last_completed_update_at.elapsed() < STALENESS_THRESHOLD
            }
            None => false,
        }
    }
}
