use anchor_lang::error_code;

#[error_code]
#[derive(PartialEq)]
pub enum GetPriceError {
    #[msg("This price feed update's age exceeds the requested maximum age")]
    PriceTooOld = 10000, // Big number to avoid conflicts with the SDK user's program error codes
    #[msg("This TWAP update's window size is invalid")]
    InvalidWindowSize,
    #[msg("The price feed update doesn't match the requested feed id")]
    MismatchedFeedId,
    #[msg("This price feed update has a lower verification level than the one requested")]
    InsufficientVerificationLevel,
    #[msg("Feed id must be 32 Bytes, that's 64 hex characters or 66 with a 0x prefix")]
    FeedIdMustBe32Bytes,
    #[msg("Feed id contains non-hex characters")]
    FeedIdNonHexCharacter,
}

#[macro_export]
macro_rules! check {
    ($cond:expr, $err:expr) => {
        if !$cond {
            return Err($err);
        }
    };
}
