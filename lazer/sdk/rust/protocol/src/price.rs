#[cfg(test)]
mod tests;

use {
    crate::ExponentFactor,
    rust_decimal::{prelude::FromPrimitive, Decimal},
    serde::{Deserialize, Serialize},
    std::num::NonZeroI64,
    thiserror::Error,
};

#[derive(Debug, Error)]
pub enum PriceError {
    #[error("decimal parse error: {0}")]
    DecimalParse(#[from] rust_decimal::Error),
    #[error("price value is more precise than available exponent")]
    TooPrecise,
    #[error("zero price is unsupported")]
    ZeroPriceUnsupported,
    #[error("overflow")]
    Overflow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(transparent)]
pub struct Price(NonZeroI64);

impl Price {
    pub fn from_integer(value: i64, exponent: i16) -> Result<Price, PriceError> {
        let value = match ExponentFactor::get(exponent).ok_or(PriceError::Overflow)? {
            ExponentFactor::Mul(coef) => value.checked_mul(coef).ok_or(PriceError::Overflow)?,
            ExponentFactor::Div(coef) => value.checked_div(coef).ok_or(PriceError::Overflow)?,
        };
        let value = NonZeroI64::new(value).ok_or(PriceError::ZeroPriceUnsupported)?;
        Ok(Self(value))
    }

    pub fn parse_str(value: &str, exponent: i16) -> Result<Price, PriceError> {
        let value: Decimal = value.parse()?;
        let value = match ExponentFactor::get(exponent).ok_or(PriceError::Overflow)? {
            ExponentFactor::Mul(coef) => value
                .checked_mul(Decimal::from_i64(coef).ok_or(PriceError::Overflow)?)
                .ok_or(PriceError::Overflow)?,
            ExponentFactor::Div(coef) => value
                .checked_div(Decimal::from_i64(coef).ok_or(PriceError::Overflow)?)
                .ok_or(PriceError::Overflow)?,
        };
        if !value.is_integer() {
            return Err(PriceError::TooPrecise);
        }
        let value: i64 = value.try_into().map_err(|_| PriceError::Overflow)?;
        let value = NonZeroI64::new(value).ok_or(PriceError::Overflow)?;
        Ok(Self(value))
    }

    pub const fn from_nonzero_mantissa(mantissa: NonZeroI64) -> Self {
        Self(mantissa)
    }

    pub const fn from_mantissa(mantissa: i64) -> Result<Self, PriceError> {
        if let Some(value) = NonZeroI64::new(mantissa) {
            Ok(Self(value))
        } else {
            Err(PriceError::ZeroPriceUnsupported)
        }
    }

    pub fn mantissa(self) -> NonZeroI64 {
        self.0
    }

    pub fn mantissa_i64(self) -> i64 {
        self.0.get()
    }

    pub fn to_f64(self, exponent: i16) -> Result<f64, PriceError> {
        match ExponentFactor::get(exponent).ok_or(PriceError::Overflow)? {
            // Mul/div is reversed for this conversion
            ExponentFactor::Mul(coef) => Ok(self.0.get() as f64 / coef as f64),
            ExponentFactor::Div(coef) => Ok(self.0.get() as f64 * coef as f64),
        }
    }

    pub fn from_f64(value: f64, exponent: i16) -> Result<Self, PriceError> {
        let value = Decimal::from_f64(value).ok_or(PriceError::Overflow)?;
        let value = match ExponentFactor::get(exponent).ok_or(PriceError::Overflow)? {
            ExponentFactor::Mul(coef) => value
                .checked_mul(Decimal::from_i64(coef).ok_or(PriceError::Overflow)?)
                .ok_or(PriceError::Overflow)?,
            ExponentFactor::Div(coef) => value
                .checked_div(Decimal::from_i64(coef).ok_or(PriceError::Overflow)?)
                .ok_or(PriceError::Overflow)?,
        };
        let value: i64 = value.try_into().map_err(|_| PriceError::Overflow)?;
        Ok(Self(
            NonZeroI64::new(value).ok_or(PriceError::ZeroPriceUnsupported)?,
        ))
    }

    pub fn add_with_same_mantissa(self, other: Price) -> Result<Self, PriceError> {
        let value = self
            .0
            .get()
            .checked_add(other.0.get())
            .ok_or(PriceError::Overflow)?;
        Self::from_mantissa(value).map_err(|_| PriceError::ZeroPriceUnsupported)
    }

    pub fn sub_with_same_mantissa(self, other: Price) -> Result<Self, PriceError> {
        let value = self
            .0
            .get()
            .checked_sub(other.0.get())
            .ok_or(PriceError::Overflow)?;
        Self::from_mantissa(value).map_err(|_| PriceError::ZeroPriceUnsupported)
    }

    pub fn mul_integer(self, factor: i64) -> Result<Self, PriceError> {
        let value = self
            .0
            .get()
            .checked_mul(factor)
            .ok_or(PriceError::Overflow)?;
        Self::from_mantissa(value).map_err(|_| PriceError::ZeroPriceUnsupported)
    }

    pub fn div_integer(self, factor: i64) -> Result<Self, PriceError> {
        let value = self
            .0
            .get()
            .checked_div(factor)
            .ok_or(PriceError::Overflow)?;
        Self::from_mantissa(value).map_err(|_| PriceError::ZeroPriceUnsupported)
    }

    pub fn mul_decimal(self, mantissa: i64, rhs_exponent: i16) -> Result<Self, PriceError> {
        let left_value = i128::from(self.0.get());
        let right_value = i128::from(mantissa);

        let value = left_value
            .checked_mul(right_value)
            .ok_or(PriceError::Overflow)?;

        let value = match ExponentFactor::get(rhs_exponent).ok_or(PriceError::Overflow)? {
            ExponentFactor::Mul(coef) => {
                value.checked_div(coef.into()).ok_or(PriceError::Overflow)?
            }
            ExponentFactor::Div(coef) => {
                value.checked_mul(coef.into()).ok_or(PriceError::Overflow)?
            }
        };
        let value: i64 = value.try_into().map_err(|_| PriceError::Overflow)?;
        Self::from_mantissa(value).map_err(|_| PriceError::ZeroPriceUnsupported)
    }
}
