use anchor_lang::error_code;

#[error_code]
pub enum GetPriceError {
    #[msg("Price Too Old")]
    PriceTooOld = 10000, // Big number to avoid conflicts with other error codes
    #[msg("Wrong Feed Id")]
    WrongFeedId,
    #[msg("Wrong Verification Level")]
    WrongVerificationLevel,
    #[msg("Invalid string length")]
    InvalidStringLength,
}

#[macro_export]
macro_rules! check {
    ($cond:expr, $err:expr) => {
        if !$cond {
            return Err($err);
        }
    };
}
