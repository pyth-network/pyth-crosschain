use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReadAccountError {
    #[error("data too short")]
    DataTooShort,
    #[error("format mismatch")]
    FormatMismatch,
    #[error("already initialized")]
    AlreadyInitialized,
    #[error("invalid num prices")]
    InvalidNumPrices,
}

#[derive(Debug, Error)]
#[error("publisher price data overflow")]
pub struct PublisherPriceError;

#[derive(Debug, Error)]
pub enum ExtendError {
    #[error("not enough space")]
    NotEnoughSpace,
    #[error("invalid length")]
    InvalidLength,
}

#[cfg(feature = "solana-program")]
mod convert {
    use {super::*, solana_program::program_error::ProgramError};

    impl From<ReadAccountError> for ProgramError {
        fn from(value: ReadAccountError) -> Self {
            match value {
                ReadAccountError::DataTooShort => ProgramError::AccountDataTooSmall,
                ReadAccountError::FormatMismatch => ProgramError::InvalidAccountData,
                ReadAccountError::AlreadyInitialized => ProgramError::AccountAlreadyInitialized,
                ReadAccountError::InvalidNumPrices => ProgramError::InvalidAccountData,
            }
        }
    }

    impl From<PublisherPriceError> for ProgramError {
        fn from(_value: PublisherPriceError) -> Self {
            ProgramError::AccountDataTooSmall
        }
    }

    impl From<ExtendError> for ProgramError {
        fn from(value: ExtendError) -> Self {
            match value {
                ExtendError::NotEnoughSpace => ProgramError::AccountDataTooSmall,
                ExtendError::InvalidLength => ProgramError::InvalidInstructionData,
            }
        }
    }
}
