use crate::router::{Price, PriceFeedId, Rate, TimestampUs};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
pub struct PythLazerAgentJrpcV1 {
    pub jsonrpc: JsonRpcVersion,
    #[serde(flatten)]
    pub params: JrpcParams,
    pub id: i64,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
#[serde(tag = "method", content = "params")]
pub enum JrpcParams {
    #[serde(rename = "send_updates")]
    SendUpdates(FeedUpdateParams),
    #[serde(rename = "get_symbols")]
    GetMetadata(GetMetadataParams),
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
pub struct FeedUpdateParams {
    pub feed_id: PriceFeedId,
    pub source_timestamp: TimestampUs,
    pub update: UpdateParams,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
#[serde(tag = "type")]
pub enum UpdateParams {
    #[serde(rename = "price")]
    PriceUpdate {
        price: Price,
        best_bid_price: Price,
        best_ask_price: Price,
    },
    #[serde(rename = "funding_rate")]
    FundingRateUpdate { price: Price, rate: Rate },
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
pub struct Filter {
    name: Option<String>,
    asset_type: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
pub struct GetMetadataParams {
    filters: Option<Vec<Filter>>,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
pub enum JsonRpcVersion {
    #[serde(rename = "2.0")]
    V2,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
pub struct JrpcResponse<T> {
    pub jsonrpc: JsonRpcVersion,
    pub result: T,
    pub id: i64,
}

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Serialize, Deserialize)]
struct SymbolMetadata {
    pub asset_type: String,
    pub cmc_id: i64,
    pub description: String,
    pub exponent: i64,
    pub hermes_id: String,
    #[serde(default, with = "humantime_serde", alias = "interval")]
    pub interval: Option<Duration>,
    pub min_channel: String,
    pub min_publishers: i64,
    pub name: String,
    pub pyth_lazer_id: i64,
    pub schedule: String,
    pub state: String,
    pub symbol: String,
}

#[cfg(test)]
mod tests {
    use crate::jrpc::JrpcParams::{GetMetadata, SendUpdates};
    use crate::jrpc::{
        FeedUpdateParams, Filter, GetMetadataParams, JsonRpcVersion, PythLazerAgentJrpcV1,
        UpdateParams,
    };
    use crate::router::{Price, PriceFeedId, Rate, TimestampUs};

    #[test]
    fn test_send_updates_price() {
        let json = r#"
        {
          "jsonrpc": "2.0",
          "method": "send_updates",
          "params": {
            "feed_id": 1,
            "source_timestamp": 124214124124,

            "update": {
              "type": "price",
              "price": 1234567890,
              "best_bid_price": 1234567891,
              "best_ask_price": 1234567892
            }
          },
          "id": 1
        }
        "#;

        let expected = PythLazerAgentJrpcV1 {
            jsonrpc: JsonRpcVersion::V2,
            params: SendUpdates(FeedUpdateParams {
                feed_id: PriceFeedId(1),
                source_timestamp: TimestampUs(124214124124),
                update: UpdateParams::PriceUpdate {
                    price: Price::from_integer(1234567890, 0).unwrap(),
                    best_bid_price: Price::from_integer(1234567891, 0).unwrap(),
                    best_ask_price: Price::from_integer(1234567892, 0).unwrap(),
                },
            }),
            id: 1,
        };

        assert_eq!(
            serde_json::from_str::<PythLazerAgentJrpcV1>(json).unwrap(),
            expected
        );
    }

    #[test]
    fn test_send_updates_funding_rate() {
        let json = r#"
        {
          "jsonrpc": "2.0",
          "method": "send_updates",
          "params": {
            "feed_id": 1,
            "source_timestamp": 124214124124,

            "update": {
              "type": "funding_rate",
              "price": 1234567890,
              "rate": 1234567891
            }
          },
          "id": 1
        }
        "#;

        let expected = PythLazerAgentJrpcV1 {
            jsonrpc: JsonRpcVersion::V2,
            params: SendUpdates(FeedUpdateParams {
                feed_id: PriceFeedId(1),
                source_timestamp: TimestampUs(124214124124),
                update: UpdateParams::FundingRateUpdate {
                    price: Price::from_integer(1234567890, 0).unwrap(),
                    rate: Rate::from_integer(1234567891, 0).unwrap(),
                },
            }),
            id: 1,
        };

        assert_eq!(
            serde_json::from_str::<PythLazerAgentJrpcV1>(json).unwrap(),
            expected
        );
    }
    #[test]
    fn test_send_get_symbols() {
        let json = r#"
        {
          "jsonrpc": "2.0",
          "method": "get_symbols",
          "params": {
            "filters": [
              {"name":  "BTC/USD"},
              {"asset_type": "crypto"}
            ]
          },
          "id": 1
        }
        "#;

        let expected = PythLazerAgentJrpcV1 {
            jsonrpc: JsonRpcVersion::V2,
            params: GetMetadata(GetMetadataParams {
                filters: Some(vec![
                    Filter {
                        name: Some("BTC/USD".to_string()),
                        asset_type: None,
                    },
                    Filter {
                        name: None,
                        asset_type: Some("crypto".to_string()),
                    },
                ]),
            }),
            id: 1,
        };

        assert_eq!(
            serde_json::from_str::<PythLazerAgentJrpcV1>(json).unwrap(),
            expected
        );
    }

    #[test]
    fn test_get_symbols_without_filters() {
        let json = r#"
        {
          "jsonrpc": "2.0",
          "method": "get_symbols",
          "params": {},
          "id": 1
        }
        "#;

        let expected = PythLazerAgentJrpcV1 {
            jsonrpc: JsonRpcVersion::V2,
            params: GetMetadata(GetMetadataParams { filters: None }),
            id: 1,
        };

        assert_eq!(
            serde_json::from_str::<PythLazerAgentJrpcV1>(json).unwrap(),
            expected
        );
    }
}
