use binance_recorder::sbe::{decode_message, BestBidAsk, TEMPLATE_ID_BEST_BID_ASK};

const HEADER_SIZE: usize = 8;
const FIXED_BLOCK_LEN: usize = 50;
const SCHEMA_ID: u16 = 1;

/// Hand-encode a full SBE frame: 8-byte header + fixed block (padded to
/// `block_length`) + varString8 symbol.
#[allow(clippy::too_many_arguments)]
fn encode_best_bid_ask(
    event_time_us: i64,
    book_update_id: i64,
    price_exponent: i8,
    qty_exponent: i8,
    bid_price: i64,
    bid_qty: i64,
    ask_price: i64,
    ask_qty: i64,
    symbol: &str,
    block_length: u16,
) -> Vec<u8> {
    let mut block = Vec::new();
    block.extend_from_slice(&event_time_us.to_le_bytes()); // @0
    block.extend_from_slice(&book_update_id.to_le_bytes()); // @8
    block.extend_from_slice(&price_exponent.to_le_bytes()); // @16
    block.extend_from_slice(&qty_exponent.to_le_bytes()); // @17
    block.extend_from_slice(&bid_price.to_le_bytes()); // @18
    block.extend_from_slice(&bid_qty.to_le_bytes()); // @26
    block.extend_from_slice(&ask_price.to_le_bytes()); // @34
    block.extend_from_slice(&ask_qty.to_le_bytes()); // @42
    assert_eq!(block.len(), FIXED_BLOCK_LEN);
    // Simulate appended fields: pad the fixed block out to block_length.
    block.resize(usize::from(block_length), 0);

    let mut frame = Vec::new();
    frame.extend_from_slice(&block_length.to_le_bytes());
    frame.extend_from_slice(&TEMPLATE_ID_BEST_BID_ASK.to_le_bytes());
    frame.extend_from_slice(&SCHEMA_ID.to_le_bytes());
    frame.extend_from_slice(&0u16.to_le_bytes()); // version
    frame.extend_from_slice(&block);
    let symbol_bytes = symbol.as_bytes();
    frame.push(u8::try_from(symbol_bytes.len()).expect("symbol fits in u8"));
    frame.extend_from_slice(symbol_bytes);
    frame
}

#[test]
fn test_golden_frame_decodes_all_fields() {
    let frame = encode_best_bid_ask(
        1_700_000_000_000_000,
        987_654_321,
        -8,
        -8,
        1_234_567_890,
        50_000_000,
        1_234_600_000,
        75_000_000,
        "XAUUSDT",
        FIXED_BLOCK_LEN as u16,
    );

    let decoded = decode_message(&frame)
        .expect("golden frame should decode")
        .expect("golden frame is templateId 10001");

    assert_eq!(
        decoded,
        BestBidAsk {
            event_time_us: 1_700_000_000_000_000,
            book_update_id: 987_654_321,
            price_exponent: -8,
            qty_exponent: -8,
            bid_price: 1_234_567_890,
            bid_qty: 50_000_000,
            ask_price: 1_234_600_000,
            ask_qty: 75_000_000,
            symbol: "XAUUSDT".to_string(),
        }
    );
}

#[test]
fn test_unknown_template_id_is_none() {
    let mut frame =
        encode_best_bid_ask(1, 2, -8, -8, 3, 4, 5, 6, "BTCUSDT", FIXED_BLOCK_LEN as u16);
    // Overwrite templateId (bytes 2..4) with a template we don't decode.
    frame[2..4].copy_from_slice(&20001u16.to_le_bytes());

    let decoded = decode_message(&frame).expect("unknown template is not an error");
    assert!(decoded.is_none(), "non-10001 templates decode to None");
}

#[test]
fn test_unexpected_schema_id_is_none() {
    let mut frame =
        encode_best_bid_ask(1, 2, -8, -8, 3, 4, 5, 6, "BTCUSDT", FIXED_BLOCK_LEN as u16);
    // Overwrite schemaId (bytes 4..6) with an unexpected schema.
    frame[4..6].copy_from_slice(&7u16.to_le_bytes());

    let decoded = decode_message(&frame).expect("unexpected schema is not an error");
    assert!(decoded.is_none(), "unexpected schemaId is skipped");
}

#[test]
fn test_truncated_frame_errors() {
    let frame = encode_best_bid_ask(1, 2, -8, -8, 3, 4, 5, 6, "BTCUSDT", FIXED_BLOCK_LEN as u16);
    // Drop the symbol var-data and part of the fixed block.
    let truncated = &frame[..HEADER_SIZE + 10];
    assert!(
        decode_message(truncated).is_err(),
        "a frame shorter than its advertised block must error"
    );

    // A frame too short for even the header.
    assert!(decode_message(&frame[..4]).is_err());
}

#[test]
fn test_larger_block_length_still_locates_symbol() {
    // Advertise a block 4 bytes larger than our compiled fixed block (a future
    // schema appending fields). The symbol must still be located via the header
    // blockLength, not a compiled offset.
    let extended_block_len = (FIXED_BLOCK_LEN + 4) as u16;
    let frame = encode_best_bid_ask(
        42,
        7,
        -8,
        -8,
        100,
        200,
        300,
        400,
        "ETHUSDT",
        extended_block_len,
    );

    let decoded = decode_message(&frame)
        .expect("forward-compatible frame should decode")
        .expect("templateId 10001");

    assert_eq!(decoded.symbol, "ETHUSDT");
    assert_eq!(decoded.event_time_us, 42);
    assert_eq!(decoded.book_update_id, 7);
    assert_eq!(decoded.bid_price, 100);
    assert_eq!(decoded.ask_qty, 400);
}
