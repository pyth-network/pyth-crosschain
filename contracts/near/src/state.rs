use {
    near_sdk::{
        borsh::{
            self,
            BorshDeserialize,
            BorshSerialize,
        },
        serde::{
            Deserialize,
            Serialize,
        },
    },
    p2w_sdk::{
        Identifier,
        PriceAttestation,
        PriceStatus,
    },
};

/// The PriceFeed structure is stored in the contract under a Price Feed Identifier.
///
/// This structure matches the layout of the PriceFeed structure in other Pyth receiver contracts
/// but uses types that are native to NEAR.
#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PriceFeed {
    /// Unique identifier for this price.
    pub id:                 Identifier,
    /// Status of price (Trading is valid).
    pub status:             PriceStatus,
    /// Current price aggregation publish time
    pub publish_time:       i64,
    /// Price exponent.
    pub expo:               i32,
    /// Maximum number of allowed publishers that can contribute to a price.
    pub max_num_publishers: u32,
    /// Number of publishers that made up current aggregate.
    pub num_publishers:     u32,
    /// Product account key.
    pub product_id:         Identifier,
    /// The current aggregation price.
    price:                  i64,
    /// Confidence interval around the current aggregation price.
    conf:                   u64,
    /// Exponentially moving average price.
    ema_price:              i64,
    /// Exponentially moving average confidence interval.
    ema_conf:               u64,
    /// Price of previous aggregate with Trading status.
    prev_price:             i64,
    /// Confidence interval of previous aggregate with Trading status.
    prev_conf:              u64,
    /// Publish time of previous aggregate with Trading status.
    prev_publish_time:      u64,
}

impl From<&PriceAttestation> for PriceFeed {
    fn from(price_attestation: &PriceAttestation) -> Self {
        Self {
            id:                 price_attestation.price_id,
            status:             price_attestation.status,
            publish_time:       price_attestation.publish_time,
            expo:               price_attestation.expo,
            max_num_publishers: price_attestation.max_num_publishers,
            num_publishers:     price_attestation.num_publishers,
            product_id:         price_attestation.product_id,
            price:              price_attestation.price,
            conf:               price_attestation.conf,
            ema_price:          price_attestation.ema_price,
            ema_conf:           price_attestation.ema_conf,
            prev_price:         price_attestation.prev_price,
            prev_conf:          price_attestation.prev_conf,
            prev_publish_time:  price_attestation.prev_publish_time.try_into().unwrap(),
        }
    }
}

/// A `Source` describes an origin chain from which Pyth attestations are allowed.
///
/// This allows for example Pyth prices to be sent from either Pythnet or Solana, but can be used
/// to add any additional trusted source chains.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Clone,
    Default,
    Deserialize,
    Eq,
    Hash,
    PartialEq,
    PartialOrd,
    Serialize,
)]
#[serde(crate = "near_sdk::serde")]
pub struct Source {
    pub emitter:            [u8; 32],
    pub pyth_emitter_chain: u16,
}
