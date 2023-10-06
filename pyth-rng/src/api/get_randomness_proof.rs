use crate::Tree;
use pythnet_sdk::accumulators::merkle::MerklePath;
use pythnet_sdk::hashers::keccak256_160::Keccak160;
use pythnet_sdk::wire::array;
use serde::Deserialize;
use serde::Serialize;
use std::error::Error;

#[derive(Debug, Serialize, Deserialize)]
pub struct RandomProof {
    #[serde(with = "array")]
    randomness: [u8; 40],
    proof:      MerklePath<Keccak160>,
}

// Given an index into the random range, return a proof of the corresponding random number.
pub fn get_randomness_proof(state: &Tree, index: usize) -> Result<RandomProof, Box<dyn Error>> {
    // Get random number from state.
    if index >= state.range.range.len() {
        return Err("Index Out of Bounds".into());
    }

    Ok(RandomProof {
        randomness: state.range.range[index],
        proof:      state.proofs.find_path(index + 2),
    })
}
