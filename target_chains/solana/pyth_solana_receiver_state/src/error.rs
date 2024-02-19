use anchor_lang::error_code;

#[error_code]
pub enum GetPriceError {
    #[msg("Price Too Old")]
    PriceTooOld,
    #[msg("Wrong Feed Id")]
    WrongFeedId,
    #[msg("Wrong Verification Level")]
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
