use anchor_lang::prelude::*;

#[error_code]
pub enum ReceiverError {
    #[msg("The emitter of the VAA is not Solana or Pythnet.")]
    EmitterChainNotSolanaOrPythnet,
    #[msg("The posted VAA has wrong magic number.")]
    PostedVaaHeaderWrongMagicNumber,
    #[msg("An error occured when deserializeing the VAA.")]
    DeserializeVAAFailed,
}
