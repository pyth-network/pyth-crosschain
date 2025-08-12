#[cfg(test)]
mod tests;

use {
    anyhow::Context,
    protobuf::{
        well_known_types::{
            duration::Duration as ProtobufDuration, timestamp::Timestamp as ProtobufTimestamp,
        },
        MessageField,
    },
    serde::{Deserialize, Serialize},
    std::time::{Duration, SystemTime},
};

/// Unix timestamp with microsecond resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(transparent)]
pub struct TimestampUs(u64);

#[cfg_attr(feature = "mry", mry::mry)]
impl TimestampUs {
    pub fn now() -> Self {
        SystemTime::now().try_into().expect("invalid system time")
    }
}

impl TimestampUs {
    pub const UNIX_EPOCH: Self = Self(0);
    pub const MAX: Self = Self(u64::MAX);

    #[inline]
    pub const fn from_micros(micros: u64) -> Self {
        Self(micros)
    }

    #[inline]
    pub const fn as_micros(self) -> u64 {
        self.0
    }

    #[inline]
    pub fn as_nanos(self) -> u128 {
        // never overflows
        u128::from(self.0) * 1000
    }

    #[inline]
    pub fn as_nanos_i128(self) -> i128 {
        // never overflows
        i128::from(self.0) * 1000
    }

    #[inline]
    pub fn from_nanos(nanos: u128) -> anyhow::Result<Self> {
        let micros = nanos
            .checked_div(1000)
            .context("nanos.checked_div(1000) failed")?;
        Ok(Self::from_micros(micros.try_into()?))
    }

    #[inline]
    pub fn from_nanos_i128(nanos: i128) -> anyhow::Result<Self> {
        let micros = nanos
            .checked_div(1000)
            .context("nanos.checked_div(1000) failed")?;
        Ok(Self::from_micros(micros.try_into()?))
    }

    #[inline]
    pub fn as_millis(self) -> u64 {
        self.0 / 1000
    }

    #[inline]
    pub fn from_millis(millis: u64) -> anyhow::Result<Self> {
        let micros = millis
            .checked_mul(1000)
            .context("millis.checked_mul(1000) failed")?;
        Ok(Self::from_micros(micros))
    }

    #[inline]
    pub fn as_secs(self) -> u64 {
        self.0 / 1_000_000
    }

    #[inline]
    pub fn from_secs(secs: u64) -> anyhow::Result<Self> {
        let micros = secs
            .checked_mul(1_000_000)
            .context("secs.checked_mul(1_000_000) failed")?;
        Ok(Self::from_micros(micros))
    }

    #[inline]
    pub fn duration_since(self, other: Self) -> anyhow::Result<DurationUs> {
        Ok(DurationUs(
            self.0
                .checked_sub(other.0)
                .context("timestamp.checked_sub(duration) failed")?,
        ))
    }

    #[inline]
    pub fn saturating_duration_since(self, other: Self) -> DurationUs {
        DurationUs(self.0.saturating_sub(other.0))
    }

    #[inline]
    pub fn elapsed(self) -> anyhow::Result<DurationUs> {
        Self::now().duration_since(self)
    }

    #[inline]
    pub fn saturating_elapsed(self) -> DurationUs {
        Self::now().saturating_duration_since(self)
    }

    #[inline]
    pub fn saturating_add(self, duration: DurationUs) -> TimestampUs {
        TimestampUs(self.0.saturating_add(duration.0))
    }

    #[inline]
    pub fn saturating_sub(self, duration: DurationUs) -> TimestampUs {
        TimestampUs(self.0.saturating_sub(duration.0))
    }

    #[inline]
    pub fn is_multiple_of(self, duration: DurationUs) -> bool {
        match self.0.checked_rem(duration.0) {
            Some(rem) => rem == 0,
            None => true,
        }
    }

    /// Calculates the smallest value greater than or equal to self that is a multiple of `duration`.
    #[inline]
    pub fn next_multiple_of(self, duration: DurationUs) -> anyhow::Result<TimestampUs> {
        Ok(TimestampUs(
            self.0
                .checked_next_multiple_of(duration.0)
                .context("checked_next_multiple_of failed")?,
        ))
    }

    /// Calculates the smallest value less than or equal to self that is a multiple of `duration`.
    #[inline]
    pub fn previous_multiple_of(self, duration: DurationUs) -> anyhow::Result<TimestampUs> {
        Ok(TimestampUs(
            self.0
                .checked_div(duration.0)
                .context("checked_div failed")?
                .checked_mul(duration.0)
                .context("checked_mul failed")?,
        ))
    }

    #[inline]
    pub fn checked_add(self, duration: DurationUs) -> anyhow::Result<Self> {
        Ok(TimestampUs(
            self.0
                .checked_add(duration.0)
                .context("checked_add failed")?,
        ))
    }

    #[inline]
    pub fn checked_sub(self, duration: DurationUs) -> anyhow::Result<Self> {
        Ok(TimestampUs(
            self.0
                .checked_sub(duration.0)
                .context("checked_sub failed")?,
        ))
    }
}

impl TryFrom<ProtobufTimestamp> for TimestampUs {
    type Error = anyhow::Error;

    #[inline]
    fn try_from(timestamp: ProtobufTimestamp) -> anyhow::Result<Self> {
        TryFrom::<&ProtobufTimestamp>::try_from(&timestamp)
    }
}

impl TryFrom<&ProtobufTimestamp> for TimestampUs {
    type Error = anyhow::Error;

    fn try_from(timestamp: &ProtobufTimestamp) -> anyhow::Result<Self> {
        let seconds_in_micros: u64 = timestamp
            .seconds
            .checked_mul(1_000_000)
            .context("checked_mul failed")?
            .try_into()?;
        let nanos_in_micros: u64 = timestamp
            .nanos
            .checked_div(1_000)
            .context("checked_div failed")?
            .try_into()?;
        Ok(TimestampUs(
            seconds_in_micros
                .checked_add(nanos_in_micros)
                .context("checked_add failed")?,
        ))
    }
}

impl From<TimestampUs> for ProtobufTimestamp {
    fn from(timestamp: TimestampUs) -> Self {
        // u64 to i64 after this division can never overflow because the value cannot be too big
        ProtobufTimestamp {
            #[allow(clippy::cast_possible_wrap)]
            seconds: (timestamp.0 / 1_000_000) as i64,
            // never fails, never overflows
            nanos: (timestamp.0 % 1_000_000) as i32 * 1000,
            special_fields: Default::default(),
        }
    }
}

impl From<TimestampUs> for MessageField<ProtobufTimestamp> {
    #[inline]
    fn from(value: TimestampUs) -> Self {
        MessageField::some(value.into())
    }
}

impl TryFrom<SystemTime> for TimestampUs {
    type Error = anyhow::Error;

    fn try_from(value: SystemTime) -> Result<Self, Self::Error> {
        let value = value
            .duration_since(SystemTime::UNIX_EPOCH)
            .context("invalid system time")?
            .as_micros()
            .try_into()?;
        Ok(Self(value))
    }
}

impl TryFrom<TimestampUs> for SystemTime {
    type Error = anyhow::Error;

    fn try_from(value: TimestampUs) -> Result<Self, Self::Error> {
        SystemTime::UNIX_EPOCH
            .checked_add(Duration::from_micros(value.as_micros()))
            .context("checked_add failed")
    }
}

impl TryFrom<&chrono::DateTime<chrono::Utc>> for TimestampUs {
    type Error = anyhow::Error;

    #[inline]
    fn try_from(value: &chrono::DateTime<chrono::Utc>) -> Result<Self, Self::Error> {
        Ok(Self(value.timestamp_micros().try_into()?))
    }
}

impl TryFrom<chrono::DateTime<chrono::Utc>> for TimestampUs {
    type Error = anyhow::Error;

    #[inline]
    fn try_from(value: chrono::DateTime<chrono::Utc>) -> Result<Self, Self::Error> {
        TryFrom::<&chrono::DateTime<chrono::Utc>>::try_from(&value)
    }
}

impl TryFrom<TimestampUs> for chrono::DateTime<chrono::Utc> {
    type Error = anyhow::Error;

    #[inline]
    fn try_from(value: TimestampUs) -> Result<Self, Self::Error> {
        chrono::DateTime::<chrono::Utc>::from_timestamp_micros(value.as_micros().try_into()?)
            .with_context(|| format!("cannot convert timestamp to datetime: {value:?}"))
    }
}

/// Non-negative duration with microsecond resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct DurationUs(u64);

impl DurationUs {
    pub const ZERO: Self = Self(0);

    #[inline]
    pub const fn from_micros(micros: u64) -> Self {
        Self(micros)
    }

    #[inline]
    pub const fn as_micros(self) -> u64 {
        self.0
    }

    #[inline]
    pub fn as_nanos(self) -> u128 {
        // never overflows
        u128::from(self.0) * 1000
    }

    #[inline]
    pub fn as_nanos_i128(self) -> i128 {
        // never overflows
        i128::from(self.0) * 1000
    }

    #[inline]
    pub fn from_nanos(nanos: u128) -> anyhow::Result<Self> {
        let micros = nanos.checked_div(1000).context("checked_div failed")?;
        Ok(Self::from_micros(micros.try_into()?))
    }

    #[inline]
    pub fn as_millis(self) -> u64 {
        self.0 / 1000
    }

    #[inline]
    pub const fn from_millis_u32(millis: u32) -> Self {
        // never overflows
        Self((millis as u64) * 1_000)
    }

    #[inline]
    pub fn from_millis(millis: u64) -> anyhow::Result<Self> {
        let micros = millis
            .checked_mul(1000)
            .context("millis.checked_mul(1000) failed")?;
        Ok(Self::from_micros(micros))
    }

    #[inline]
    pub fn as_secs(self) -> u64 {
        self.0 / 1_000_000
    }

    #[inline]
    pub const fn from_secs_u32(secs: u32) -> Self {
        // never overflows
        Self((secs as u64) * 1_000_000)
    }

    #[inline]
    pub fn from_secs(secs: u64) -> anyhow::Result<Self> {
        let micros = secs
            .checked_mul(1_000_000)
            .context("secs.checked_mul(1_000_000) failed")?;
        Ok(Self::from_micros(micros))
    }

    #[inline]
    pub fn from_days_u16(days: u16) -> Self {
        // never overflows
        Self((days as u64) * 24 * 3600 * 1_000_000)
    }

    #[inline]
    pub fn is_multiple_of(self, other: DurationUs) -> bool {
        match self.0.checked_rem(other.0) {
            Some(rem) => rem == 0,
            None => true,
        }
    }

    #[inline]
    pub const fn is_zero(self) -> bool {
        self.0 == 0
    }

    #[inline]
    pub const fn is_positive(self) -> bool {
        self.0 > 0
    }

    #[inline]
    pub fn checked_add(self, other: DurationUs) -> anyhow::Result<Self> {
        Ok(DurationUs(
            self.0.checked_add(other.0).context("checked_add failed")?,
        ))
    }

    #[inline]
    pub fn checked_sub(self, other: DurationUs) -> anyhow::Result<Self> {
        Ok(DurationUs(
            self.0.checked_sub(other.0).context("checked_sub failed")?,
        ))
    }

    #[inline]
    pub fn checked_mul(self, n: u64) -> anyhow::Result<DurationUs> {
        Ok(DurationUs(
            self.0.checked_mul(n).context("checked_mul failed")?,
        ))
    }

    #[inline]
    pub fn checked_div(self, n: u64) -> anyhow::Result<DurationUs> {
        Ok(DurationUs(
            self.0.checked_div(n).context("checked_div failed")?,
        ))
    }
}

impl From<DurationUs> for Duration {
    #[inline]
    fn from(value: DurationUs) -> Self {
        Duration::from_micros(value.as_micros())
    }
}

impl TryFrom<Duration> for DurationUs {
    type Error = anyhow::Error;

    #[inline]
    fn try_from(value: Duration) -> Result<Self, Self::Error> {
        Ok(Self(value.as_micros().try_into()?))
    }
}

impl TryFrom<ProtobufDuration> for DurationUs {
    type Error = anyhow::Error;

    #[inline]
    fn try_from(duration: ProtobufDuration) -> anyhow::Result<Self> {
        TryFrom::<&ProtobufDuration>::try_from(&duration)
    }
}

impl TryFrom<&ProtobufDuration> for DurationUs {
    type Error = anyhow::Error;

    fn try_from(duration: &ProtobufDuration) -> anyhow::Result<Self> {
        let seconds_in_micros: u64 = duration
            .seconds
            .checked_mul(1_000_000)
            .context("checked_mul failed")?
            .try_into()?;
        let nanos_in_micros: u64 = duration
            .nanos
            .checked_div(1_000)
            .context("nanos.checked_div(1_000) failed")?
            .try_into()?;
        Ok(DurationUs(
            seconds_in_micros
                .checked_add(nanos_in_micros)
                .context("checked_add failed")?,
        ))
    }
}

impl From<DurationUs> for ProtobufDuration {
    fn from(duration: DurationUs) -> Self {
        ProtobufDuration {
            // u64 to i64 after this division can never overflow because the value cannot be too big
            #[allow(clippy::cast_possible_wrap)]
            seconds: (duration.0 / 1_000_000) as i64,
            // never fails, never overflows
            nanos: (duration.0 % 1_000_000) as i32 * 1000,
            special_fields: Default::default(),
        }
    }
}

pub mod duration_us_serde_humantime {
    use std::time::Duration;

    use serde::{de::Error, Deserialize, Serialize};

    use crate::time::DurationUs;

    pub fn serialize<S>(value: &DurationUs, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        humantime_serde::Serde::from(Duration::from(*value)).serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DurationUs, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = humantime_serde::Serde::<Duration>::deserialize(deserializer)?;
        value.into_inner().try_into().map_err(D::Error::custom)
    }
}
