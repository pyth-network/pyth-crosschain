use {crate::rate::Rate, assert_float_eq::assert_float_absolute_eq};

#[test]
fn rate_constructs() {
    let rate = Rate::parse_str("42.68", -8).unwrap();
    assert_eq!(rate.0, 4_268_000_000);
    assert_float_absolute_eq!(rate.to_f64(-8).unwrap(), 42.68);

    let rate2 = Rate::from_integer(2, -8).unwrap();
    assert_eq!(rate2.0, 200_000_000);
    assert_float_absolute_eq!(rate2.to_f64(-8).unwrap(), 2.);

    let rate3 = Rate::from_mantissa(123_456);
    assert_eq!(rate3.0, 123_456);
    assert_float_absolute_eq!(rate3.to_f64(-8).unwrap(), 0.001_234_56);

    let rate4 = Rate::from_f64(42.68, -8).unwrap();
    assert_eq!(rate4.0, 4_268_000_000);
    assert_float_absolute_eq!(rate4.to_f64(-8).unwrap(), 42.68);
}

#[test]
fn rate_constructs_with_negative_mantissa() {
    let rate = Rate::parse_str("-42.68", -8).unwrap();
    assert_eq!(rate.0, -4_268_000_000);
    assert_float_absolute_eq!(rate.to_f64(-8).unwrap(), -42.68);

    let rate2 = Rate::from_integer(-2, -8).unwrap();
    assert_eq!(rate2.0, -200_000_000);
    assert_float_absolute_eq!(rate2.to_f64(-8).unwrap(), -2.);

    let rate3 = Rate::from_mantissa(-123_456);
    assert_eq!(rate3.0, -123_456);
    assert_float_absolute_eq!(rate3.to_f64(-8).unwrap(), -0.001_234_56);

    let rate4 = Rate::from_f64(-42.68, -8).unwrap();
    assert_eq!(rate4.0, -4_268_000_000);
    assert_float_absolute_eq!(rate4.to_f64(-8).unwrap(), -42.68);
}

#[test]
fn rate_constructs_with_zero_exponent() {
    let rate = Rate::parse_str("42", 0).unwrap();
    assert_eq!(rate.0, 42);
    assert_float_absolute_eq!(rate.to_f64(0).unwrap(), 42.);

    let rate2 = Rate::from_integer(2, 0).unwrap();
    assert_eq!(rate2.0, 2);
    assert_float_absolute_eq!(rate2.to_f64(0).unwrap(), 2.);

    let rate3 = Rate::from_mantissa(123_456);
    assert_eq!(rate3.0, 123_456);
    assert_float_absolute_eq!(rate3.to_f64(0).unwrap(), 123_456.);

    let rate4 = Rate::from_f64(42., 0).unwrap();
    assert_eq!(rate4.0, 42);
    assert_float_absolute_eq!(rate4.to_f64(0).unwrap(), 42.);
}

#[test]
fn rate_constructs_with_zero_mantissa() {
    let rate1 = Rate::parse_str("0.0", -8).unwrap();
    assert_eq!(rate1.0, 0);
    let rate2 = Rate::from_integer(0, -8).unwrap();
    assert_eq!(rate2.0, 0);
    let rate3 = Rate::from_mantissa(0);
    assert_eq!(rate3.0, 0);
    let rate4 = Rate::from_f64(-0.0, -8).unwrap();
    assert_eq!(rate4.0, 0);

    let rate1 = Rate::parse_str("0.0", 8).unwrap();
    assert_eq!(rate1.0, 0);
    let rate2 = Rate::from_integer(0, 8).unwrap();
    assert_eq!(rate2.0, 0);
    let rate4 = Rate::from_f64(-0.0, 8).unwrap();
    assert_eq!(rate4.0, 0);
}

#[test]
fn rate_constructs_with_positive_exponent() {
    let rate = Rate::parse_str("42_680_000", 3).unwrap();
    assert_eq!(rate.0, 42_680);
    assert_float_absolute_eq!(rate.to_f64(3).unwrap(), 42_680_000.);

    let rate2 = Rate::from_integer(200_000, 3).unwrap();
    assert_eq!(rate2.0, 200);
    assert_float_absolute_eq!(rate2.to_f64(3).unwrap(), 200_000.);

    let rate3 = Rate::from_mantissa(123_456);
    assert_eq!(rate3.0, 123_456);
    assert_float_absolute_eq!(rate3.to_f64(3).unwrap(), 123_456_000.);

    let rate4 = Rate::from_f64(42_680_000., 3).unwrap();
    assert_eq!(rate4.0, 42_680);
    assert_float_absolute_eq!(rate4.to_f64(3).unwrap(), 42_680_000.);
}

#[test]
fn rate_rejects_too_precise() {
    Rate::parse_str("42.68", 0).unwrap_err();
    Rate::parse_str("42.68", -1).unwrap_err();
    Rate::parse_str("42.68", -2).unwrap();

    Rate::parse_str("42_680", 3).unwrap_err();
    Rate::parse_str("42_600", 3).unwrap_err();
    Rate::parse_str("42_000", 3).unwrap();
}
