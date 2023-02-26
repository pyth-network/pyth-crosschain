use anchor_lang::prelude::*;

#[error_code]
pub enum ReceiverError {
    #[msg("The emitter of the VAA is not Solana.")]
    EmitterChainNotSolana,
    #[msg("An error occured when deserializeing the VAA.")]
    DeserializeVAAFailed,
}
