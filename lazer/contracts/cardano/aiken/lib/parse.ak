use aiken/collection/list
use aiken/primitive/bytearray

const payload_magic_le = #"75d3c793"

pub type PriceUpdate {
  timestamp: Int,
  channel: Int,
  feeds: List<PriceFeed>,
}

pub type PriceFeed {
  feed_id: Int,
  price: Option<Int>,
  best_bid_price: Option<Int>,
  best_ask_price: Option<Int>,
  publisher_count: Option<Int>,
  exponent: Option<Int>,
  confidence: Option<Int>,
  funding_rate: Option<Int>,
  funding_timestamp: Option<Int>,
  funding_rate_interval: Option<Int>,
  market_session: Option<Int>,
}

// -- Byte readers --

fn read_u8(data: ByteArray, offset: Int) -> Int {
  bytearray.to_int_little_endian(bytearray.slice(data, offset, offset))
}

fn read_u16_le(data: ByteArray, offset: Int) -> Int {
  bytearray.to_int_little_endian(bytearray.slice(data, offset, offset + 1))
}

fn read_i16_le(data: ByteArray, offset: Int) -> Int {
  let v = read_u16_le(data, offset)
  if v >= 0x8000 {
    v - 0x10000
  } else {
    v
  }
}

fn read_u32_le(data: ByteArray, offset: Int) -> Int {
  bytearray.to_int_little_endian(bytearray.slice(data, offset, offset + 3))
}

fn read_u64_le(data: ByteArray, offset: Int) -> Int {
  bytearray.to_int_little_endian(bytearray.slice(data, offset, offset + 7))
}

fn read_i64_le(data: ByteArray, offset: Int) -> Int {
  let v = read_u64_le(data, offset)
  if v >= 0x8000000000000000 {
    v - 0x10000000000000000
  } else {
    v
  }
}

// -- Default PriceFeed --

fn empty_feed(feed_id: Int) -> PriceFeed {
  PriceFeed {
    feed_id,
    price: None,
    best_bid_price: None,
    best_ask_price: None,
    publisher_count: None,
    exponent: None,
    confidence: None,
    funding_rate: None,
    funding_timestamp: None,
    funding_rate_interval: None,
    market_session: None,
  }
}

// -- Property parser --

fn parse_property(
  data: ByteArray,
  offset: Int,
  feed: PriceFeed,
) -> Option<(PriceFeed, Int)> {
  let len = bytearray.length(data)
  if offset + 1 > len {
    None
  } else {
    let prop_id = read_u8(data, offset)
    let offset = offset + 1
    when prop_id is {
      // price (i64)
      0 ->
        if offset + 8 > len {
          None
        } else {
          let v = read_i64_le(data, offset)
          Some((PriceFeed { ..feed, price: Some(v) }, offset + 8))
        }
      // best_bid_price (i64)
      1 ->
        if offset + 8 > len {
          None
        } else {
          let v = read_i64_le(data, offset)
          Some((PriceFeed { ..feed, best_bid_price: Some(v) }, offset + 8))
        }
      // best_ask_price (i64)
      2 ->
        if offset + 8 > len {
          None
        } else {
          let v = read_i64_le(data, offset)
          Some((PriceFeed { ..feed, best_ask_price: Some(v) }, offset + 8))
        }
      // publisher_count (u16)
      3 ->
        if offset + 2 > len {
          None
        } else {
          let v = read_u16_le(data, offset)
          Some((PriceFeed { ..feed, publisher_count: Some(v) }, offset + 2))
        }
      // exponent (i16)
      4 ->
        if offset + 2 > len {
          None
        } else {
          let v = read_i16_le(data, offset)
          Some((PriceFeed { ..feed, exponent: Some(v) }, offset + 2))
        }
      // confidence (u64)
      5 ->
        if offset + 8 > len {
          None
        } else {
          let v = read_u64_le(data, offset)
          Some((PriceFeed { ..feed, confidence: Some(v) }, offset + 8))
        }
      // funding_rate (bool-flagged i64)
      6 ->
        if offset + 1 > len {
          None
        } else {
          let exists = read_u8(data, offset)
          if exists == 0 {
            Some((feed, offset + 1))
          } else if offset + 1 + 8 > len {
            None
          } else {
            let v = read_i64_le(data, offset + 1)
            Some(
              (PriceFeed { ..feed, funding_rate: Some(v) }, offset + 1 + 8),
            )
          }
        }
      // funding_timestamp (bool-flagged u64)
      7 ->
        if offset + 1 > len {
          None
        } else {
          let exists = read_u8(data, offset)
          if exists == 0 {
            Some((feed, offset + 1))
          } else if offset + 1 + 8 > len {
            None
          } else {
            let v = read_u64_le(data, offset + 1)
            Some(
              (
                PriceFeed { ..feed, funding_timestamp: Some(v) },
                offset + 1 + 8,
              ),
            )
          }
        }
      // funding_rate_interval (bool-flagged u64)
      8 ->
        if offset + 1 > len {
          None
        } else {
          let exists = read_u8(data, offset)
          if exists == 0 {
            Some((feed, offset + 1))
          } else if offset + 1 + 8 > len {
            None
          } else {
            let v = read_u64_le(data, offset + 1)
            Some(
              (
                PriceFeed { ..feed, funding_rate_interval: Some(v) },
                offset + 1 + 8,
              ),
            )
          }
        }
      // market_session (i16)
      9 ->
        if offset + 2 > len {
          None
        } else {
          let v = read_i16_le(data, offset)
          Some((PriceFeed { ..feed, market_session: Some(v) }, offset + 2))
        }
      // unknown property
      _ -> None
    }
  }
}

// -- Properties parser (recursive) --

fn parse_properties(
  data: ByteArray,
  offset: Int,
  count: Int,
  feed: PriceFeed,
) -> Option<(PriceFeed, Int)> {
  if count == 0 {
    Some((feed, offset))
  } else {
    when parse_property(data, offset, feed) is {
      None -> None
      Some((updated_feed, new_offset)) ->
        parse_properties(data, new_offset, count - 1, updated_feed)
    }
  }
}

// -- Feed parser --

fn parse_feed(data: ByteArray, offset: Int) -> Option<(PriceFeed, Int)> {
  let len = bytearray.length(data)
  // Need at least 4 (feed_id) + 1 (num_props)
  if offset + 5 > len {
    None
  } else {
    let feed_id = read_u32_le(data, offset)
    let num_props = read_u8(data, offset + 4)
    let feed = empty_feed(feed_id)
    parse_properties(data, offset + 5, num_props, feed)
  }
}

// -- Feeds parser (recursive) --

fn parse_feeds(
  data: ByteArray,
  offset: Int,
  count: Int,
) -> Option<(List<PriceFeed>, Int)> {
  if count == 0 {
    Some(([], offset))
  } else {
    when parse_feed(data, offset) is {
      None -> None
      Some((feed, new_offset)) ->
        when parse_feeds(data, new_offset, count - 1) is {
          None -> None
          Some((rest, final_offset)) ->
            Some(([feed, ..rest], final_offset))
        }
    }
  }
}

// -- Public API --

pub fn parse_price_update(payload: ByteArray) -> Option<PriceUpdate> {
  let len = bytearray.length(payload)
  if len < 14 {
    None
  } else {
    let magic = bytearray.slice(payload, 0, 3)
    if magic != payload_magic_le {
      None
    } else {
      let timestamp = read_u64_le(payload, 4)
      let channel = read_u8(payload, 12)
      let num_feeds = read_u8(payload, 13)
      when parse_feeds(payload, 14, num_feeds) is {
        None -> None
        Some((feeds, final_offset)) ->
          if final_offset == len {
            Some(PriceUpdate { timestamp, channel, feeds })
          } else {
            None
          }
      }
    }
  }
}

pub fn get_feed(update: PriceUpdate, feed_id: Int) -> Option<PriceFeed> {
  list.find(update.feeds, fn(feed) { feed.feed_id == feed_id })
}

// -- Tests --

test parse_basic() {
  let payload =
    #"75d3c7931c9773f30a240600010102000000010000e1f50500000000"
  expect Some(update) = parse_price_update(payload)
  expect update.timestamp == 1728479312975644
  expect update.channel == 1
  expect list.length(update.feeds) == 1
  expect Some(feed) = get_feed(update, 2)
  expect feed.feed_id == 2
  feed.price == Some(100000000)
}

test parse_invalid_magic() {
  let payload =
    #"76d3c7931c9773f30a240600010102000000010000e1f50500000000"
  parse_price_update(payload) == None
}

test parse_payload_too_short() {
  let payload = #"75d3c793"
  parse_price_update(payload) == None
}

test parse_trailing_bytes() {
  let payload =
    #"75d3c7931c9773f30a240600010102000000010000e1f505000000000000"
  parse_price_update(payload) == None
}

test get_feed_hit() {
  let payload =
    #"75d3c7931c9773f30a240600010102000000010000e1f50500000000"
  expect Some(update) = parse_price_update(payload)
  expect Some(feed) = get_feed(update, 2)
  feed.feed_id == 2
}

test get_feed_miss() {
  let payload =
    #"75d3c7931c9773f30a240600010102000000010000e1f50500000000"
  expect Some(update) = parse_price_update(payload)
  get_feed(update, 99) == None
}

test parse_negative_price() {
  let payload =
    #"75d3c7931c9773f30a2406000101020000000100ffffffffffffffff"
  expect Some(update) = parse_price_update(payload)
  expect Some(feed) = get_feed(update, 2)
  feed.price == Some(-1)
}

test parse_negative_exponent() {
  let payload = #"75d3c7931c9773f30a2406000101020000000104f8ff"
  expect Some(update) = parse_price_update(payload)
  expect Some(feed) = get_feed(update, 2)
  feed.exponent == Some(-8)
}

test parse_bool_flagged_absent() {
  let payload = #"75d3c7931c9773f30a240600010102000000010600"
  expect Some(update) = parse_price_update(payload)
  expect Some(feed) = get_feed(update, 2)
  feed.funding_rate == None
}

test parse_bool_flagged_present() {
  let payload =
    #"75d3c7931c9773f30a2406000101020000000106012a00000000000000"
  expect Some(update) = parse_price_update(payload)
  expect Some(feed) = get_feed(update, 2)
  feed.funding_rate == Some(42)
}

test parse_multiple_feeds() {
  let payload =
    #"75d3c7931c9773f30a240600010201000000010032000000000000000200000001006400000000000000"
  expect Some(update) = parse_price_update(payload)
  expect list.length(update.feeds) == 2
  expect Some(feed1) = get_feed(update, 1)
  expect feed1.price == Some(50)
  expect Some(feed2) = get_feed(update, 2)
  feed2.price == Some(100)
}

test parse_unknown_property_id() {
  let payload = #"75d3c7931c9773f30a240600010102000000010a"
  parse_price_update(payload) == None
}
