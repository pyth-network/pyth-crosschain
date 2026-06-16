use rust_decimal::Decimal;

use crate::sbe::BestBidAsk;

/// A decoded top-of-book row ready for persistence. Prices and quantities are
/// real `Decimal` values (mantissa × 10^exponent already applied) so downstream
/// queries don't have to reconstruct them.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BinanceBestBidAsk {
    pub symbol: String,
    /// Event time in microseconds since the Unix epoch.
    pub event_time_us: i64,
    pub book_update_id: i64,
    pub bid_px: Decimal,
    pub bid_qty: Decimal,
    pub ask_px: Decimal,
    pub ask_qty: Decimal,
    pub source_endpoint: String,
}

impl BinanceBestBidAsk {
    pub fn from_sbe(decoded: &BestBidAsk, source_endpoint: &str) -> Self {
        Self {
            symbol: decoded.symbol.clone(),
            event_time_us: decoded.event_time_us,
            book_update_id: decoded.book_update_id,
            bid_px: scaled_decimal(decoded.bid_price, decoded.price_exponent),
            bid_qty: scaled_decimal(decoded.bid_qty, decoded.qty_exponent),
            ask_px: scaled_decimal(decoded.ask_price, decoded.price_exponent),
            ask_qty: scaled_decimal(decoded.ask_qty, decoded.qty_exponent),
            source_endpoint: source_endpoint.to_string(),
        }
    }
}

/// Convert an SBE `mantissa × 10^exponent` pair into a `Decimal`.
///
/// Binance encodes prices/qtys with a (usually negative) base-10 exponent, e.g.
/// `mantissa = 1234567890`, `exponent = -8` → `12.3456789`. Zero and positive
/// exponents are handled too.
pub fn scaled_decimal(mantissa: i64, exponent: i8) -> Decimal {
    if exponent <= 0 {
        // value = mantissa / 10^(-exponent); the negation fits because -i8::MIN
        // is representable in i32.
        let scale = u32::try_from(-i32::from(exponent)).unwrap_or(0);
        Decimal::new(mantissa, scale)
    } else {
        // value = mantissa * 10^exponent.
        let pow = u32::from(exponent.unsigned_abs());
        let factor = 10_i128.checked_pow(pow).unwrap_or(1);
        let scaled = i128::from(mantissa).saturating_mul(factor);
        Decimal::try_from_i128_with_scale(scaled, 0).unwrap_or_default()
    }
}
