use anchor_lang::prelude::*;

#[error_code]
pub enum ReceiverError {
    #[msg("The emitter of the VAA is not Solana.")]
    EmitterChainNotSolana,
    #[msg("Posted VAA has wrong magic number in header.")]
    PostedVaaHeaderWrongMagicNumber,
    #[msg("An error occured when deserializeing the VAA.")]
    DeserializeVAAFailed,
}
