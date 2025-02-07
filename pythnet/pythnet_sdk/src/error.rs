use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Invalid Magic")]
    InvalidMagic,

    #[error("Invalid Version")]
    InvalidVersion,

    #[error("Deserialization error")]
    DeserializationError,

    #[error("Invalid Input")]
    InvalidInput,
}

impl From<std::io::Error> for Error {
    fn from(_: std::io::Error) -> Self {
        Error::InvalidInput
    }
}

impl From<String> for Error {
    fn from(_: String) -> Self {
        Error::InvalidInput
    }
}

impl From<&str> for Error {
    fn from(_: &str) -> Self {
        Error::InvalidInput
    }
}

impl From<std::num::TryFromIntError> for Error {
    fn from(_: std::num::TryFromIntError) -> Self {
        Error::InvalidInput
    }
}

#[macro_export]
macro_rules! require {
    ($cond:expr, $err:expr) => {
        if !$cond {
            return Err($err);
        }
    };
}
