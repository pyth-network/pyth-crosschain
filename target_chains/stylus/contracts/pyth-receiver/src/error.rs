use alloc::vec::Vec;

#[derive(PartialEq)]
pub enum PythReceiverError {
    PriceUnavailable,
    InvalidUpdateData,
    VaaVerificationFailed,
    InvalidVaa,
    InvalidWormholeMessage,
    InvalidMerkleProof,
    InvalidAccumulatorMessage,
    InvalidMerkleRoot,
    InvalidMerklePath,
    InvalidUnknownSource,
    NewPriceUnavailable,
    InvalidAccumulatorMessageType,
    InsufficientFee,
    InvalidEmitterAddress,
    TooManyUpdates,
}

impl core::fmt::Debug for PythReceiverError {
    fn fmt(&self, _: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        Ok(())
    }
}

impl From<PythReceiverError> for Vec<u8> {
    fn from(error: PythReceiverError) -> Vec<u8> {
        vec![match error {
            PythReceiverError::PriceUnavailable => 1,
            PythReceiverError::InvalidUpdateData => 2,
            PythReceiverError::VaaVerificationFailed => 3,
            PythReceiverError::InvalidVaa => 4,
            PythReceiverError::InvalidWormholeMessage => 5,
            PythReceiverError::InvalidMerkleProof => 6,
            PythReceiverError::InvalidAccumulatorMessage => 7,
            PythReceiverError::InvalidMerkleRoot => 8,
            PythReceiverError::InvalidMerklePath => 9,
            PythReceiverError::InvalidUnknownSource => 10,
            PythReceiverError::NewPriceUnavailable => 11,
            PythReceiverError::InvalidAccumulatorMessageType => 12,
            PythReceiverError::InsufficientFee => 13,
            PythReceiverError::InvalidEmitterAddress => 14,
            PythReceiverError::TooManyUpdates => 15,
        }]
    }
}
