use super::*;

type ChronoUtcDateTime = chrono::DateTime<chrono::Utc>;

#[test]
fn timestamp_constructors() {
    assert!(TimestampUs::now() > TimestampUs::UNIX_EPOCH);
    assert!(TimestampUs::now() < TimestampUs::MAX);

    assert_eq!(TimestampUs::from_micros(12345).as_micros(), 12345);
    assert_eq!(TimestampUs::from_micros(12345).as_nanos(), 12345000);
    assert_eq!(TimestampUs::from_micros(12345).as_millis(), 12);
    assert_eq!(TimestampUs::from_micros(12345).as_secs(), 0);

    assert_eq!(TimestampUs::from_micros(123456789).as_millis(), 123456);
    assert_eq!(TimestampUs::from_micros(123456789).as_secs(), 123);

    assert_eq!(
        TimestampUs::from_nanos(1234567890).unwrap().as_nanos(),
        1234567000
    );
    assert_eq!(
        TimestampUs::from_nanos(1234567890).unwrap().as_nanos_i128(),
        1234567000
    );

    assert_eq!(TimestampUs::from_millis(25).unwrap().as_millis(), 25);
    assert_eq!(TimestampUs::from_millis(25).unwrap().as_micros(), 25000);

    assert_eq!(TimestampUs::from_secs(25).unwrap().as_secs(), 25);
    assert_eq!(TimestampUs::from_secs(25).unwrap().as_millis(), 25000);
    assert_eq!(TimestampUs::from_secs(25).unwrap().as_micros(), 25000000);

    TimestampUs::from_nanos(u128::from(u64::MAX) * 1000 + 5000).unwrap_err();
    TimestampUs::from_millis(5_000_000_000_000_000_000).unwrap_err();
    TimestampUs::from_secs(5_000_000_000_000_000).unwrap_err();
}

#[test]
fn duration_constructors() {
    assert_eq!(DurationUs::from_micros(12345).as_micros(), 12345);
    assert_eq!(DurationUs::from_micros(12345).as_nanos(), 12345000);
    assert_eq!(DurationUs::from_micros(12345).as_millis(), 12);
    assert_eq!(DurationUs::from_micros(12345).as_secs(), 0);

    assert_eq!(DurationUs::from_micros(123456789).as_millis(), 123456);
    assert_eq!(DurationUs::from_micros(123456789).as_secs(), 123);

    assert_eq!(
        DurationUs::from_nanos(1234567890).unwrap().as_nanos(),
        1234567000
    );
    assert_eq!(
        DurationUs::from_nanos(1234567890).unwrap().as_nanos_i128(),
        1234567000
    );

    assert_eq!(DurationUs::from_millis(25).unwrap().as_millis(), 25);
    assert_eq!(DurationUs::from_millis(25).unwrap().as_micros(), 25000);

    assert_eq!(DurationUs::from_secs(25).unwrap().as_secs(), 25);
    assert_eq!(DurationUs::from_secs(25).unwrap().as_millis(), 25000);
    assert_eq!(DurationUs::from_secs(25).unwrap().as_micros(), 25000000);

    DurationUs::from_nanos(u128::from(u64::MAX) * 1000 + 5000).unwrap_err();
    DurationUs::from_millis(5_000_000_000_000_000_000).unwrap_err();
    DurationUs::from_secs(5_000_000_000_000_000).unwrap_err();

    assert_eq!(DurationUs::from_millis_u32(42).as_micros(), 42_000);
    assert_eq!(DurationUs::from_secs_u32(42).as_micros(), 42_000_000);
    assert_eq!(DurationUs::from_days_u16(42).as_micros(), 3_628_800_000_000);

    assert_eq!(
        DurationUs::from_millis_u32(u32::MAX).as_micros(),
        4_294_967_295_000
    );
    assert_eq!(
        DurationUs::from_secs_u32(u32::MAX).as_micros(),
        4_294_967_295_000_000
    );
    assert_eq!(
        DurationUs::from_days_u16(u16::MAX).as_micros(),
        5_662_224_000_000_000
    );
}

#[test]
#[allow(clippy::bool_assert_comparison)]
fn timestamp_ops() {
    assert_eq!(
        TimestampUs::from_micros(123)
            .checked_sub(DurationUs::from_micros(23))
            .unwrap(),
        TimestampUs::from_micros(100)
    );
    TimestampUs::from_micros(123)
        .checked_sub(DurationUs::from_micros(223))
        .unwrap_err();

    assert_eq!(
        TimestampUs::from_micros(123)
            .checked_add(DurationUs::from_micros(23))
            .unwrap(),
        TimestampUs::from_micros(146)
    );
    TimestampUs::from_micros(u64::MAX - 5)
        .checked_add(DurationUs::from_micros(223))
        .unwrap_err();

    assert_eq!(
        TimestampUs::from_micros(123)
            .duration_since(TimestampUs::from_micros(23))
            .unwrap(),
        DurationUs::from_micros(100)
    );
    TimestampUs::from_micros(123)
        .duration_since(TimestampUs::from_micros(223))
        .unwrap_err();

    assert_eq!(
        TimestampUs::from_micros(123).saturating_duration_since(TimestampUs::from_micros(23)),
        DurationUs::from_micros(100)
    );
    assert_eq!(
        TimestampUs::from_micros(123).saturating_duration_since(TimestampUs::from_micros(223)),
        DurationUs::ZERO
    );

    assert_eq!(
        TimestampUs::from_micros(123).saturating_add(DurationUs::from_micros(100)),
        TimestampUs::from_micros(223)
    );
    assert_eq!(
        TimestampUs::from_micros(u64::MAX - 100).saturating_add(DurationUs::from_micros(200)),
        TimestampUs::from_micros(u64::MAX)
    );
    assert_eq!(
        TimestampUs::from_micros(123).saturating_sub(DurationUs::from_micros(100)),
        TimestampUs::from_micros(23)
    );
    assert_eq!(
        TimestampUs::from_micros(123).saturating_sub(DurationUs::from_micros(200)),
        TimestampUs::from_micros(0)
    );
    assert_eq!(
        TimestampUs::from_micros(123).is_multiple_of(DurationUs::from_micros(200)),
        false
    );
    assert_eq!(
        TimestampUs::from_micros(400).is_multiple_of(DurationUs::from_micros(200)),
        true
    );
    assert_eq!(
        TimestampUs::from_micros(400).is_multiple_of(DurationUs::from_micros(0)),
        true
    );
    assert_eq!(
        TimestampUs::from_micros(400)
            .next_multiple_of(DurationUs::from_micros(200))
            .unwrap(),
        TimestampUs::from_micros(400)
    );
    assert_eq!(
        TimestampUs::from_micros(400)
            .previous_multiple_of(DurationUs::from_micros(200))
            .unwrap(),
        TimestampUs::from_micros(400)
    );
    assert_eq!(
        TimestampUs::from_micros(678)
            .next_multiple_of(DurationUs::from_micros(200))
            .unwrap(),
        TimestampUs::from_micros(800)
    );
    assert_eq!(
        TimestampUs::from_micros(678)
            .previous_multiple_of(DurationUs::from_micros(200))
            .unwrap(),
        TimestampUs::from_micros(600)
    );
    TimestampUs::from_micros(678)
        .previous_multiple_of(DurationUs::from_micros(0))
        .unwrap_err();
    TimestampUs::from_micros(678)
        .next_multiple_of(DurationUs::from_micros(0))
        .unwrap_err();
    TimestampUs::from_micros(u64::MAX - 5)
        .next_multiple_of(DurationUs::from_micros(1000))
        .unwrap_err();
}

#[test]
#[allow(clippy::bool_assert_comparison)]
fn duration_ops() {
    assert_eq!(
        DurationUs::from_micros(400).is_multiple_of(DurationUs::from_micros(200)),
        true
    );
    assert_eq!(
        DurationUs::from_micros(400).is_multiple_of(DurationUs::from_micros(300)),
        false
    );
    assert_eq!(
        DurationUs::from_micros(400).is_multiple_of(DurationUs::from_micros(0)),
        true
    );

    assert_eq!(
        DurationUs::from_micros(123)
            .checked_add(DurationUs::from_micros(100))
            .unwrap(),
        DurationUs::from_micros(223)
    );
    DurationUs::from_micros(u64::MAX - 5)
        .checked_add(DurationUs::from_micros(100))
        .unwrap_err();

    assert_eq!(
        DurationUs::from_micros(123)
            .checked_sub(DurationUs::from_micros(100))
            .unwrap(),
        DurationUs::from_micros(23)
    );
    DurationUs::from_micros(123)
        .checked_sub(DurationUs::from_micros(200))
        .unwrap_err();

    assert_eq!(
        DurationUs::from_micros(123).checked_mul(100).unwrap(),
        DurationUs::from_micros(12300)
    );
    DurationUs::from_micros(u64::MAX - 5)
        .checked_mul(100)
        .unwrap_err();
    assert_eq!(
        DurationUs::from_micros(123).checked_div(100).unwrap(),
        DurationUs::from_micros(1)
    );
    assert_eq!(
        DurationUs::from_micros(12300).checked_div(100).unwrap(),
        DurationUs::from_micros(123)
    );
    DurationUs::from_micros(123).checked_div(0).unwrap_err();

    assert!(DurationUs::ZERO.is_zero());
    assert!(!DurationUs::ZERO.is_positive());

    assert!(DurationUs::from_micros(5).is_positive());
    assert!(!DurationUs::from_micros(5).is_zero());
}

#[test]
fn timestamp_conversions() {
    let system_time = SystemTime::UNIX_EPOCH + Duration::from_micros(3_456_789_123_456_789);
    let ts = TimestampUs::try_from(system_time).unwrap();
    assert_eq!(ts, TimestampUs::from_micros(3_456_789_123_456_789));
    assert_eq!(SystemTime::try_from(ts).unwrap(), system_time);

    let proto_ts = ProtobufTimestamp::from(ts);
    assert_eq!(proto_ts.seconds, 3_456_789_123);
    assert_eq!(proto_ts.nanos, 456_789_000);
    assert_eq!(TimestampUs::try_from(&proto_ts).unwrap(), ts);
    assert_eq!(TimestampUs::try_from(proto_ts).unwrap(), ts);

    let chrono_dt: ChronoUtcDateTime = "2079-07-17T03:12:03.456789Z".parse().unwrap();
    assert_eq!(ChronoUtcDateTime::try_from(ts).unwrap(), chrono_dt);
    assert_eq!(TimestampUs::try_from(chrono_dt).unwrap(), ts);
}

#[test]
fn duration_conversions() {
    let duration = DurationUs::from_micros(123_456_789);
    let std_duration = Duration::from(duration);
    assert_eq!(format!("{std_duration:?}"), "123.456789s");
    assert_eq!(DurationUs::try_from(std_duration).unwrap(), duration);

    let proto_duration = ProtobufDuration::from(duration);
    assert_eq!(proto_duration.seconds, 123);
    assert_eq!(proto_duration.nanos, 456_789_000);
    assert_eq!(DurationUs::try_from(proto_duration).unwrap(), duration);
}

#[derive(Debug, PartialEq, Deserialize, Serialize)]
struct Test1 {
    t1: TimestampUs,
    d1: DurationUs,
    #[serde(with = "super::duration_us_serde_humantime")]
    d2: DurationUs,
}

#[test]
fn time_serde() {
    let test1 = Test1 {
        t1: TimestampUs::from_micros(123456789),
        d1: DurationUs::from_micros(123456789),
        d2: DurationUs::from_micros(123456789),
    };

    let json = serde_json::to_string(&test1).unwrap();
    assert_eq!(
        json,
        r#"{"t1":123456789,"d1":123456789,"d2":"2m 3s 456ms 789us"}"#
    );
    assert_eq!(serde_json::from_str::<Test1>(&json).unwrap(), test1);
}

#[cfg(feature = "mry")]
#[test]
#[mry::lock(TimestampUs::now)]
fn now_tests() {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    let now = Arc::new(AtomicU64::new(42));
    let now2 = Arc::clone(&now);
    TimestampUs::mock_now()
        .returns_with(move || TimestampUs::from_micros(now2.load(Ordering::Relaxed)));

    assert_eq!(TimestampUs::now().as_micros(), 42);

    now.store(45, Ordering::Relaxed);
    let s = TimestampUs::now();
    now.store(95, Ordering::Relaxed);
    assert_eq!(s.elapsed().unwrap(), DurationUs::from_micros(50));
    assert_eq!(s.saturating_elapsed(), DurationUs::from_micros(50));

    now.store(35, Ordering::Relaxed);
    s.elapsed().unwrap_err();
    assert_eq!(s.saturating_elapsed(), DurationUs::ZERO);
}
