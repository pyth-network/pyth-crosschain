use anchor_lang::prelude::*;

#[error_code]
pub enum ReceiverError {
    #[msg("An error occured when deserializeing the VAA.")]
    DeserializeVAAFailed,
}
