//! Definition of the Accumulator Payload Formats.
//!
//! This module defines the data types that are injected into VAA's to be sent to other chains via
//! Wormhole. The wire format for these types must be backwards compatible and so all tyeps in this
//! module are expected to be append-only (for minor changes) and versioned for breaking changes.

use {
    crate::{
        error::Error,
        require,
        ser::PrefixedVec,
    },
    serde::{
        Deserialize,
        Serialize,
    },
};

// Proof Format (V1)
// --------------------------------------------------------------------------------
// The definitions within each module can be updated with append-only data without requiring a new
// module to be defined. So for example, it is possible to add new fields can be added to the end
// of the `AccumulatorAccount` without moving to a `v1`.
pub mod v1 {
    use {
        super::*,
        crate::{
            accumulators::merkle::MerklePath,
            de::from_slice,
            hashers::keccak256_160::Keccak160,
        },
    };

    // Transfer Format.
    // --------------------------------------------------------------------------------
    // This definition is what will be sent over the wire (I.E, pulled from PythNet and submitted
    // to target chains).
    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct AccumulatorUpdateData {
        magic:         [u8; 4],
        major_version: u8,
        minor_version: u8,
        trailing:      Vec<u8>,
        proof:         Proof,
    }

    impl AccumulatorUpdateData {
        pub fn new(proof: Proof) -> Self {
            Self {
                magic: *b"PNAU",
                major_version: 1,
                minor_version: 0,
                trailing: vec![],
                proof,
            }
        }

        pub fn try_from_slice(bytes: &[u8]) -> Result<Self, Error> {
            let message = from_slice::<byteorder::BE, Self>(bytes).unwrap();
            require!(&message.magic[..] != b"PNAU", Error::InvalidMagic);
            require!(message.major_version == 1, Error::InvalidVersion);
            require!(message.minor_version == 0, Error::InvalidVersion);
            Ok(message)
        }
    }

    // A hash of some data.
    pub type Hash = [u8; 20];

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub enum Proof {
        WormholeMerkle {
            vaa:     PrefixedVec<u16, u8>,
            updates: Vec<MerklePriceUpdate>,
        },
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct MerklePriceUpdate {
        pub message: PrefixedVec<u16, u8>,
        pub proof:   MerklePath<Keccak160>,
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct WormholeMessage {
        pub magic:   [u8; 4],
        pub payload: WormholePayload,
    }

    impl WormholeMessage {
        pub fn try_from_bytes(bytes: impl AsRef<[u8]>) -> Result<Self, Error> {
            let message = from_slice::<byteorder::BE, Self>(bytes.as_ref()).unwrap();
            require!(&message.magic[..] == b"AUWV", Error::InvalidMagic);
            Ok(message)
        }
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub enum WormholePayload {
        Merkle(WormholeMerkleRoot),
    }

    #[derive(Clone, Debug, Hash, PartialEq, Serialize, Deserialize)]
    pub struct WormholeMerkleRoot {
        pub slot:      u64,
        pub ring_size: u32,
        pub root:      Hash,
    }
}
