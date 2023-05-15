//! Definition of the Accumulator Payload Formats.
//!
//! This module defines the data types that are injected into VAA's to be sent to other chains via
//! Wormhole. The wire format for these types must be backwards compatible and so all tyeps in this
//! module are expected to be append-only (for minor changes) and versioned for breaking changes.

use {
    borsh::BorshSerialize,
    serde::Serialize,
    wormhole_sdk::Vaa,
};

// Transfer Format.
// --------------------------------------------------------------------------------
// This definition is what will be sent over the wire (I.E, pulled from PythNet and
// submitted to target chains).
#[derive(BorshSerialize, Serialize)]
pub struct AccumulatorProof<'a> {
    magic:         [u8; 4],
    major_version: u8,
    minor_version: u8,
    trailing:      &'a [u8],
    proof:         v1::Proof<'a>,
}

// Proof Format (V1)
// --------------------------------------------------------------------------------
// The definitions within each module can be updated with append-only data without
// requiring a new module to be defined. So for example, new accounts can be added
// to the end of `AccumulatorAccount` without moving to a `v1`.
pub mod v1 {
    use super::*;

    // A hash of some data.
    pub type Hash = [u8; 32];

    #[derive(Serialize)]
    pub enum Proof<'a> {
        WormholeMerkle {
            proof:   Vaa<VerifiedDigest>,
            updates: &'a [MerkleProof<'a>],
        },
    }

    #[derive(Serialize)]
    pub struct VerifiedDigest {
        magic:      [u8; 4],
        proof_type: u8,
        len:        u8,
        storage_id: u64,
        digest:     Hash,
    }

    #[derive(Serialize)]
    pub struct MerkleProof<'a> {
        proof: &'a [Hash],
        data:  &'a [u8],
    }

    #[derive(Serialize)]
    pub enum AccumulatorAccount {
        Empty,
    }
}
