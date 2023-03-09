use {
    cosmwasm_std::{
        Addr,
        CosmosMsg,
    },
    pyth_wormhole_attester_sdk::{
        PriceAttestation,
        PriceStatus,
    },
    serde::{
        Deserialize,
        Serialize,
    },
    serde_repr::*,
};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct InjectivePriceAttestation {
    pub product_id:         String,
    pub price_id:           String,
    pub price:              i64,
    pub conf:               u64,
    pub expo:               i32,
    pub ema_price:          i64,
    pub ema_conf:           u64,
    pub status:             PriceStatus,
    pub num_publishers:     u32,
    pub max_num_publishers: u32,
    pub attestation_time:   i64,
    pub publish_time:       i64,
}

impl From<&PriceAttestation> for InjectivePriceAttestation {
    fn from(pa: &PriceAttestation) -> Self {
        InjectivePriceAttestation {
            product_id:         pa.product_id.to_hex(),
            price_id:           pa.price_id.to_hex(),
            price:              pa.price,
            conf:               pa.conf,
            expo:               pa.expo,
            ema_price:          pa.ema_price,
            ema_conf:           pa.ema_conf,
            status:             pa.status,
            num_publishers:     pa.num_publishers,
            max_num_publishers: pa.max_num_publishers,
            attestation_time:   pa.attestation_time,
            publish_time:       pa.publish_time,
        }
    }
}


#[derive(Serialize_repr, Deserialize_repr, Clone, Debug, PartialEq, Eq, Copy)]
#[repr(i32)]
pub enum PythStatus {
    Unknown = 0,
    Trading = 1,
    Halted  = 2,
    Auction = 3,
}

impl From<PriceStatus> for PythStatus {
    fn from(ps: PriceStatus) -> Self {
        match ps {
            PriceStatus::Unknown => PythStatus::Unknown,
            PriceStatus::Trading => PythStatus::Trading,
            PriceStatus::Halted => PythStatus::Halted,
            PriceStatus::Auction => PythStatus::Auction,
        }
    }
}


#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InjectiveMsg {
    RelayPythPrices {
        sender:             Addr,
        price_attestations: Vec<InjectivePriceAttestation>,
    },
}


// #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
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
