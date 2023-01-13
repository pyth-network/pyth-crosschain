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
    p2w_sdk::PriceAttestation,
    wormhole::Chain as WormholeChain,
};

/// Type alias for Wormhole's compact Signature format.
pub type WormholeSignature = [u8; 65];

/// Type alias for Wormhole's cross-chain 32-byte address.
pub type WormholeAddress = [u8; 32];

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
#[repr(transparent)]
pub struct PriceIdentifier(pub [u8; 32]);

/// A price with a degree of uncertainty, represented as a price +- a confidence interval.
///
/// The confidence interval roughly corresponds to the standard error of a normal distribution.
/// Both the price and confidence are stored in a fixed-point numeric representation,
/// `x * (10^expo)`, where `expo` is the exponent.
//
/// Please refer to the documentation at https://docs.pyth.network/consumers/best-practices for how
/// to how this price safely.
#[derive(BorshDeserialize, BorshSerialize, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct Price {
    pub price:     i64,
    /// Confidence interval around the price
    pub conf:      u64,
    /// The exponent
    pub expo:      i32,
    /// Unix timestamp of when this price was computed
    pub timestamp: u64,
}

/// The PriceFeed structure is stored in the contract under a Price Feed Identifier.
///
/// This structure matches the layout of the PriceFeed structure in other Pyth receiver contracts
/// but uses types that are native to NEAR.
#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PriceFeed {
    /// Unique identifier for this price.
    pub id:        PriceIdentifier,
    /// The current aggregation price.
    pub price:     Price,
    /// Exponentially moving average price.
    pub ema_price: Price,
}

impl From<&PriceAttestation> for PriceFeed {
    fn from(price_attestation: &PriceAttestation) -> Self {
        Self {
            id:        PriceIdentifier(price_attestation.price_id.to_bytes()),
            price:     Price {
                price:     price_attestation.price,
                conf:      price_attestation.conf,
                expo:      price_attestation.expo,
                timestamp: price_attestation.publish_time.try_into().unwrap(),
            },
            ema_price: Price {
                price:     price_attestation.ema_price,
                conf:      price_attestation.ema_conf,
                expo:      price_attestation.expo,
                timestamp: price_attestation.publish_time.try_into().unwrap(),
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
)]
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
)]
#[serde(crate = "near_sdk::serde")]
pub struct Source {
    pub emitter: WormholeAddress,
    pub chain:   Chain,
}

/// A local `Vaa` type converted to from the Wormhole definition, this helps catch any upstream
/// changes to the Wormhole VAA format.
pub struct Vaa<P> {
    pub version:            u8,
    pub guardian_set_index: u32,
    pub signatures:         Vec<WormholeSignature>,
    pub timestamp:          u32, // Seconds since UNIX epoch
    pub nonce:              u32,
    pub emitter_chain:      Chain,
    pub emitter_address:    WormholeAddress,
    pub sequence:           u64,
    pub consistency_level:  u8,
    pub payload:            P,
}

impl<P> From<wormhole::Vaa<P>> for Vaa<P> {
    fn from(vaa: wormhole::Vaa<P>) -> Self {
        Self {
            version:            vaa.version,
            guardian_set_index: vaa.guardian_set_index,
            signatures:         vaa.signatures.iter().map(|s| s.signature).collect(),
            timestamp:          vaa.timestamp,
            nonce:              vaa.nonce,
            emitter_chain:      vaa.emitter_chain.into(),
            emitter_address:    vaa.emitter_address.0,
            sequence:           vaa.sequence,
            consistency_level:  vaa.consistency_level,
            payload:            vaa.payload,
        }
    }
}
