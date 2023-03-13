use {
    cosmwasm_std::{
        Addr,
        CosmosMsg,
        CustomMsg,
    },
    pyth_wormhole_attester_sdk::PriceAttestation,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct InjectivePriceAttestation {
    pub price_id:     String,
    pub price:        i64,
    pub conf:         u64,
    pub expo:         i32,
    pub ema_price:    i64,
    pub ema_conf:     u64,
    pub ema_expo:     i32,
    pub publish_time: i64,
}

impl From<&PriceAttestation> for InjectivePriceAttestation {
    fn from(pa: &PriceAttestation) -> Self {
        InjectivePriceAttestation {
            price_id:     pa.price_id.to_hex(),
            price:        pa.price,
            conf:         pa.conf,
            expo:         pa.expo,
            ema_price:    pa.ema_price,
            ema_conf:     pa.ema_conf,
            ema_expo:     pa.expo,
            publish_time: pa.publish_time,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum InjectiveMsg {
    RelayPythPrices {
        sender:             Addr,
        price_attestations: Vec<InjectivePriceAttestation>,
    },
}


#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct InjectiveMsgWrapper {
    pub route:    String,
    pub msg_data: InjectiveMsg,
}

pub fn create_relay_pyth_prices_msg(
    sender: Addr,
    price_attestations: Vec<PriceAttestation>,
) -> CosmosMsg<InjectiveMsgWrapper> {
    InjectiveMsgWrapper {
        route:    "oracle".to_string(),
        msg_data: InjectiveMsg::RelayPythPrices {
            sender,
            price_attestations: price_attestations
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

impl CustomMsg for InjectiveMsgWrapper {
}
