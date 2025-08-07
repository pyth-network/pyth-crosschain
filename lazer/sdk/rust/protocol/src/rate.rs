#[cfg(test)]
mod tests;

use {
    rust_decimal::{prelude::FromPrimitive, Decimal},
    serde::{Deserialize, Serialize},
    thiserror::Error,
};

#[derive(Debug, Error)]
pub enum RateError {
    #[error("decimal parse error: {0}")]
    DecimalParse(#[from] rust_decimal::Error),
    #[error("price value is more precise than available exponent")]
    TooPrecise,
    #[error("overflow")]
    Overflow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(transparent)]
pub struct Rate(i64);

impl Rate {
    pub fn parse_str(value: &str, exponent: u32) -> Result<Self, RateError> {
        let value: Decimal = value.parse()?;
        let coef = 10i64.checked_pow(exponent).ok_or(RateError::Overflow)?;
        let coef = Decimal::from_i64(coef).ok_or(RateError::Overflow)?;
        let value = value.checked_mul(coef).ok_or(RateError::Overflow)?;
        if !value.is_integer() {
            return Err(RateError::TooPrecise);
        }
        let value: i64 = value.try_into().map_err(|_| RateError::Overflow)?;
        Ok(Self(value))
    }

    pub fn from_f64(value: f64, exponent: u32) -> Result<Self, RateError> {
        let value = Decimal::from_f64(value).ok_or(RateError::Overflow)?;
        let coef = 10i64.checked_pow(exponent).ok_or(RateError::Overflow)?;
        let coef = Decimal::from_i64(coef).ok_or(RateError::Overflow)?;
        let value = value.checked_mul(coef).ok_or(RateError::Overflow)?;
        let value: i64 = value.try_into().map_err(|_| RateError::Overflow)?;
        Ok(Self(value))
    }

    pub fn from_integer(value: i64, exponent: u32) -> Result<Self, RateError> {
        let coef = 10i64.checked_pow(exponent).ok_or(RateError::Overflow)?;
        let value = value.checked_mul(coef).ok_or(RateError::Overflow)?;
        Ok(Self(value))
    }

    pub const fn from_mantissa(mantissa: i64) -> Self {
        Self(mantissa)
    }

    pub fn mantissa(self) -> i64 {
        self.0
    }

    pub fn to_f64(self, exponent: u32) -> Result<f64, RateError> {
        Ok(self.0 as f64 / 10i64.checked_pow(exponent).ok_or(RateError::Overflow)? as f64)
    }
}
