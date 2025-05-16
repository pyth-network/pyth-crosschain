use anyhow::{anyhow, Result};

/// A type representing a percentage value that must be >= -100
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Percentage(i64);

impl Percentage {
    pub fn new(value: i64) -> Result<Self> {
        if value < -100 {
            return Err(anyhow!("Percentage value must be >= -100"));
        }
        Ok(Self(value))
    }

    pub fn from_u32(value: u32) -> Self {
        Self(value as i64)
    }

    pub fn value(&self) -> i64 {
        self.0
    }

    pub fn multiplier(&self) -> u64 {
        u64::try_from(100 + self.0).unwrap_or(0)
    }
}

impl serde::Serialize for Percentage {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_i64(self.0)
    }
}

impl<'de> serde::Deserialize<'de> for Percentage {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = i64::deserialize(deserializer)?;
        Self::new(value).map_err(serde::de::Error::custom)
    }
}

impl From<Percentage> for i64 {
    fn from(p: Percentage) -> Self {
        p.0
    }
}

impl From<Percentage> for u64 {
    fn from(p: Percentage) -> Self {
        p.0 as u64
    }
}
