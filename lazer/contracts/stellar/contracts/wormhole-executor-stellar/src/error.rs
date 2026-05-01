#![allow(dead_code)]

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// VAA version is not 1.
    InvalidVaaVersion = 1,
    /// Input data is truncated or too short.
    TruncatedData = 2,
    /// A guardian index in a signature exceeds the guardian set size.
    InvalidGuardianIndex = 3,
    /// Not enough guardian signatures to meet quorum.
    NoQuorum = 4,
    /// A recovered guardian address does not match the stored guardian set.
    GuardianSignatureMismatch = 5,
    /// The emitter chain ID does not match the expected governance source.
    InvalidEmitterChain = 6,
    /// The emitter address does not match the expected governance source.
    InvalidEmitterAddress = 7,
    /// The VAA sequence number has already been processed (replay).
    StaleSequence = 8,
    /// The contract has already been initialized.
    AlreadyInitialized = 9,
    /// The contract has not been initialized.
    NotInitialized = 10,
    /// Duplicate guardian signature index in the VAA.
    DuplicateGuardianSignature = 11,
    /// The VAA's guardian_set_index does not match the stored index.
    InvalidGuardianSetIndex = 12,
    /// The new guardian set index is not current + 1.
    InvalidGuardianSetUpgrade = 13,
    /// The new guardian set is empty.
    EmptyGuardianSet = 14,
    /// The PTGM magic bytes are not "PTGM" (0x5054474d).
    InvalidPtgmMagic = 15,
    /// The PTGM module is not Lazer (3).
    InvalidPtgmModule = 16,
    /// The PTGM target chain ID does not match this chain.
    InvalidTargetChain = 17,
    /// The PTGM action is not recognized.
    InvalidGovernanceAction = 18,
    /// The PTGM executor contract does not match this contract.
    InvalidExecutorAddress = 19,
}
