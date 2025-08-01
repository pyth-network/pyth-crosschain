library;

use std::{bytes::Bytes, hash::{Hash, keccak256}, bytes_conversions::b256::*};
use ::errors::PythError;

pub const MERKLE_LEAF_PREFIX = 0u8;
pub const MERKLE_NODE_PREFIX = 1u8;

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

    // Sway's from_be_bytes expects a 32-byte array, so we pad with zeros
    let mut full_address_child_a = Bytes::with_capacity(32);
    let mut full_address_child_b = Bytes::with_capacity(32);

    // Pad with 12 zeros (32 - 20 = 12)
    let mut i = 0;
    while i < 12 {
        full_address_child_a.push(0u8);
        full_address_child_b.push(0u8);
        i += 1;
    }

    // Append the 20-byte data
    full_address_child_a.append(child_a);
    full_address_child_b.append(child_b);

    // Convert to b256
    let a: b256 = b256::from_be_bytes(full_address_child_a);
    let b: b256 = b256::from_be_bytes(full_address_child_b);

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
    ref mut proof_offset: u64,
    root: Bytes,
    leaf_data: Bytes,
) -> u64 {
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

    let mut full_address_root = Bytes::with_capacity(32);
    let mut full_address_current_digest = Bytes::with_capacity(32);

    // Pad with 12 zeros (32 - 20 = 12)
    let mut i = 0;
    while i < 12 {
        full_address_current_digest.push(0u8);
        full_address_root.push(0u8);
        i += 1;
    }

    // Append the 20-byte data
    full_address_root.append(root);
    full_address_current_digest.append(current_digest);

    let current_digest_b256: b256 = b256::from_be_bytes(full_address_current_digest);
    let root_b256: b256 = b256::from_be_bytes(full_address_root);

    require(current_digest_b256 == root_b256, PythError::InvalidProof);

    proof_offset
}
