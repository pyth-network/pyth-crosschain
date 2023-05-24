use {
    self::{
        proof::wormhole_merkle::{
            construct_update_data,
            WormholeMerkleProof,
        },
        storage::StorageInstance,
        types::{
            AccumulatorMessages,
            MessageType,
            PriceFeedsWithUpdateData,
            RequestTime,
            Update,
        },
    },
    crate::store::{
        proof::wormhole_merkle::{
            construct_message_states_proofs,
            store_wormhole_merkle_verified_message,
        },
        types::{
            Message,
            MessageState,
            ProofSet,
            WormholePayload,
        },
    },
    anyhow::{
        anyhow,
        Result,
    },
    derive_builder::Builder,
    moka::future::Cache,
    pyth_sdk::PriceIdentifier,
    std::{
        ops::Rem,
        time::Duration,
    },
    wormhole_sdk::Vaa,
};

pub mod proof;
pub mod storage;
pub mod types;

pub type RingIndex = u32;

#[derive(Clone, PartialEq, Debug, Builder)]
#[builder(derive(Debug), pattern = "immutable")]
pub struct AccumulatorState {
    pub accumulator_messages:  AccumulatorMessages,
    pub wormhole_merkle_proof: WormholeMerkleProof,
}

#[derive(Clone)]
pub struct Store {
    pub storage:               StorageInstance,
    pub pending_accumulations: Cache<RingIndex, AccumulatorStateBuilder>,
}

impl Store {
    pub fn new_with_local_cache(max_size_per_key: usize) -> Self {
        Self {
            storage:               storage::local_storage::LocalStorage::new_instance(
                max_size_per_key,
            ),
            pending_accumulations: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(60 * 5))
                .build(), // FIXME: Make this configurable
        }
    }

    /// Stores the update data in the store
    pub async fn store_update(&self, update: Update) -> Result<()> {
        let ring_index = match update {
            Update::Vaa(vaa_bytes) => {
                let vaa = serde_wormhole::from_slice::<Vaa<Vec<u8>>>(&vaa_bytes)?;
                let payload = WormholePayload::try_from_bytes(&vaa.payload, &vaa_bytes)?;

                // FIXME: Validate the VAA
                // FIXME: Skip similar VAAs

                match payload {
                    WormholePayload::Merkle(proof) => {
                        log::info!("Storing merkle proof for state index {:?}", proof);
                        store_wormhole_merkle_verified_message(self, proof.clone()).await?;
                        proof.state_index
                    }
                }
            }
            Update::AccumulatorMessages(accumulator_messages) => {
                // FIXME: Move this constant to a better place
                const RING_SIZE: u32 = 10_000;
                let ring_index = accumulator_messages.slot.rem(RING_SIZE as u64) as u32;

                log::info!(
                    "Storing accumulator messages for ring index {:?}: {:?}",
                    ring_index,
                    accumulator_messages
                );

                let pending_acc = self
                    .pending_accumulations
                    .entry(ring_index)
                    .or_default()
                    .await
                    .into_value();
                self.pending_accumulations
                    .insert(
                        ring_index,
                        pending_acc.accumulator_messages(accumulator_messages),
                    )
                    .await;

                ring_index
            }
        };

        let pending_state = self.pending_accumulations.get(&ring_index);
        let pending_state = match pending_state {
            Some(pending_state) => pending_state,
            // Due to some race conditions this might happen when it's processed before
            None => return Ok(()),
        };

        let state = match pending_state.build() {
            Ok(state) => state,
            Err(_) => return Ok(()),
        };

        log::info!("State: {:?}", state);

        let wormhole_merkle_message_states_proofs = construct_message_states_proofs(state.clone())?;

        let message_states = state
            .accumulator_messages
            .messages
            .iter()
            .enumerate()
            .map(|(idx, raw_message)| {
                let message = Message::from_bytes(raw_message)?;

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
                ))
            })
            .collect::<Result<Vec<_>>>()?;

        log::info!("Message states: {:?}", message_states);

        self.storage.store_message_states(message_states)?;

        self.pending_accumulations.invalidate(&ring_index).await;

        Ok(())
    }

    pub fn get_price_feeds_with_update_data(
        &self,
        price_ids: Vec<PriceIdentifier>,
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithUpdateData> {
        let messages = self.storage.retrieve_message_states(
            price_ids
                .iter()
                .map(|price_id| price_id.to_bytes())
                .collect(),
            types::RequestType::Some(vec![MessageType::PriceFeed]),
            request_time,
        )?;

        let price_feeds = messages
            .iter()
            .map(|message_state| match message_state.message {
                Message::PriceFeed(price_feed) => Ok(price_feed),
                _ => Err(anyhow!("Invalid message state type")),
            })
            .collect::<Result<Vec<_>>>()?;
        let update_data = construct_update_data(messages)?;

        Ok(PriceFeedsWithUpdateData {
            price_feeds,
            wormhole_merkle_update_data: update_data,
        })
    }

    pub fn get_price_feed_ids(&self) -> Vec<PriceIdentifier> {
        self.storage
            .keys()
            .iter()
            .map(|key| PriceIdentifier::new(key.id))
            .collect()
    }
}
