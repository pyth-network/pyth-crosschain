/// Append-only custom error list.
#[repr(u32)]
pub enum AttesterCustomError {
    /// Explicitly checked for in client code, change carefully
    AttestRateLimitReached = 13,
}
