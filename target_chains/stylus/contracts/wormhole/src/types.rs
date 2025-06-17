use alloc::{vec, vec::Vec};
use stylus_sdk::alloy_primitives::{Address, FixedBytes};

#[derive(Clone, PartialEq, Default)]
pub struct GuardianSet {
    pub keys: Vec<Address>,
    pub expiration_time: u32,
}

#[derive(Clone)]
pub struct GuardianSignature {
    pub guardian_index: u8,
    pub signature: FixedBytes<65>,
}

#[derive(Clone)]
pub struct VerifiedVM {
    pub version: u8,
    pub guardian_set_index: u32,
    pub signatures: Vec<GuardianSignature>,
    pub timestamp: u32,
    pub nonce: u32,
    pub emitter_chain_id: u16,
    pub emitter_address: FixedBytes<32>,
    pub sequence: u64,
    pub consistency_level: u8,
    pub payload: Vec<u8>,
    pub hash: FixedBytes<32>,
}

pub enum WormholeError {
    InvalidGuardianSetIndex,
    GuardianSetExpired,
    NoQuorum,
    InvalidSignatureOrder,
    InvalidSignature,
    InvalidVAAFormat,
    GovernanceActionConsumed,
    AlreadyInitialized,
    NotInitialized,
    InvalidInput,
    InsufficientSignatures,
    InvalidGuardianIndex,
    InvalidAddressLength,
    VerifyVAAError,
}

impl core::fmt::Debug for WormholeError {
    fn fmt(&self, _: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        Ok(())
    }
}

impl From<WormholeError> for Vec<u8> {
    fn from(error: WormholeError) -> Vec<u8> {
        vec![match error {
            WormholeError::InvalidGuardianSetIndex => 1,
            WormholeError::GuardianSetExpired => 2,
            WormholeError::NoQuorum => 3,
            WormholeError::InvalidSignatureOrder => 4,
            WormholeError::InvalidSignature => 5,
            WormholeError::InvalidVAAFormat => 6,
            WormholeError::GovernanceActionConsumed => 7,
            WormholeError::AlreadyInitialized => 8,
            WormholeError::NotInitialized => 9,
            WormholeError::InvalidInput => 10,
            WormholeError::InsufficientSignatures => 11,
            WormholeError::InvalidGuardianIndex => 12,
            WormholeError::InvalidAddressLength => 13,
            WormholeError::VerifyVAAError => 14,
        }]
    }
}