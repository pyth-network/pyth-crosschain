use pythnet_sdk::accumulators::merkle::MerklePath;
use pythnet_sdk::hashers::keccak256_160::Keccak160;
use pythnet_sdk::wire::array;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Serialize, Deserialize)]
pub struct RandomProof {
    #[serde(with = "array")]
    randomness: [u8; 40],
    proof:      MerklePath<Keccak160>,
}

// Given an index into the random range, return a proof of the corresponding random number.
pub fn get_randomness_proof() -> ! {
    unimplemented!()
}
