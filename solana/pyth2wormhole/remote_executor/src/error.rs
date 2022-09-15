use solitaire::trace;
use solitaire::SolitaireError;

#[derive(Debug)]
pub enum Error {
    InvalidSourceChain,
    EmitterExecutorMismatch,
    SeqnoNeedsToBeIncreasing
}

/// Errors thrown by the program will bubble up to the solitaire wrapper, which needs a way to
/// translate these errors into something Solitaire can log and handle.
impl From<Error> for SolitaireError {
    fn from(e: Error) -> SolitaireError {
        trace!("ProgramError: {:?}", e);
        SolitaireError::Custom(e as u64)
    }
}