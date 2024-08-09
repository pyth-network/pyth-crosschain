#[macro_export]
macro_rules! ensure {
    ($err:expr, $($expr:expr),+) => {
        // All expressions must be true; if any is false, it triggers an error. This is just
        // a slightly more useful version of anyhow::ensure without relying on anyhow::Result
        if !($($expr)&&+) {
            return Err($err.into());
        }
    };
}
