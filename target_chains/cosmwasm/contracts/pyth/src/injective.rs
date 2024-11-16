use {
    cosmwasm_std::{Addr, CosmosMsg, CustomMsg},
    pyth_sdk_cw::PriceFeed,
    schemars::JsonSchema,
    serde::{Deserialize, Serialize},
};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct InjectivePriceAttestation {
    pub price_id: String,
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub ema_price: i64,
    pub ema_conf: u64,
    pub ema_expo: i32,
    pub publish_time: i64,
}

impl From<&PriceFeed> for InjectivePriceAttestation {
    fn from(pa: &PriceFeed) -> Self {
        let price = pa.get_price_unchecked();
        let ema_price = pa.get_ema_price_unchecked();
        InjectivePriceAttestation {
            price_id: pa.id.to_hex(),
            price: price.price,
            conf: price.conf,
            expo: price.expo,
            ema_price: ema_price.price,
            ema_conf: ema_price.conf,
            ema_expo: ema_price.expo,
            publish_time: price.publish_time,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum InjectiveMsg {
    RelayPythPrices {
        sender: Addr,
        price_attestations: Vec<InjectivePriceAttestation>,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct InjectiveMsgWrapper {
    pub route: String,
    pub msg_data: InjectiveMsg,
}

pub fn create_relay_pyth_prices_msg(
    sender: Addr,
    price_feeds: Vec<PriceFeed>,
) -> CosmosMsg<InjectiveMsgWrapper> {
    InjectiveMsgWrapper {
        route: "oracle".to_string(),
        msg_data: InjectiveMsg::RelayPythPrices {
            sender,
            price_attestations: price_feeds
                .iter()
                .map(InjectivePriceAttestation::from)
                .collect(),
        },
    }
    .into()
}

impl From<InjectiveMsgWrapper> for CosmosMsg<InjectiveMsgWrapper> {
    fn from(s: InjectiveMsgWrapper) -> CosmosMsg<InjectiveMsgWrapper> {
        CosmosMsg::Custom(s)
    }
}

impl CustomMsg for InjectiveMsgWrapper {}
