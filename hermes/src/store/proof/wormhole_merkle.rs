use {
    crate::store::{
        storage::MessageState,
        types::AccumulatorMessages,
        Store,
    },
    anyhow::{
        anyhow,
        Result,
    },
    pythnet_sdk::{
        accumulators::{
            merkle::{
                MerklePath,
                MerkleTree,
            },
            Accumulator,
        },
        hashers::keccak256_160::Keccak160,
        wire::{
            to_vec,
            v1::{
                AccumulatorUpdateData,
                MerklePriceUpdate,
                Proof,
                WormholeMerkleRoot,
            },
        },
    },
};

// The number of messages in a single update data is defined as a
// u8 in the wire format. So, we can't have more than 255 messages.
pub const MAX_MESSAGE_IN_SINGLE_UPDATE_DATA: usize = 255;

#[derive(Clone, PartialEq, Debug)]
pub struct WormholeMerkleState {
    pub root: WormholeMerkleRoot,
    pub vaa:  Vec<u8>,
}

#[derive(Clone, PartialEq, Debug)]
pub struct WormholeMerkleMessageProof {
    pub vaa:   Vec<u8>,
    pub proof: MerklePath<Keccak160>,
}

pub async fn store_wormhole_merkle_verified_message(
    store: &Store,
    root: WormholeMerkleRoot,
    vaa_bytes: Vec<u8>,
) -> Result<()> {
    store
        .storage
        .store_wormhole_merkle_state(WormholeMerkleState {
            root,
            vaa: vaa_bytes,
        })
        .await?;
    Ok(())
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
                vaa:   wormhole_merkle_state.vaa.clone(),
                proof: merkle_acc
                    .prove(m.as_ref())
                    .ok_or(anyhow!("Failed to prove message"))?,
            })
        })
        .collect::<Result<Vec<WormholeMerkleMessageProof>>>()
}

pub fn construct_update_data(mut message_states: Vec<&MessageState>) -> Result<Vec<Vec<u8>>> {
    message_states.sort_by_key(|m| m.slot);

    message_states
        .group_by(|a, b| a.slot == b.slot) // States on the same slot share the same merkle root
        .flat_map(|messages| {
            messages
                // Group messages by the number of messages in a single update data
                .chunks(MAX_MESSAGE_IN_SINGLE_UPDATE_DATA)
                .map(|messages| {
                    let vaa = messages
                        .get(0)
                        .ok_or(anyhow!("Empty message set"))?
                        .proof_set
                        .wormhole_merkle_proof
                        .vaa
                        .clone();

                    Ok(to_vec::<_, byteorder::BE>(&AccumulatorUpdateData::new(
                        Proof::WormholeMerkle {
                            vaa:     vaa.into(),
                            updates: messages
                                .iter()
                                .map(|message| {
                                    Ok(MerklePriceUpdate {
                                        message: to_vec::<_, byteorder::BE>(&message.message)
                                            .map_err(|e| {
                                                anyhow!("Failed to serialize message: {}", e)
                                            })?
                                            .into(),
                                        proof:   message
                                            .proof_set
                                            .wormhole_merkle_proof
                                            .proof
                                            .clone(),
                                    })
                                })
                                .collect::<Result<_>>()?,
                        },
                    ))?)
                })
        })
        .collect::<Result<Vec<Vec<u8>>>>()
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::store::types::ProofSet,
        pythnet_sdk::{
            messages::{
                Message,
                PriceFeedMessage,
            },
            wire::from_slice,
        },
    };

    fn create_dummy_message_state(slot_and_pubtime: u64) -> MessageState {
        MessageState::new(
            Message::PriceFeedMessage(PriceFeedMessage {
                conf:              0,
                price:             0,
                feed_id:           [0; 32],
                exponent:          0,
                ema_conf:          0,
                ema_price:         0,
                publish_time:      slot_and_pubtime as i64,
                prev_publish_time: 0,
            }),
            vec![],
            ProofSet {
                wormhole_merkle_proof: WormholeMerkleMessageProof {
                    vaa:   vec![],
                    proof: MerklePath::default(),
                },
            },
            slot_and_pubtime,
            0,
        )
    }

    #[test]
    fn test_construct_update_data_works_on_mixed_slot_and_big_size() {
        let mut message_states = vec![];

        // Messages slot and publish_time 11 share the same merkle root
        for i in 0..MAX_MESSAGE_IN_SINGLE_UPDATE_DATA * 2 - 10 {
            message_states.push(create_dummy_message_state(11));
        }

        // Messages on slot and publish_time 10 that share different root from the messages above
        for i in 0..MAX_MESSAGE_IN_SINGLE_UPDATE_DATA * 2 - 10 {
            message_states.push(create_dummy_message_state(10));
        }

        let update_data = construct_update_data(message_states.iter().collect()).unwrap();

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
