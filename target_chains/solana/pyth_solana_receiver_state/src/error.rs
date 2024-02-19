use thiserror::Error;

#[derive(Error, Debug)]
pub enum GetPriceError {
    #[error("Price Too Old")]
    PriceTooOld,
    #[error("Wrong Feed Id")]
    WrongFeedId,
    #[error("Wrong Verification Level")]
    WrongVerificationLevel,
}

#[macro_export]
macro_rules! check {
    ($cond:expr, $err:expr) => {
        if !$cond {
            return Err($err);
        }
    };
}
