use chrono::TimeZone;
use ondo_recorder::models::{OndoApiResponse, OndoQuote};

#[test]
fn test_quote_from_api_response_normalizes_wei() {
    // The API returns values in 18-decimal wei format and numeric side/chainId.
    // from_api_response should normalize to human-readable values using request metadata.
    let response = OndoApiResponse {
        chain_id: "1".to_string(),
        symbol: "AAPLon".to_string(),
        ticker: "AAPL".to_string(),
        asset_address: "0x1234".to_string(),
        side: "0".to_string(),
        token_amount: "10000000000000000000".to_string(), // 10 tokens in wei
        price: "230500000000000000000".to_string(),       // $230.50 in wei
    };
    let polled_at = chrono::Utc.with_ymd_and_hms(2026, 4, 13, 12, 0, 0).unwrap();
    let quote =
        OndoQuote::from_api_response(response, "buy", "ethereum-1", polled_at).expect("should parse");
    assert_eq!(quote.symbol, "AAPLon");
    assert_eq!(quote.ticker, "AAPL");
    assert_eq!(quote.side, "buy");
    assert_eq!(quote.chain_id, "ethereum-1");
    assert_eq!(quote.token_amount.to_string(), "10");
    assert_eq!(quote.price.to_string(), "230.50");
}

#[test]
fn test_quote_dedupe_key() {
    let response = OndoApiResponse {
        chain_id: "1".to_string(),
        symbol: "AAPLon".to_string(),
        ticker: "AAPL".to_string(),
        asset_address: "0x1234".to_string(),
        side: "0".to_string(),
        token_amount: "10000000000000000000".to_string(),
        price: "230500000000000000000".to_string(),
    };
    let polled_at = chrono::Utc.with_ymd_and_hms(2026, 4, 13, 12, 0, 0).unwrap();
    let quote =
        OndoQuote::from_api_response(response, "buy", "ethereum-1", polled_at).expect("should parse");
    let key = quote.dedupe_key();
    assert_eq!(key.0, "AAPLon");
    assert_eq!(key.1, "buy");
    assert_eq!(key.2, "10");
    assert_eq!(key.3, polled_at.timestamp_millis());
}

#[test]
fn test_quote_normalizes_fractional_prices() {
    let response = OndoApiResponse {
        chain_id: "1".to_string(),
        symbol: "HOODon".to_string(),
        ticker: "HOOD".to_string(),
        asset_address: "0xabcd".to_string(),
        side: "1".to_string(),
        token_amount: "1000000000000000000".to_string(),   // 1 token
        price: "67896035000000000000".to_string(),          // $67.896035
    };
    let polled_at = chrono::Utc::now();
    let quote =
        OndoQuote::from_api_response(response, "sell", "ethereum-1", polled_at).expect("should parse");
    assert_eq!(quote.side, "sell");
    assert_eq!(quote.token_amount.to_string(), "1");
    assert_eq!(quote.price.to_string(), "67.896035");
}

#[test]
fn test_invalid_decimal_in_response() {
    let response = OndoApiResponse {
        chain_id: "1".to_string(),
        symbol: "AAPLon".to_string(),
        ticker: "AAPL".to_string(),
        asset_address: "0x1234".to_string(),
        side: "0".to_string(),
        token_amount: "not-a-number".to_string(),
        price: "230500000000000000000".to_string(),
    };
    let polled_at = chrono::Utc::now();
    let result = OndoQuote::from_api_response(response, "buy", "ethereum-1", polled_at);
    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(err.contains("tokenAmount"), "error should mention field: {err}");
}
