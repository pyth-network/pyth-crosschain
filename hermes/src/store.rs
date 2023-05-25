use {
    self::{
        proof::wormhole_merkle::construct_update_data,
        storage::StorageInstance,
        types::{
            AccumulatorMessages,
            MessageType,
            PriceFeedUpdate,
            PriceFeedsWithUpdateData,
            RequestTime,
            Slot,
            Update,
        },
    },
    crate::store::{
        proof::wormhole_merkle::{
            construct_message_states_proofs,
            store_wormhole_merkle_verified_message,
        },
        types::{
            MessageState,
            ProofSet,
            UnixTimestamp,
        },
        wormhole::parse_and_verify_vaa,
    },
    anyhow::{
        anyhow,
        Result,
    },
    derive_builder::Builder,
    moka::future::Cache,
    pyth_oracle::Message,
    pyth_sdk::PriceIdentifier,
    pythnet_sdk::payload::v1::{
        WormholeMerkleRoot,
        WormholeMessage,
        WormholePayload,
    },
    std::{
        collections::HashSet,
        sync::Arc,
        time::{
            Duration,
            SystemTime,
            UNIX_EPOCH,
        },
    },
    tokio::sync::{
        mpsc::Sender,
        RwLock,
    },
    wormhole_sdk::{
        Address,
        Chain,
        GuardianAddress,
    },
};

pub mod proof;
pub mod storage;
pub mod types;
pub mod wormhole;

#[derive(Clone, PartialEq, Debug, Builder)]
#[builder(derive(Debug), pattern = "immutable")]
pub struct AccumulatorState {
    pub accumulator_messages:  AccumulatorMessages,
    pub wormhole_merkle_proof: (WormholeMerkleRoot, Vec<u8>),
}

pub struct Store {
    pub storage:               StorageInstance,
    pub pending_accumulations: Cache<Slot, AccumulatorStateBuilder>,
    pub guardian_set:          RwLock<Option<Vec<GuardianAddress>>>,
    pub update_tx:             Sender<()>,
}

impl Store {
    pub fn new_with_local_cache(update_tx: Sender<()>, max_size_per_key: usize) -> Arc<Self> {
        Arc::new(Self {
            storage: storage::local_storage::LocalStorage::new_instance(max_size_per_key),
            pending_accumulations: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(60 * 5))
                .build(), // FIXME: Make this configurable
            guardian_set: RwLock::new(None),
            update_tx,
        })
    }

    /// Stores the update data in the store
    pub async fn store_update(&self, update: Update) -> Result<()> {
        let slot = match update {
            Update::Vaa(vaa_bytes) => {
                let body = parse_and_verify_vaa(self, &vaa_bytes).await;
                let body = match body {
                    Ok(body) => body,
                    Err(err) => {
                        log::info!("Ignoring invalid VAA: {:?}", err);
                        return Ok(());
                    }
                };

                if body.emitter_chain != Chain::Pythnet
                    || body.emitter_address != Address(pythnet_sdk::ACCUMULATOR_EMITTER_ADDRESS)
                {
                    return Ok(()); // Ignore VAA from other emitters
                }

                match WormholeMessage::try_from_bytes(body.payload)?.payload {
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

                let pending_acc = self
                    .pending_accumulations
                    .entry(slot)
                    .or_default()
                    .await
                    .into_value();
                self.pending_accumulations
                    .insert(slot, pending_acc.accumulator_messages(accumulator_messages))
                    .await;

                slot
            }
        };

        let pending_state = self.pending_accumulations.get(&slot);
        let pending_state = match pending_state {
            Some(pending_state) => pending_state,
            // Due to some race conditions this might happen when it's processed before
            None => return Ok(()),
        };

        let state = match pending_state.build() {
            Ok(state) => state,
            Err(_) => return Ok(()),
        };

        let wormhole_merkle_message_states_proofs = construct_message_states_proofs(state.clone())?;

        let current_time: UnixTimestamp =
            SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as _;

        let message_states = state
            .accumulator_messages
            .messages
            .iter()
            .enumerate()
            .map(|(idx, raw_message)| {
                let message = Message::try_from_bytes(raw_message)?;

                Ok(MessageState::new(
                    message,
                    raw_message.clone(),
                    ProofSet {
                        wormhole_merkle_proof: wormhole_merkle_message_states_proofs
                            .get(idx)
                            .ok_or(anyhow!("Missing proof for message"))?
                            .clone(),
                    },
                    state.accumulator_messages.slot,
                    current_time,
                ))
            })
            .collect::<Result<Vec<_>>>()?;

        log::info!("Message states len: {:?}", message_states.len());

        self.storage.store_message_states(message_states)?;

        self.pending_accumulations.invalidate(&slot).await;

        self.update_tx.send(()).await?;

        Ok(())
    }

    pub async fn update_guardian_set(&self, guardian_set: Vec<GuardianAddress>) {
        self.guardian_set.write().await.replace(guardian_set);
    }

    pub fn get_price_feeds_with_update_data(
        &self,
        price_ids: Vec<PriceIdentifier>,
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithUpdateData> {
        let messages = self.storage.retrieve_message_states(
            price_ids,
            request_time,
            Some(&|message_type| *message_type == MessageType::PriceFeedMessage),
        )?;

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

    pub fn get_price_feed_ids(&self) -> HashSet<PriceIdentifier> {
        self.storage.keys().iter().map(|key| key.price_id).collect()
    }
}
