use chrono::{TimeZone, Utc};
use okx_recorder::models::parse_funding_history;
use rust_decimal::Decimal;
use std::str::FromStr;

/// A real `funding-rate-history` response shape: string decimals (up to ~17
/// decimal places) and epoch-millis `fundingTime` strings, most recent first.
fn sample_funding_response() -> &'static str {
    r#"{
        "code": "0",
        "msg": "",
        "data": [
            {
                "formulaType": "withRate",
                "fundingRate": "0.0000887121109659",
                "fundingTime": "1786550400000",
                "instId": "OPENAI-USDT-SWAP",
                "instType": "SWAP",
                "method": "current_period",
                "realizedRate": "0.0000887121109658"
            },
            {
                "formulaType": "withRate",
                "fundingRate": "-0.0000665167980022",
                "fundingTime": "1786521600000",
                "instId": "OPENAI-USDT-SWAP",
                "instType": "SWAP",
                "method": "current_period",
                "realizedRate": "-0.0000665167980022"
            }
        ]
    }"#
}

fn received_at() -> chrono::DateTime<Utc> {
    Utc.timestamp_millis_opt(1_786_550_500_123)
        .single()
        .unwrap()
}

#[test]
fn parse_funding_history_maps_fields() {
    let rows = parse_funding_history(sample_funding_response(), "OPENAI-USDT-SWAP", received_at())
        .expect("should parse");

    assert_eq!(rows.len(), 2);
    let first = &rows[0];
    assert_eq!(first.inst_id, "OPENAI-USDT-SWAP");
    assert_eq!(
        first.funding_rate,
        Decimal::from_str("0.0000887121109659").unwrap()
    );
    assert_eq!(
        first.realized_rate,
        Some(Decimal::from_str("0.0000887121109658").unwrap())
    );
    assert_eq!(
        first.funding_time,
        Utc.timestamp_millis_opt(1_786_550_400_000)
            .single()
            .unwrap()
    );
    assert_eq!(first.received_at, received_at());

    // Negative rates are valid: longs get paid.
    let second = &rows[1];
    assert_eq!(
        second.funding_rate,
        Decimal::from_str("-0.0000665167980022").unwrap()
    );
    assert_eq!(
        second.funding_time,
        Utc.timestamp_millis_opt(1_786_521_600_000)
            .single()
            .unwrap()
    );
}

#[test]
fn parse_funding_history_handles_missing_and_empty_realized_rate() {
    let body = r#"{
        "code": "0",
        "msg": "",
        "data": [
            { "instId": "OPENAI-USDT-SWAP", "fundingRate": "0.0001", "fundingTime": "1786550400000" },
            { "instId": "OPENAI-USDT-SWAP", "fundingRate": "0.0002", "fundingTime": "1786521600000", "realizedRate": "" }
        ]
    }"#;
    let rows =
        parse_funding_history(body, "OPENAI-USDT-SWAP", received_at()).expect("should parse");
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].realized_rate, None);
    assert_eq!(rows[1].realized_rate, None);
}

#[test]
fn parse_funding_history_handles_empty_data() {
    let body = r#"{ "code": "0", "msg": "", "data": [] }"#;
    let rows =
        parse_funding_history(body, "OPENAI-USDT-SWAP", received_at()).expect("should parse");
    assert!(rows.is_empty());
}

#[test]
fn parse_funding_history_drops_mismatched_instrument() {
    // A row for a different instrument than requested is dropped, not fatal.
    let body = r#"{
        "code": "0",
        "msg": "",
        "data": [
            { "instId": "ANTHROPIC-USDT-SWAP", "fundingRate": "0.0001", "fundingTime": "1786550400000" },
            { "instId": "OPENAI-USDT-SWAP", "fundingRate": "0.0002", "fundingTime": "1786550400000" }
        ]
    }"#;
    let rows =
        parse_funding_history(body, "OPENAI-USDT-SWAP", received_at()).expect("should parse");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].inst_id, "OPENAI-USDT-SWAP");
}

#[test]
fn parse_funding_history_errors_on_error_code() {
    // OKX reports a bad instrument as an error-code envelope with HTTP 200.
    let body = r#"{
        "code": "51001",
        "msg": "Instrument ID doesn't exist.",
        "data": []
    }"#;
    let err = parse_funding_history(body, "NOT-A-REAL-SWAP", received_at()).unwrap_err();
    let message = format!("{err:#}");
    assert!(
        message.contains("51001"),
        "error should carry the code: {message}"
    );
    assert!(
        message.contains("Instrument ID doesn't exist."),
        "error should carry the message: {message}"
    );
}

#[test]
fn parse_funding_history_errors_on_bad_funding_rate() {
    let body = r#"{
        "code": "0",
        "msg": "",
        "data": [
            { "instId": "OPENAI-USDT-SWAP", "fundingRate": "not-a-number", "fundingTime": "1786550400000" }
        ]
    }"#;
    let err = parse_funding_history(body, "OPENAI-USDT-SWAP", received_at()).unwrap_err();
    assert!(
        format!("{err:#}").contains("fundingRate"),
        "error should name the field: {err:#}"
    );
}

#[test]
fn parse_funding_history_errors_on_bad_funding_time() {
    let body = r#"{
        "code": "0",
        "msg": "",
        "data": [
            { "instId": "OPENAI-USDT-SWAP", "fundingRate": "0.0001", "fundingTime": "not-millis" }
        ]
    }"#;
    let err = parse_funding_history(body, "OPENAI-USDT-SWAP", received_at()).unwrap_err();
    assert!(
        format!("{err:#}").contains("fundingTime"),
        "error should name the field: {err:#}"
    );
}

#[test]
fn parse_funding_history_errors_on_non_json() {
    assert!(parse_funding_history("<html>502</html>", "OPENAI-USDT-SWAP", received_at()).is_err());
}
