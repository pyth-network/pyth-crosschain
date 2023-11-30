use anchor_lang::prelude::*;

#[error_code]
pub enum ReceiverError {
    #[msg("The emitter chain of the VAA is invalid.")]
    InvalidEmitterChain,
    #[msg("The emitter address of the VAA is invalid.")]
    InvalidEmitterAddress,
    #[msg("The posted VAA account has the wrong owner.")]
    WrongVaaOwner,
    #[msg("The posted VAA has wrong magic number.")]
    PostedVaaHeaderWrongMagicNumber,
    #[msg("An error occurred when deserializing the VAA.")]
    DeserializeVaaFailed,
    #[msg("An error occurred when deserializing the updates.")]
    DeserializeUpdateFailed,
    #[msg("An error occurred when deserializing the message")]
    DeserializeMessageFailed,
    #[msg("Received an invalid wormhole message")]
    InvalidWormholeMessage,
    #[msg("Received an invalid price update")]
    InvalidPriceUpdate,
    #[msg("Received an invalid accumulator message type")]
    InvalidAccumulatorMessageType,
}
