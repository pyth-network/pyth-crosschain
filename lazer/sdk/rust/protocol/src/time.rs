use {
    anyhow::Context,
    cadd::{
        convert::{Cinto, IntoType},
        ops::{cadd, cdiv, cmul, crem, csub, Cadd, Cdiv, Cmul, CnextMultipleOf, Csub},
    },
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

    pub const fn from_micros(micros: u64) -> Self {
        Self(micros)
    }

    pub const fn as_micros(self) -> u64 {
        self.0
    }

    pub fn as_nanos(self) -> u128 {
        // never overflows
        u128::from(self.0) * 1000
    }

    pub fn from_nanos(nanos: u128) -> cadd::Result<Self> {
        let micros = cdiv(nanos, 1000)?;
        Ok(Self::from_micros(micros.cinto()?))
    }

    pub fn as_millis(self) -> u64 {
        self.0 / 1000
    }

    pub fn from_millis(millis: u64) -> cadd::Result<Self> {
        let micros = cmul(millis, 1000)?;
        Ok(Self::from_micros(micros))
    }

    pub fn as_secs(self) -> u64 {
        self.0 / 1_000_000
    }

    pub fn from_secs(secs: u64) -> cadd::Result<Self> {
        let micros = cmul(secs, 1_000_000)?;
        Ok(Self::from_micros(micros))
    }

    pub fn duration_since(self, other: Self) -> cadd::Result<DurationUs> {
        Ok(DurationUs(csub(self.0, other.0)?))
    }

    pub fn saturating_duration_since(self, other: Self) -> DurationUs {
        DurationUs(self.0.saturating_sub(other.0))
    }

    pub fn elapsed(self) -> cadd::Result<DurationUs> {
        self.duration_since(Self::now())
    }

    pub fn saturating_elapsed(self) -> DurationUs {
        self.saturating_duration_since(Self::now())
    }

    pub fn saturating_add(self, duration: DurationUs) -> TimestampUs {
        TimestampUs(self.0.saturating_add(duration.0))
    }

    pub fn saturating_sub(self, duration: DurationUs) -> TimestampUs {
        TimestampUs(self.0.saturating_sub(duration.0))
    }

    pub fn is_multiple_of(self, duration: DurationUs) -> bool {
        match crem(self.0, duration.0) {
            Ok(rem) => rem == 0,
            Err(_) => false,
        }
    }

    /// Calculates the smallest value greater than or equal to self that is a multiple of `duration`.
    pub fn next_multiple_of(self, duration: DurationUs) -> cadd::Result<TimestampUs> {
        Ok(TimestampUs(self.0.cnext_multiple_of(duration.0)?))
    }

    /// Calculates the smallest value less than or equal to self that is a multiple of `duration`.
    pub fn previous_multiple_of(self, duration: DurationUs) -> cadd::Result<TimestampUs> {
        Ok(TimestampUs(self.0.cdiv(duration.0)?.cmul(duration.0)?))
    }
}

impl Cadd<DurationUs> for TimestampUs {
    type Error = cadd::Error;
    type Output = Self;

    fn cadd(self, duration: DurationUs) -> cadd::Result<Self> {
        Ok(TimestampUs(cadd(self.0, duration.0)?))
    }
}

impl Csub<DurationUs> for TimestampUs {
    type Error = cadd::Error;
    type Output = Self;

    fn csub(self, duration: DurationUs) -> cadd::Result<Self> {
        Ok(TimestampUs(csub(self.0, duration.0)?))
    }
}

impl TryFrom<ProtobufTimestamp> for TimestampUs {
    type Error = anyhow::Error;

    fn try_from(timestamp: ProtobufTimestamp) -> anyhow::Result<Self> {
        TryFrom::<&ProtobufTimestamp>::try_from(&timestamp)
    }
}

impl TryFrom<&ProtobufTimestamp> for TimestampUs {
    type Error = anyhow::Error;

    fn try_from(timestamp: &ProtobufTimestamp) -> anyhow::Result<Self> {
        let seconds_in_micros = timestamp.seconds.cmul(1_000_000)?.cinto_type::<u64>()?;
        let nanos_in_micros = timestamp.nanos.cdiv(1_000)?.cinto_type::<u64>()?;
        Ok(TimestampUs(cadd(seconds_in_micros, nanos_in_micros)?))
    }
}

impl From<TimestampUs> for ProtobufTimestamp {
    fn from(timestamp: TimestampUs) -> Self {
        ProtobufTimestamp {
            #[allow(
                clippy::cast_possible_wrap,
                reason = "u64 to i64 after this division can never overflow because the value cannot be too big"
            )]
            seconds: (timestamp.0 / 1_000_000) as i64,
            // never fails, never overflows
            nanos: (timestamp.0 % 1_000_000) as i32 * 1000,
            special_fields: Default::default(),
        }
    }
}

impl From<TimestampUs> for MessageField<ProtobufTimestamp> {
    fn from(value: TimestampUs) -> Self {
        MessageField::some(value.into())
    }
}

impl TryFrom<SystemTime> for TimestampUs {
    type Error = cadd::Error;

    fn try_from(value: SystemTime) -> Result<Self, Self::Error> {
        let value = value
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|_| cadd::Error::new("invalid system time".into()))?
            .as_micros()
            .cinto()?;
        Ok(Self(value))
    }
}

impl TryFrom<TimestampUs> for SystemTime {
    type Error = cadd::Error;

    fn try_from(value: TimestampUs) -> Result<Self, Self::Error> {
        SystemTime::UNIX_EPOCH.cadd(Duration::from_micros(value.as_micros()))
    }
}

impl TryFrom<&chrono::DateTime<chrono::Utc>> for TimestampUs {
    type Error = cadd::Error;

    fn try_from(value: &chrono::DateTime<chrono::Utc>) -> Result<Self, Self::Error> {
        Ok(Self(value.timestamp_micros().cinto()?))
    }
}

impl TryFrom<chrono::DateTime<chrono::Utc>> for TimestampUs {
    type Error = cadd::Error;

    fn try_from(value: chrono::DateTime<chrono::Utc>) -> Result<Self, Self::Error> {
        TryFrom::<&chrono::DateTime<chrono::Utc>>::try_from(&value)
    }
}

impl TryFrom<TimestampUs> for chrono::DateTime<chrono::Utc> {
    type Error = anyhow::Error;

    fn try_from(value: TimestampUs) -> Result<Self, Self::Error> {
        chrono::DateTime::<chrono::Utc>::from_timestamp_micros(value.as_micros().cinto()?)
            .with_context(|| format!("cannot convert timestamp to datetime: {value:?}"))
    }
}

/// Non-negative duration with microsecond resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct DurationUs(u64);

impl DurationUs {
    pub const ZERO: Self = Self(0);

    pub const fn from_micros(micros: u64) -> Self {
        Self(micros)
    }

    pub const fn as_micros(self) -> u64 {
        self.0
    }

    pub fn as_nanos(self) -> u128 {
        // never overflows
        u128::from(self.0) * 1000
    }

    pub fn from_nanos(nanos: u128) -> cadd::Result<Self> {
        let micros = cdiv(nanos, 1000)?;
        Ok(Self::from_micros(micros.cinto()?))
    }

    pub fn as_millis(self) -> u64 {
        self.0 / 1000
    }

    pub const fn from_millis_u32(millis: u32) -> Self {
        // never overflows
        Self((millis as u64) * 1_000)
    }

    pub fn from_millis(millis: u64) -> cadd::Result<Self> {
        let micros = cmul(millis, 1000)?;
        Ok(Self::from_micros(micros))
    }

    pub fn as_secs(self) -> u64 {
        self.0 / 1_000_000
    }

    pub const fn from_secs_u32(secs: u32) -> Self {
        // never overflows
        Self((secs as u64) * 1_000_000)
    }

    pub fn from_secs(secs: u64) -> cadd::Result<Self> {
        let micros = cmul(secs, 1_000_000)?;
        Ok(Self::from_micros(micros))
    }

    pub fn is_multiple_of(self, other: DurationUs) -> bool {
        match crem(self.0, other.0) {
            Ok(rem) => rem == 0,
            Err(_) => false,
        }
    }

    pub const fn is_zero(self) -> bool {
        self.0 == 0
    }

    pub const fn is_positive(self) -> bool {
        self.0 > 0
    }
}

impl Cadd for DurationUs {
    type Error = cadd::Error;
    type Output = Self;

    fn cadd(self, other: DurationUs) -> cadd::Result<Self> {
        Ok(DurationUs(cadd(self.0, other.0)?))
    }
}

impl Csub for DurationUs {
    type Error = cadd::Error;
    type Output = Self;

    fn csub(self, other: DurationUs) -> cadd::Result<Self> {
        Ok(DurationUs(csub(self.0, other.0)?))
    }
}

impl Cmul<u64> for DurationUs {
    type Error = cadd::Error;
    type Output = Self;

    fn cmul(self, n: u64) -> cadd::Result<DurationUs> {
        Ok(DurationUs(cmul(self.0, n)?))
    }
}

impl Cdiv<u64> for DurationUs {
    type Error = cadd::Error;
    type Output = Self;

    fn cdiv(self, n: u64) -> cadd::Result<DurationUs> {
        Ok(DurationUs(cdiv(self.0, n)?))
    }
}

impl From<DurationUs> for Duration {
    fn from(value: DurationUs) -> Self {
        Duration::from_micros(value.as_micros())
    }
}

impl TryFrom<Duration> for DurationUs {
    type Error = cadd::Error;

    fn try_from(value: Duration) -> Result<Self, Self::Error> {
        Ok(Self(value.as_micros().cinto()?))
    }
}

impl TryFrom<ProtobufDuration> for DurationUs {
    type Error = anyhow::Error;

    fn try_from(duration: ProtobufDuration) -> anyhow::Result<Self> {
        TryFrom::<&ProtobufDuration>::try_from(&duration)
    }
}

impl TryFrom<&ProtobufDuration> for DurationUs {
    type Error = anyhow::Error;

    fn try_from(duration: &ProtobufDuration) -> anyhow::Result<Self> {
        let seconds_in_micros = duration.seconds.cmul(1_000_000)?.cinto_type::<u64>()?;
        let nanos_in_micros = duration.nanos.cdiv(1_000)?.cinto_type::<u64>()?;
        Ok(DurationUs(cadd(seconds_in_micros, nanos_in_micros)?))
    }
}

impl From<DurationUs> for ProtobufDuration {
    fn from(duration: DurationUs) -> Self {
        ProtobufDuration {
            #[allow(
                clippy::cast_possible_wrap,
                reason = "u64 to i64 after this division can never overflow because the value cannot be too big"
            )]
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
