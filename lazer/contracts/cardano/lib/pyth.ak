use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use aiken/math/rational
use cardano/address.{Script}
use cardano/transaction.{Redeemer, ScriptPurpose, Withdraw}
use parser.{Parser, parse}
use pyth/message
use types/i16
use types/i64
use types/u16.{U16}
use types/u32.{U32}
use types/u64.{U64}
use types/u8.{U8}

const price_update_magic_le = #"75d3c793"

pub type PriceUpdate {
  timestamp_us: U64,
  channel_id: U8,
  feeds: List<Feed>,
}

pub fn get_updates(
  script: ScriptHash,
  redeemers: Pairs<ScriptPurpose, Redeemer>,
) -> List<PriceUpdate> {
  expect Some(redeemer) = pairs.get_first(redeemers, Withdraw(Script(script)))
  expect updates: List<ByteArray> = redeemer
  list.map(
    updates,
    fn(message) {
      let message = message.parse_without_verification(message)
      parse_update(message.payload)
    },
  )
}

fn parse_update(payload: ByteArray) -> PriceUpdate {
  parser.run(price_update, payload)
}

pub type Feed {
  feed_id: U32,
  price: Option<Option<Int>>,
  best_bid_price: Option<Option<Int>>,
  best_ask_price: Option<Option<Int>>,
  publisher_count: Option<U16>,
  exponent: Option<Int>,
  confidence: Option<Option<Int>>,
  funding_rate: Option<Option<Int>>,
  funding_timestamp: Option<Option<U64>>,
  funding_rate_interval: Option<Option<U64>>,
  market_session: Option<MarketSession>,
  ema_price: Option<Option<Int>>,
  ema_confidence: Option<Option<Int>>,
  feed_update_timestamp: Option<Option<U64>>,
}

fn empty(feed_id: U32) -> Feed {
  Feed {
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
    ema_price: None,
    ema_confidence: None,
    feed_update_timestamp: None,
  }
}

type FeedProperty {
  Price(Option<Int>)
  BestBidPrice(Option<Int>)
  BestAskPrice(Option<Int>)
  PublisherCount(U16)
  Exponent(Int)
  Confidence(Option<Int>)
  FundingRate(Option<Int>)
  FundingTimestamp(Option<U64>)
  FundingRateInterval(Option<U64>)
  MarketSession(MarketSession)
  EmaPrice(Option<Int>)
  EmaConfidence(Option<Int>)
  FeedUpdateTimestamp(Option<U64>)
}

fn apply_properties(self: Feed, properties: List<FeedProperty>) -> Feed {
  list.foldl(
    properties,
    self,
    fn(f, self) {
      when f is {
        Price(p) -> Feed { ..self, price: Some(p) }
        BestBidPrice(p) -> Feed { ..self, best_bid_price: Some(p) }
        BestAskPrice(p) -> Feed { ..self, best_ask_price: Some(p) }
        PublisherCount(p) -> Feed { ..self, publisher_count: Some(p) }
        Exponent(p) -> Feed { ..self, exponent: Some(p) }
        Confidence(p) -> Feed { ..self, confidence: Some(p) }
        FundingRate(p) -> Feed { ..self, funding_rate: Some(p) }
        FundingTimestamp(p) -> Feed { ..self, funding_timestamp: Some(p) }
        FundingRateInterval(p) ->
          Feed { ..self, funding_rate_interval: Some(p) }
        MarketSession(p) -> Feed { ..self, market_session: Some(p) }
        EmaPrice(p) -> Feed { ..self, ema_price: Some(p) }
        EmaConfidence(p) -> Feed { ..self, ema_confidence: Some(p) }
        FeedUpdateTimestamp(p) ->
          Feed { ..self, feed_update_timestamp: Some(p) }
      }
    },
  )
}

pub type MarketSession {
  Regular
  PreMarket
  PostMarket
  OverNight
  Closed
}

fn nonzero_i64_property(
  property: fn(Option<Int>) -> FeedProperty,
) -> Parser<FeedProperty> {
  let i <- parser.map(i64.from_le)
  let i = i64.as_int(i)
  property(
    if i == 0 {
      None
    } else {
      Some(i)
    },
  )
}

fn optional_property(
  property: fn(Option<a>) -> FeedProperty,
  parser: Parser<a>,
) -> Parser<FeedProperty> {
  let present <- parse(u8.from)
  if present != u8.zero {
    parser.map(parser, fn(p) { property(Some(p)) })
  } else {
    property(None) |> parser.return
  }
}

fn market_session() -> Parser<MarketSession> {
  let s <- parser.map(u16.from_le)
  when u16.as_int(s) is {
    0 -> Regular
    1 -> PreMarket
    2 -> PostMarket
    3 -> OverNight
    4 -> Closed
    _ -> fail @"MarketSession value out of range"
  }
}

fn feed_property() -> Parser<FeedProperty> {
  let property_id <- parse(u8.from)
  when u8.as_int(property_id) is {
    0 -> nonzero_i64_property(Price)
    1 -> nonzero_i64_property(BestBidPrice)
    2 -> nonzero_i64_property(BestAskPrice)
    3 -> parser.map(u16.from_le, PublisherCount)
    4 -> parser.map(i16.from_le, fn(i) { Exponent(i16.as_int(i)) })
    5 -> nonzero_i64_property(Confidence)
    6 -> optional_property(FundingRate, parser.map(i64.from_le, i64.as_int))
    7 -> optional_property(FundingTimestamp, u64.from_le)
    8 -> optional_property(FundingRateInterval, u64.from_le)
    9 -> parser.map(market_session(), MarketSession)
    10 -> nonzero_i64_property(EmaPrice)
    11 -> nonzero_i64_property(EmaConfidence)
    12 -> optional_property(FeedUpdateTimestamp, u64.from_le)
    _ -> fail @"FeedProperty ID out of range"
  }
}

const feed: Parser<Feed> = {
    let feed_id <- parse(u32.from_le)
    let properties_len <- parse(u8.from)
    let properties <-
      parse(parser.repeat(feed_property(), u8.as_int(properties_len)))
    apply_properties(empty(feed_id), properties) |> parser.return
  }

const price_update: Parser<PriceUpdate> = {
    let magic <- parse(parser.bytes(4))
    expect magic == price_update_magic_le
    let timestamp_us <- parse(u64.from_le)
    let channel_id <- parse(u8.from)
    let feeds_len <- parse(u8.from)
    let feeds <- parse(parser.repeat(feed, u8.as_int(feeds_len)))
    PriceUpdate { timestamp_us, channel_id, feeds } |> parser.return
  }

// Created with following subscription:
// {
//   ...,
//   "priceFeedIds": [1, 2, 112],
//   "properties": [
//     "price",
//     "bestBidPrice",
//     "bestAskPrice",
//     "exponent",
//     "fundingRate",
//     "fundingTimestamp",
//     "fundingRateInterval",
//     "marketSession",
//     "emaPrice",
//     "emaConfidence",
//     "feedUpdateTimestamp",
//   ],
//   "formats": ["solana"],
//   "channel": "fixed_rate@200ms",
//   "jsonBinaryEncoding": "hex",
// }
// Returned:
// {
//   "type": "json",
//   "value": {
//     "type": "streamUpdated",
//     "subscriptionId": 13285,
//     "parsed": {
//       "timestampUs": "1772613309000000",
//       "priceFeeds": [
//         {
//           "priceFeedId": 1,
//           "price": "6950870030930",
//           "bestBidPrice": "6950841224625",
//           "bestAskPrice": "6950918797952",
//           "exponent": -8,
//           "marketSession": "regular",
//           "emaPrice": "6891705600000",
//           "emaConfidence": 6891641300000,
//           "feedUpdateTimestamp": 1772613309000000
//         },
//         {
//           "priceFeedId": 2,
//           "price": "201300331620",
//           "bestBidPrice": "201299371656",
//           "bestAskPrice": "201307527050",
//           "exponent": -8,
//           "marketSession": "regular",
//           "emaPrice": "199516364000",
//           "emaConfidence": 199513381000,
//           "feedUpdateTimestamp": 1772613309000000
//         },
//         {
//           "priceFeedId": 112,
//           "price": "6946927951449",
//           "exponent": -12,
//           "fundingRate": 2520,
//           "fundingTimestamp": 1772613308916265,
//           "fundingRateInterval": 28800000000,
//           "marketSession": "regular",
//           "feedUpdateTimestamp": 1772613309000000
//         }
//       ]
//     },
//     "solana": {
//       "encoding": "hex",
//       "data": "b9011a82db446efb9cf488be308398477ab37d650aeb3e06ad7e2424c31a97b4e318026486f544c2bbe17f85a3a158a4c8b628fa078066d7880b6bfbff8278139bf8e40380efc1f480c5615af3fb673d42287e993da9fbc3506b6e41dfa32950820c2e6cfe0075d3c79340699bb22e4c06000303010000000b00529a23605206000001b10d6c5e520600000280ba0b635206000004f8ff0600070008000900000a0008aa99440600000b20e4d495440600000c0140699bb22e4c0600020000000b00644c6fde2e0000000188a660de2e000000028a17ddde2e00000004f8ff0600070008000900000ae01c1a742e0000000b8898ec732e0000000c0140699bb22e4c0600700000000b00593e2c755106000001000000000000000002000000000000000004f4ff0601d809000000000000070129229ab22e4c0600080100209db4060000000900000a00000000000000000b00000000000000000c0140699bb22e4c0600"
//     }
//   }
// }
const test_update =
  #"b9011a82db446efb9cf488be308398477ab37d650aeb3e06ad7e2424c31a97b4e318026486f544c2bbe17f85a3a158a4c8b628fa078066d7880b6bfbff8278139bf8e40380efc1f480c5615af3fb673d42287e993da9fbc3506b6e41dfa32950820c2e6cfe0075d3c79340699bb22e4c06000303010000000b00529a23605206000001b10d6c5e520600000280ba0b635206000004f8ff0600070008000900000a0008aa99440600000b20e4d495440600000c0140699bb22e4c0600020000000b00644c6fde2e0000000188a660de2e000000028a17ddde2e00000004f8ff0600070008000900000ae01c1a742e0000000b8898ec732e0000000c0140699bb22e4c0600700000000b00593e2c755106000001000000000000000002000000000000000004f4ff0601d809000000000000070129229ab22e4c0600080100209db4060000000900000a00000000000000000b00000000000000000c0140699bb22e4c0600"

test parses_update() {
  let message = message.parse_without_verification(test_update)
  let update = parse_update(message.payload)
  let PriceUpdate { timestamp_us, channel_id, feeds } = update
  expect u64.as_int(timestamp_us) == 1772613309000 * 1000
  expect u8.as_int(channel_id) == 3
  expect [feed1, feed2, feed112] = feeds

  expect u32.as_int(feed1.feed_id) == 1
  expect Some(Some(price1)) = feed1.price
  expect Some(exponent1) = feed1.exponent
  expect Some(multiplier1) = rational.from_int(10) |> rational.pow(exponent1)
  expect
    (
      rational.from_int(price1)
        |> rational.mul(multiplier1)
        |> rational.round()
    ) == 69509
  expect Some(Some(best_bid_price1)) = feed1.best_bid_price
  expect
    (
      rational.from_int(best_bid_price1)
        |> rational.mul(multiplier1)
        |> rational.round()
    ) == 69508
  expect Some(Some(best_ask_price1)) = feed1.best_ask_price
  expect
    (
      rational.from_int(best_ask_price1)
        |> rational.mul(multiplier1)
        |> rational.round()
    ) == 69509
  expect None = feed1.publisher_count
  expect None = feed1.confidence
  expect Some(None) = feed1.funding_rate
  expect Some(None) = feed1.funding_timestamp
  expect Some(None) = feed1.funding_rate_interval
  expect Some(Regular) = feed1.market_session
  expect Some(Some(ema_price1)) = feed1.ema_price
  expect
    (
      rational.from_int(ema_price1)
        |> rational.mul(multiplier1)
        |> rational.round()
    ) == 68917
  expect Some(Some(ema_confidence1)) = feed1.ema_confidence
  expect
    (
      rational.from_int(ema_confidence1)
        |> rational.mul(multiplier1)
        |> rational.round()
    ) == 68916
  expect Some(Some(feed_update_timestamp1)) = feed1.feed_update_timestamp
  expect u64.as_int(feed_update_timestamp1) == 1772613309000 * 1000

  expect u32.as_int(feed2.feed_id) == 2
  expect Some(Some(price2)) = feed2.price
  expect Some(exponent2) = feed2.exponent
  expect Some(multiplier2) = rational.from_int(10) |> rational.pow(exponent2)
  expect
    (
      rational.from_int(price2)
        |> rational.mul(multiplier2)
        |> rational.round()
    ) == 2013
  expect Some(Some(best_bid_price2)) = feed2.best_bid_price
  expect
    (
      rational.from_int(best_bid_price2)
        |> rational.mul(multiplier2)
        |> rational.round()
    ) == 2013
  expect Some(Some(best_ask_price2)) = feed2.best_ask_price
  expect
    (
      rational.from_int(best_ask_price2)
        |> rational.mul(multiplier2)
        |> rational.round()
    ) == 2013
  expect None = feed2.publisher_count
  expect None = feed2.confidence
  expect Some(None) = feed2.funding_rate
  expect Some(None) = feed2.funding_timestamp
  expect Some(None) = feed2.funding_rate_interval
  expect Some(Regular) = feed2.market_session
  expect Some(Some(ema_price2)) = feed2.ema_price
  expect
    (
      rational.from_int(ema_price2)
        |> rational.mul(multiplier2)
        |> rational.round()
    ) == 1995
  expect Some(Some(ema_confidence2)) = feed2.ema_confidence
  expect
    (
      rational.from_int(ema_confidence2)
        |> rational.mul(multiplier2)
        |> rational.round()
    ) == 1995
  expect Some(Some(feed_update_timestamp2)) = feed2.feed_update_timestamp
  expect u64.as_int(feed_update_timestamp2) == 1772613309000 * 1000

  expect u32.as_int(feed112.feed_id) == 112
  expect Some(Some(price112)) = feed112.price
  expect Some(exponent112) = feed112.exponent
  expect Some(multiplier112) =
    rational.from_int(10) |> rational.pow(exponent112)
  expect
    (
      rational.from_int(price112)
        |> rational.mul(multiplier112)
        |> rational.round()
    ) == 7
  expect Some(None) = feed112.best_bid_price
  expect Some(None) = feed112.best_ask_price
  expect None = feed2.publisher_count
  expect None = feed2.confidence
  expect Some(Some(2520)) = feed112.funding_rate
  expect Some(Some(funding_timestamp112)) = feed112.funding_timestamp
  expect u64.as_int(funding_timestamp112) == 1772613308916265
  expect Some(Some(funding_rate_interval112)) = feed112.funding_rate_interval
  expect u64.as_int(funding_rate_interval112) == 28800000000
  expect Some(Regular) = feed112.market_session
  expect Some(None) = feed112.ema_price
  expect Some(None) = feed112.ema_confidence
  expect Some(Some(feed_update_timestamp112)) = feed112.feed_update_timestamp
  expect u64.as_int(feed_update_timestamp112) == 1772613309000 * 1000
}
