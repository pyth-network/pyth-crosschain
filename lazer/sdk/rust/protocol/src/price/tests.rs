use {super::Price, assert_float_eq::assert_float_absolute_eq};

#[test]
fn price_constructs() {
    let price = Price::parse_str("42.68", -8).unwrap();
    assert_eq!(price.0.get(), 4_268_000_000);
    assert_float_absolute_eq!(price.to_f64(-8).unwrap(), 42.68);

    let price2 = Price::from_integer(2, -8).unwrap();
    assert_eq!(price2.0.get(), 200_000_000);
    assert_float_absolute_eq!(price2.to_f64(-8).unwrap(), 2.);

    let price3 = Price::from_mantissa(123_456).unwrap();
    assert_eq!(price3.0.get(), 123_456);
    assert_float_absolute_eq!(price3.to_f64(-8).unwrap(), 0.001_234_56);

    let price4 = Price::from_f64(42.68, -8).unwrap();
    assert_eq!(price4.0.get(), 4_268_000_000);
    assert_float_absolute_eq!(price4.to_f64(-8).unwrap(), 42.68);
}

#[test]
fn price_constructs_with_negative_mantissa() {
    let price = Price::parse_str("-42.68", -8).unwrap();
    assert_eq!(price.0.get(), -4_268_000_000);
    assert_float_absolute_eq!(price.to_f64(-8).unwrap(), -42.68);

    let price2 = Price::from_integer(-2, -8).unwrap();
    assert_eq!(price2.0.get(), -200_000_000);
    assert_float_absolute_eq!(price2.to_f64(-8).unwrap(), -2.);

    let price3 = Price::from_mantissa(-123_456).unwrap();
    assert_eq!(price3.0.get(), -123_456);
    assert_float_absolute_eq!(price3.to_f64(-8).unwrap(), -0.001_234_56);

    let price4 = Price::from_f64(-42.68, -8).unwrap();
    assert_eq!(price4.0.get(), -4_268_000_000);
    assert_float_absolute_eq!(price4.to_f64(-8).unwrap(), -42.68);
}

#[test]
fn price_constructs_with_zero_exponent() {
    let price = Price::parse_str("42", 0).unwrap();
    assert_eq!(price.0.get(), 42);
    assert_float_absolute_eq!(price.to_f64(0).unwrap(), 42.);

    let price2 = Price::from_integer(2, 0).unwrap();
    assert_eq!(price2.0.get(), 2);
    assert_float_absolute_eq!(price2.to_f64(0).unwrap(), 2.);

    let price3 = Price::from_mantissa(123_456).unwrap();
    assert_eq!(price3.0.get(), 123_456);
    assert_float_absolute_eq!(price3.to_f64(0).unwrap(), 123_456.);

    let price4 = Price::from_f64(42., 0).unwrap();
    assert_eq!(price4.0.get(), 42);
    assert_float_absolute_eq!(price4.to_f64(0).unwrap(), 42.);
}

#[test]
fn price_constructs_with_positive_exponent() {
    let price = Price::parse_str("42_680_000", 3).unwrap();
    assert_eq!(price.0.get(), 42_680);
    assert_float_absolute_eq!(price.to_f64(3).unwrap(), 42_680_000.);

    let price2 = Price::from_integer(200_000, 3).unwrap();
    assert_eq!(price2.0.get(), 200);
    assert_float_absolute_eq!(price2.to_f64(3).unwrap(), 200_000.);

    let price3 = Price::from_mantissa(123_456).unwrap();
    assert_eq!(price3.0.get(), 123_456);
    assert_float_absolute_eq!(price3.to_f64(3).unwrap(), 123_456_000.);

    let price4 = Price::from_f64(42_680_000., 3).unwrap();
    assert_eq!(price4.0.get(), 42_680);
    assert_float_absolute_eq!(price4.to_f64(3).unwrap(), 42_680_000.);
}

#[test]
fn price_rejects_zero_mantissa() {
    Price::parse_str("0.0", -8).unwrap_err();
    Price::from_integer(0, -8).unwrap_err();
    Price::from_mantissa(0).unwrap_err();
    Price::from_f64(-0.0, -8).unwrap_err();

    Price::parse_str("0.0", 8).unwrap_err();
    Price::from_integer(0, 8).unwrap_err();
    Price::from_f64(-0.0, 8).unwrap_err();
}

#[test]
fn price_rejects_too_precise() {
    Price::parse_str("42.68", 0).unwrap_err();
    Price::parse_str("42.68", -1).unwrap_err();
    Price::parse_str("42.68", -2).unwrap();

    Price::parse_str("42_680", 3).unwrap_err();
    Price::parse_str("42_600", 3).unwrap_err();
    Price::parse_str("42_000", 3).unwrap();
}

#[test]
fn price_ops() {
    let price1 = Price::parse_str("12.34", -8).unwrap();
    let price2 = Price::parse_str("23.45", -8).unwrap();
    assert_float_absolute_eq!(
        price1
            .add_with_same_exponent(price2)
            .unwrap()
            .to_f64(-8)
            .unwrap(),
        12.34 + 23.45
    );
    assert_float_absolute_eq!(
        price1
            .sub_with_same_exponent(price2)
            .unwrap()
            .to_f64(-8)
            .unwrap(),
        12.34 - 23.45
    );
    assert_float_absolute_eq!(
        price1.mul_integer(2).unwrap().to_f64(-8).unwrap(),
        12.34 * 2.
    );
    assert_float_absolute_eq!(
        price1.div_integer(2).unwrap().to_f64(-8).unwrap(),
        12.34 / 2.
    );

    assert_float_absolute_eq!(
        price1.mul_decimal(3456, -2).unwrap().to_f64(-8).unwrap(),
        12.34 * 34.56
    );

    assert_eq!(
        price1.mul_decimal(34, 2).unwrap().mantissa_i64(),
        1234000000 * 3400
    );
    let price2 = Price::parse_str("42_000", 3).unwrap();
    assert_float_absolute_eq!(
        price2.mul_integer(2).unwrap().to_f64(3).unwrap(),
        42_000. * 2.
    );
    assert_float_absolute_eq!(
        price2.div_integer(2).unwrap().to_f64(3).unwrap(),
        42_000. / 2.
    );
    assert_float_absolute_eq!(
        price2.mul_decimal(3456, -2).unwrap().to_f64(3).unwrap(),
        (42_000_f64 * 34.56 / 1000.).floor() * 1000.
    );
}
