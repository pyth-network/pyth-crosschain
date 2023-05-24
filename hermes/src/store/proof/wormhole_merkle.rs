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
    byteorder::{
        BigEndian,
        WriteBytesExt,
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
    },
    std::io::{
        Cursor,
        Write,
    },
};

type Hash = [u8; 20];

#[derive(Clone, PartialEq, Debug)]
pub struct WormholeMerkleProof {
    pub vaa:       Vec<u8>,
    pub slot:      u64,
    pub ring_size: u32,
    pub root:      Hash,
}

#[derive(Clone, PartialEq, Debug)]
pub struct WormholeMerkleMessageProof {
    pub vaa:   Vec<u8>,
    pub proof: MerklePath<Keccak160>,
}

pub async fn store_wormhole_merkle_verified_message(
    store: &Store,
    proof: WormholeMerkleProof,
) -> Result<()> {
    let pending_acc = store
        .pending_accumulations
        .entry(proof.slot)
        .or_default()
        .await
        .into_value();
    store
        .pending_accumulations
        .insert(proof.slot, pending_acc.wormhole_merkle_proof(proof))
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

    let proof = &state.wormhole_merkle_proof;

    log::info!(
        "Merkle root: {:?}, Verified root: {:?}",
        merkle_acc.root,
        proof.root
    );
    log::info!("Valid: {}", merkle_acc.root == proof.root);

    state
        .accumulator_messages
        .messages
        .iter()
        .map(|m| {
            Ok(WormholeMerkleMessageProof {
                vaa:   state.wormhole_merkle_proof.vaa.clone(),
                proof: merkle_acc
                    .prove(m.as_ref())
                    .ok_or(anyhow!("Failed to prove message"))?,
            })
        })
        .collect::<Result<Vec<WormholeMerkleMessageProof>>>()
}

pub fn construct_update_data(mut message_states: Vec<MessageState>) -> Result<Vec<Vec<u8>>> {
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

            let mut cursor = Cursor::new(Vec::new());

            cursor.write_u32::<BigEndian>(0x504e4155)?; // "PNAU"
            cursor.write_u8(0x01)?; // Major version
            cursor.write_u8(0x00)?; // Minor version
            cursor.write_u8(0)?; // Trailing header size

            cursor.write_u8(0)?; // Update type of WormholeMerkle. FIXME: Make this out of enum

            // Writing VAA
            cursor.write_u16::<BigEndian>(vaa.len().try_into()?)?;
            cursor.write_all(&vaa)?;

            // Writing number of messages
            cursor.write_u8(messages.len().try_into()?)?;

            for message in messages {
                // Writing message
                cursor.write_u16::<BigEndian>(message.raw_message.len().try_into()?)?;
                cursor.write_all(&message.raw_message)?;

                // Writing proof
                cursor.write_all(
                    &message
                        .proof_set
                        .wormhole_merkle_proof
                        .proof
                        .serialize()
                        .ok_or(anyhow!("Unable to serialize merkle proof path"))?,
                )?;
            }

            Ok(cursor.into_inner())
        })
        .collect::<Result<Vec<Vec<u8>>>>()
}
