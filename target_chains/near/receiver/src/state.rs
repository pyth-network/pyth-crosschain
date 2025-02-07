use {
    near_sdk::{
        borsh::{BorshDeserialize, BorshSerialize},
        json_types::{I64, U64},
        serde::{Deserialize, Serialize},
    },
    pythnet_sdk::legacy::PriceAttestation,
    pythnet_sdk::messages::PriceFeedMessage,
    schemars::{gen::SchemaGenerator, schema::Schema, JsonSchema},
    wormhole_sdk::Chain as WormholeChain,
};

/// Type alias for Wormhole's compact Signature format.
pub type WormholeSignature = [u8; 65];

/// Type alias for Wormhole's cross-chain 32-byte address.
pub type WormholeAddress = [u8; 32];

#[derive(BorshDeserialize, BorshSerialize, PartialEq, Eq, Hash)]
#[borsh(crate = "near_sdk::borsh")]
#[repr(transparent)]
pub struct PriceIdentifier(pub [u8; 32]);

impl<'de> near_sdk::serde::Deserialize<'de> for PriceIdentifier {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: near_sdk::serde::Deserializer<'de>,
    {
        /// A visitor that deserializes a hex string into a 32 byte array.
        struct IdentifierVisitor;

        impl<'de> near_sdk::serde::de::Visitor<'de> for IdentifierVisitor {
            /// Target type for either a hex string or a 32 byte array.
            type Value = [u8; 32];

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a hex string")
            }

            // When given a string, attempt a standard hex decode.
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: near_sdk::serde::de::Error,
            {
                if value.len() != 64 {
                    return Err(E::custom(format!(
                        "expected a 64 character hex string, got {}",
                        value.len()
                    )));
                }
                let mut bytes = [0u8; 32];
                hex::decode_to_slice(value, &mut bytes).map_err(E::custom)?;
                Ok(bytes)
            }
        }

        deserializer
            .deserialize_any(IdentifierVisitor)
            .map(PriceIdentifier)
    }
}

impl near_sdk::serde::Serialize for PriceIdentifier {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: near_sdk::serde::Serializer,
    {
        serializer.serialize_str(&hex::encode(&self.0))
    }
}

impl JsonSchema for PriceIdentifier {
    fn is_referenceable() -> bool {
        false
    }

    fn schema_name() -> String {
        String::schema_name()
    }

    fn json_schema(gen: &mut SchemaGenerator) -> Schema {
        String::json_schema(gen)
    }
}

/// A price with a degree of uncertainty, represented as a price +- a confidence interval.
///
/// The confidence interval roughly corresponds to the standard error of a normal distribution.
/// Both the price and confidence are stored in a fixed-point numeric representation,
/// `x * (10^expo)`, where `expo` is the exponent.
//
/// Please refer to the documentation at https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices for how
/// to how this price safely.
#[derive(BorshDeserialize, BorshSerialize, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
// I64 and U64 only implement JsonSchema when "abi" feature is enabled in near_sdk,
// but unconditionally enabling this feature doesn't work, so we have to make this impl
// conditional.
#[cfg_attr(abi, derive(JsonSchema))]
pub struct Price {
    pub price: I64,
    /// Confidence interval around the price
    pub conf: U64,
    /// The exponent
    pub expo: i32,
    /// Unix timestamp of when this price was computed
    pub publish_time: i64,
}

/// The PriceFeed structure is stored in the contract under a Price Feed Identifier.
///
/// This structure matches the layout of the PriceFeed structure in other Pyth receiver contracts
/// but uses types that are native to NEAR.
#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct PriceFeed {
    /// Unique identifier for this price.
    pub id: PriceIdentifier,
    /// The current aggregation price.
    pub price: Price,
    /// Exponentially moving average price.
    pub ema_price: Price,
}

impl From<&PriceAttestation> for PriceFeed {
    fn from(price_attestation: &PriceAttestation) -> Self {
        Self {
            id: PriceIdentifier(price_attestation.price_id.to_bytes()),
            price: Price {
                price: price_attestation.price.into(),
                conf: price_attestation.conf.into(),
                expo: price_attestation.expo,
                publish_time: price_attestation.publish_time,
            },
            ema_price: Price {
                price: price_attestation.ema_price.into(),
                conf: price_attestation.ema_conf.into(),
                expo: price_attestation.expo,
                publish_time: price_attestation.publish_time,
            },
        }
    }
}

impl From<&PriceFeedMessage> for PriceFeed {
    fn from(price_feed_message: &PriceFeedMessage) -> Self {
        Self {
            id: PriceIdentifier(price_feed_message.feed_id),
            price: Price {
                price: price_feed_message.price.into(),
                conf: price_feed_message.conf.into(),
                expo: price_feed_message.exponent,
                publish_time: price_feed_message.publish_time,
            },
            ema_price: Price {
                price: price_feed_message.ema_price.into(),
                conf: price_feed_message.ema_conf.into(),
                expo: price_feed_message.exponent,
                publish_time: price_feed_message.publish_time,
            },
        }
    }
}

/// A wrapper around a 16bit chain identifier. We can't use Chain from the Wormhole SDK as it does
/// not provide borsh serialization but we can re-wrap it here relying on the validation from
/// `wormhole::Chain`.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Clone,
    Copy,
    Debug,
    Default,
    Deserialize,
    Eq,
    Hash,
    PartialEq,
    PartialOrd,
    Serialize,
    JsonSchema,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
#[repr(transparent)]
pub struct Chain(u16);

/// Converts from a WormholeChain, rather than a u16. This lets us rely on Wormhole's SDK to
/// validate the chain identifier.
impl From<WormholeChain> for Chain {
    fn from(chain: WormholeChain) -> Self {
        Self(u16::from(chain))
    }
}

impl From<Chain> for u16 {
    fn from(chain: Chain) -> Self {
        chain.0
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
    Debug,
    Default,
    Deserialize,
    Eq,
    Hash,
    PartialEq,
    PartialOrd,
    Serialize,
    JsonSchema,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct Source {
    pub emitter: WormholeAddress,
    pub chain: Chain,
}

/// A local `Vaa` type converted to from the Wormhole definition, this helps catch any upstream
/// changes to the Wormhole VAA format.
pub struct Vaa<P> {
    pub version: u8,
    pub guardian_set_index: u32,
    pub signatures: Vec<WormholeSignature>,
    pub timestamp: u32, // Seconds since UNIX epoch
    pub nonce: u32,
    pub emitter_chain: Chain,
    pub emitter_address: WormholeAddress,
    pub sequence: u64,
    pub consistency_level: u8,
    pub payload: P,
}

impl<P> From<wormhole_sdk::Vaa<P>> for Vaa<P> {
    fn from(vaa: wormhole_sdk::Vaa<P>) -> Self {
        Self {
            version: vaa.version,
            guardian_set_index: vaa.guardian_set_index,
            signatures: vaa.signatures.iter().map(|s| s.signature).collect(),
            timestamp: vaa.timestamp,
            nonce: vaa.nonce,
            emitter_chain: vaa.emitter_chain.into(),
            emitter_address: vaa.emitter_address.0,
            sequence: vaa.sequence,
            consistency_level: vaa.consistency_level,
            payload: vaa.payload,
        }
    }
}
