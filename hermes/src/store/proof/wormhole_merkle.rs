use {
    crate::store::{
        storage::{
            AccumulatorState,
            CompletedAccumulatorState,
            MessageState,
        },
        Store,
    },
    anyhow::{
        anyhow,
        Result,
    },
    pythnet_sdk::{
        accumulators::{
            merkle::{
                MerkleAccumulator,
                MerklePath,
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
    let mut accumulator_state = store
        .storage
        .fetch_accumulator_state(root.slot)
        .await?
        .unwrap_or(AccumulatorState {
            slot:                  root.slot,
            accumulator_messages:  None,
            wormhole_merkle_state: None,
        });

    accumulator_state.wormhole_merkle_state = Some(WormholeMerkleState {
        root,
        vaa: vaa_bytes,
    });
    store
        .storage
        .store_accumulator_state(accumulator_state)
        .await?;
    Ok(())
}

pub fn construct_message_states_proofs(
    completed_accumulator_state: &CompletedAccumulatorState,
) -> Result<Vec<WormholeMerkleMessageProof>> {
    let accumulator_messages = &completed_accumulator_state.accumulator_messages;
    let wormhole_merkle_state = &completed_accumulator_state.wormhole_merkle_state;

    let raw_messages = accumulator_messages
        .messages
        .iter()
        .map(|m| m.to_bytes())
        .collect::<Vec<Vec<u8>>>();

    // Check whether the state is valid
    let merkle_acc =
        match MerkleAccumulator::<Keccak160>::from_set(raw_messages.iter().map(|m| m.as_ref())) {
            Some(merkle_acc) => merkle_acc,
            None => return Ok(vec![]), // It only happens when the message set is empty
        };

    if merkle_acc.root != wormhole_merkle_state.root.root {
        return Err(anyhow!("Invalid merkle root"));
    }

    raw_messages
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
    message_states.sort_by_key(
        |m| m.proof_set.wormhole_merkle_proof.vaa.clone(), // FIXME: This is not efficient
    );

    message_states
        .group_by(|a, b| {
            a.proof_set.wormhole_merkle_proof.vaa == b.proof_set.wormhole_merkle_proof.vaa
        })
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
                        .map(|message| MerklePriceUpdate {
                            message: message.message.to_bytes().into(),
                            proof:   message.proof_set.wormhole_merkle_proof.proof.clone(),
                        })
                        .collect(),
                },
            ))?)
        })
        .collect::<Result<Vec<Vec<u8>>>>()
}
