use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Invalid Magic")]
    InvalidMagic,

    #[error("Invalid Version")]
    InvalidVersion,
}

#[macro_export]
macro_rules! require {
    ($cond:expr, $err:expr) => {
        if !$cond {
            return Err($err);
        }
    };
}
