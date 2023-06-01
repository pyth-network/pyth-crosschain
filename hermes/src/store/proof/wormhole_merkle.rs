use {
    crate::store::{
        types::MessageState,
        AccumulatorState,
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
pub struct WormholeMerkleMessageProof {
    pub vaa:   Vec<u8>,
    pub proof: MerklePath<Keccak160>,
}

pub async fn store_wormhole_merkle_verified_message(
    store: &Store,
    proof: WormholeMerkleRoot,
    vaa_bytes: Vec<u8>,
) -> Result<()> {
    let pending_acc = store
        .pending_accumulations
        .entry(proof.slot)
        .or_default()
        .await
        .into_value();
    store
        .pending_accumulations
        .insert(
            proof.slot,
            pending_acc.wormhole_merkle_proof((proof, vaa_bytes)),
        )
        .await;
    Ok(())
}

pub fn construct_message_states_proofs(
    state: AccumulatorState,
) -> Result<Vec<WormholeMerkleMessageProof>> {
    // Check whether the state is valid
    let merkle_acc = match MerkleAccumulator::<Keccak160>::from_set(
        state
            .accumulator_messages
            .messages
            .iter()
            .map(|m| m.as_ref()),
    ) {
        Some(merkle_acc) => merkle_acc,
        None => return Ok(vec![]), // It only happens when the message set is empty
    };

    let (proof, vaa) = &state.wormhole_merkle_proof;

    if merkle_acc.root != proof.root {
        return Err(anyhow!("Invalid merkle root"));
    }

    state
        .accumulator_messages
        .messages
        .iter()
        .map(|m| {
            Ok(WormholeMerkleMessageProof {
                vaa:   vaa.clone(),
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
                            message: message.raw_message.clone().into(),
                            proof:   message.proof_set.wormhole_merkle_proof.proof.clone(),
                        })
                        .collect(),
                },
            ))?)
        })
        .collect::<Result<Vec<Vec<u8>>>>()
}
