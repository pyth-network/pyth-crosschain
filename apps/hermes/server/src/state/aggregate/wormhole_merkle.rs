use {
    super::{AccumulatorMessages, RawMessage, Slot},
    crate::{
        network::wormhole::VaaBytes,
        state::cache::{Cache, MessageState},
    },
    anyhow::{anyhow, Result},
    pythnet_sdk::{
        accumulators::{
            merkle::{MerklePath, MerkleTree},
            Accumulator,
        },
        hashers::keccak256_160::Keccak160,
        wire::{
            to_vec,
            v1::{AccumulatorUpdateData, MerklePriceUpdate, Proof, WormholeMerkleRoot},
        },
    },
};

// The number of messages in a single update data is defined as a
// u8 in the wire format. So, we can't have more than 255 messages.
pub const MAX_MESSAGE_IN_SINGLE_UPDATE_DATA: usize = 255;

#[derive(Clone, PartialEq, Debug)]
pub struct WormholeMerkleState {
    pub root: WormholeMerkleRoot,
    pub vaa: VaaBytes,
}

#[derive(Clone, PartialEq, Debug)]
pub struct WormholeMerkleMessageProof {
    pub proof: MerklePath<Keccak160>,
    pub vaa: VaaBytes,
}

#[derive(Clone, PartialEq, Debug)]
pub struct RawMessageWithMerkleProof {
    pub slot: Slot,
    pub raw_message: RawMessage,
    pub proof: WormholeMerkleMessageProof,
}

impl From<MessageState> for RawMessageWithMerkleProof {
    fn from(message_state: MessageState) -> Self {
        Self {
            slot: message_state.slot,
            raw_message: message_state.raw_message,
            proof: message_state.proof_set.wormhole_merkle_proof,
        }
    }
}

pub async fn store_wormhole_merkle_verified_message<S>(
    state: &S,
    root: WormholeMerkleRoot,
    vaa: VaaBytes,
) -> Result<bool>
where
    S: Cache,
{
    // Store the state and check if it was already stored in a single operation
    // This avoids the race condition where multiple threads could check and find nothing
    // but then both store the same state
    state
        .store_wormhole_merkle_state(WormholeMerkleState { root, vaa })
        .await
}

pub fn construct_message_states_proofs(
    accumulator_messages: &AccumulatorMessages,
    wormhole_merkle_state: &WormholeMerkleState,
) -> Result<Vec<WormholeMerkleMessageProof>> {
    // Check whether the state is valid
    let merkle_acc = match MerkleTree::<Keccak160>::from_set(
        accumulator_messages.raw_messages.iter().map(|m| m.as_ref()),
    ) {
        Some(merkle_acc) => merkle_acc,
        None => return Ok(vec![]), // It only happens when the message set is empty
    };

    if merkle_acc.root.as_bytes() != wormhole_merkle_state.root.root {
        return Err(anyhow!("Invalid merkle root"));
    }

    accumulator_messages
        .raw_messages
        .iter()
        .map(|m| {
            Ok(WormholeMerkleMessageProof {
                vaa: wormhole_merkle_state.vaa.clone(),
                proof: merkle_acc
                    .prove(m.as_ref())
                    .ok_or(anyhow!("Failed to prove message"))?,
            })
        })
        .collect::<Result<Vec<WormholeMerkleMessageProof>>>()
}

pub fn construct_update_data(mut messages: Vec<RawMessageWithMerkleProof>) -> Result<Vec<Vec<u8>>> {
    tracing::debug!("Constructing update data for {} messages", messages.len());

    messages.sort_by_key(|m| m.slot);

    let mut iter = messages.into_iter().peekable();
    let mut result: Vec<Vec<u8>> = vec![];

    while let Some(message) = iter.next() {
        let slot = message.slot;
        let vaa = message.proof.vaa;
        let mut updates = vec![MerklePriceUpdate {
            message: message.raw_message.into(),
            proof: message.proof.proof,
        }];

        while updates.len() < MAX_MESSAGE_IN_SINGLE_UPDATE_DATA {
            if let Some(message) = iter.next_if(|m| m.slot == slot) {
                updates.push(MerklePriceUpdate {
                    message: message.raw_message.into(),
                    proof: message.proof.proof,
                });
            } else {
                break;
            }
        }

        tracing::debug!(
            slot = slot,
            "Combining {} messages in a single updateData",
            updates.len()
        );

        result.push(to_vec::<_, byteorder::BE>(&AccumulatorUpdateData::new(
            Proof::WormholeMerkle {
                vaa: vaa.into(),
                updates,
            },
        ))?);
    }

    Ok(result)
}

#[cfg(test)]
#[allow(
    clippy::unwrap_used,
    clippy::cast_possible_wrap,
    clippy::panic,
    clippy::indexing_slicing,
    reason = "tests"
)]
mod test {
    use {
        super::*,
        pythnet_sdk::{
            messages::{Message, PriceFeedMessage},
            wire::from_slice,
        },
    };

    fn create_dummy_raw_message_with_merkle_proof(
        slot_and_pubtime: u64,
    ) -> RawMessageWithMerkleProof {
        let price_feed_message = Message::PriceFeedMessage(PriceFeedMessage {
            conf: 0,
            price: 0,
            feed_id: [0; 32],
            exponent: 0,
            ema_conf: 0,
            ema_price: 0,
            publish_time: slot_and_pubtime as i64,
            prev_publish_time: 0,
        });
        RawMessageWithMerkleProof {
            slot: slot_and_pubtime,
            proof: WormholeMerkleMessageProof {
                vaa: vec![],
                proof: MerklePath::default(),
            },
            raw_message: to_vec::<_, byteorder::BE>(&price_feed_message).unwrap(),
        }
    }

    #[test]

    fn test_construct_update_data_works_on_mixed_slot_and_big_size() {
        let mut messages = vec![];

        // Messages slot and publish_time 11 share the same merkle root
        for _ in 0..MAX_MESSAGE_IN_SINGLE_UPDATE_DATA * 2 - 10 {
            messages.push(create_dummy_raw_message_with_merkle_proof(11));
        }

        // Messages on slot and publish_time 10 that share different root from the messages above
        for _ in 0..MAX_MESSAGE_IN_SINGLE_UPDATE_DATA * 2 - 10 {
            messages.push(create_dummy_raw_message_with_merkle_proof(10));
        }

        let update_data = construct_update_data(messages).unwrap();

        assert_eq!(update_data.len(), 4);

        // Construct method sorts the messages by slot. So, the first two update data should
        // contain messages on slot 10.
        for i in 0..4 {
            let update_data = &update_data[i];
            let update_data = AccumulatorUpdateData::try_from_slice(update_data).unwrap();
            let price_updates = match &update_data.proof {
                Proof::WormholeMerkle { updates, .. } => updates,
            };

            let price_update_message = price_updates.first().unwrap().clone();
            let price_update_message: Vec<u8> = price_update_message.message.into();
            let price_update_message =
                from_slice::<byteorder::BE, Message>(price_update_message.as_ref()).unwrap();

            match i {
                0 => {
                    assert_eq!(price_updates.len(), MAX_MESSAGE_IN_SINGLE_UPDATE_DATA);
                    assert_eq!(price_update_message.publish_time(), 10);
                }
                1 => {
                    assert_eq!(price_updates.len(), MAX_MESSAGE_IN_SINGLE_UPDATE_DATA - 10);
                    assert_eq!(price_update_message.publish_time(), 10);
                }
                2 => {
                    assert_eq!(price_updates.len(), MAX_MESSAGE_IN_SINGLE_UPDATE_DATA);
                    assert_eq!(price_update_message.publish_time(), 11);
                }
                3 => {
                    assert_eq!(price_updates.len(), MAX_MESSAGE_IN_SINGLE_UPDATE_DATA - 10);
                    assert_eq!(price_update_message.publish_time(), 11);
                }
                _ => panic!("Invalid index"),
            }
        }
    }
}
