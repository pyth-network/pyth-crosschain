library;

use std::{hash::{Hash, keccak256}};
use std::{array_conversions::u32::*, bytes::Bytes};
use ::errors::PythError;

pub const MERKLE_LEAF_PREFIX = 0u8;
pub const MERKLE_NODE_PREFIX = 1u8;

const ACCUMULATOR_MAGIC: u32 = 0x12345678;

pub fn accumulator_magic_bytes() -> Bytes {
    let accumulator_magic_array = ACCUMULATOR_MAGIC.to_be_bytes();

    let mut accumulator_magic_bytes = Bytes::with_capacity(4);
    accumulator_magic_bytes.push(accumulator_magic_array[0]);
    accumulator_magic_bytes.push(accumulator_magic_array[1]);
    accumulator_magic_bytes.push(accumulator_magic_array[2]);
    accumulator_magic_bytes.push(accumulator_magic_array[3]);

    accumulator_magic_bytes
}

fn leaf_hash(data: Bytes) -> Bytes {
    let mut bytes = Bytes::new();
    bytes.push(MERKLE_LEAF_PREFIX);
    bytes.append(data);

    let (slice, _) = Bytes::from(keccak256(bytes)).split_at(20);

    slice
}

fn node_hash(child_a: Bytes, child_b: Bytes) -> Bytes {
    let mut bytes = Bytes::with_capacity(41);
    bytes.push(MERKLE_NODE_PREFIX);

    let a: b256 = child_a.into();
    let b: b256 = child_b.into();
    if a > b {
        bytes.append(child_b);
        bytes.append(child_a);
    } else {
        bytes.append(child_a);
        bytes.append(child_b);
    }

    let (slice, _) = Bytes::from(keccak256(bytes)).split_at(20);

    slice
}

pub fn validate_proof(
    encoded_proof: Bytes,
    leaf_data: Bytes,
    ref mut proof_offset: u64,
    root: Bytes,
) -> u64 {
    let test_bytes = accumulator_magic_bytes();
    log(test_bytes);

    let mut current_digest = leaf_hash(leaf_data);

    let proof_size = encoded_proof.get(proof_offset).unwrap().as_u64();
    proof_offset += 1;

    let mut i = 0;
    while i < proof_size {
        let (_, slice) = encoded_proof.split_at(proof_offset);
        let (sibling_digest, _) = slice.split_at(20);
        proof_offset += 20;

        current_digest = node_hash(current_digest, sibling_digest);

        i += 1;
    }

    // TODO: investigate failing require statement on the accumulator update path.
    require(current_digest == root, PythError::InvalidProof);

    proof_offset
}
