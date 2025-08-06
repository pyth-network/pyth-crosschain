use crate::router::Price;

#[test]
fn price_constructs() {
    let price = Price::parse_str("42.68", 8).unwrap();
    assert_eq!(price.0.get(), 4_268_000_000);
    assert_eq!(price.to_f64(8).unwrap(), 42.68);

    let price2 = Price::from_integer(2, 8).unwrap();
    assert_eq!(price2.0.get(), 200_000_000);
    assert_eq!(price2.to_f64(8).unwrap(), 2.);

    let price3 = Price::new(123_456).unwrap();
    assert_eq!(price3.0.get(), 123_456);
    assert_eq!(price3.to_f64(8).unwrap(), 0.001_234_56);

    let price4 = Price::from_f64(42.68, 8).unwrap();
    assert_eq!(price4.0.get(), 4_268_000_000);
    assert_eq!(price4.to_f64(8).unwrap(), 42.68);
}

#[test]
fn price_constructs_negative_mantissa() {
    let price = Price::parse_str("-42.68", 8).unwrap();
    assert_eq!(price.0.get(), -4_268_000_000);
    assert_eq!(price.to_f64(8).unwrap(), -42.68);

    let price2 = Price::from_integer(-2, 8).unwrap();
    assert_eq!(price2.0.get(), -200_000_000);
    assert_eq!(price2.to_f64(8).unwrap(), -2.);

    let price3 = Price::new(-123_456).unwrap();
    assert_eq!(price3.0.get(), -123_456);
    assert_eq!(price3.to_f64(8).unwrap(), -0.001_234_56);

    let price4 = Price::from_f64(-42.68, 8).unwrap();
    assert_eq!(price4.0.get(), -4_268_000_000);
    assert_eq!(price4.to_f64(8).unwrap(), -42.68);
}

#[test]
fn price_constructs_zero_exponent() {
    let price = Price::parse_str("42", 0).unwrap();
    assert_eq!(price.0.get(), 42);
    assert_eq!(price.to_f64(0).unwrap(), 42.);

    let price2 = Price::from_integer(2, 0).unwrap();
    assert_eq!(price2.0.get(), 2);
    assert_eq!(price2.to_f64(0).unwrap(), 2.);

    let price3 = Price::new(123_456).unwrap();
    assert_eq!(price3.0.get(), 123_456);
    assert_eq!(price3.to_f64(0).unwrap(), 123_456.);

    let price4 = Price::from_f64(42., 0).unwrap();
    assert_eq!(price4.0.get(), 42);
    assert_eq!(price4.to_f64(0).unwrap(), 42.);
}

#[test]
fn price_rejects_zero_mantissa() {
    Price::parse_str("0.0", 8).unwrap_err();
    Price::from_integer(0, 8).unwrap_err();
    Price::new(0).unwrap_err();
    Price::from_f64(-0.0, 8).unwrap_err();
}

#[test]
fn price_rejects_too_precise() {
    Price::parse_str("42.68", 0).unwrap_err();
    Price::parse_str("42.68", 1).unwrap_err();
    Price::parse_str("42.68", 2).unwrap();
}
