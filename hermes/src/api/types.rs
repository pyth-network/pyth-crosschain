use {
    crate::{
        impl_deserialize_for_hex_string_wrapper,
        store::types::{
            PriceFeedMessage,
            UnixTimestamp,
        },
    },
    derive_more::{
        Deref,
        DerefMut,
    },
    pyth_sdk::{
        Price,
        PriceIdentifier,
    },
};


/// PriceIdInput is a wrapper around a 32-byte hex string.
/// that supports a flexible deserialization from a hex string.
/// It supports both 0x-prefixed and non-prefixed hex strings,
/// and also supports both lower and upper case characters.
#[derive(Debug, Clone, Deref, DerefMut)]
pub struct PriceIdInput([u8; 32]);
// TODO: Use const generics instead of macro.
impl_deserialize_for_hex_string_wrapper!(PriceIdInput, 32);

impl From<PriceIdInput> for PriceIdentifier {
    fn from(id: PriceIdInput) -> Self {
        Self::new(*id)
    }
}

type Base64String = String;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RpcPriceFeedMetadata {
    pub emitter_chain:              u16,
    pub sequence_number:            u64,
    pub price_service_receive_time: UnixTimestamp,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RpcPriceFeed {
    pub id:        PriceIdentifier,
    pub price:     Price,
    pub ema_price: Price,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata:  Option<RpcPriceFeedMetadata>,
    /// Vaa binary represented in base64.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vaa:       Option<Base64String>,
}

impl RpcPriceFeed {
    // TODO: Use a Encoding type to have None, Base64, and Hex variants instead of binary flag.
    // TODO: Use a Verbosity type to define None, or Full instead of verbose flag.
    pub fn from_price_feed_message(
        price_feed_message: PriceFeedMessage,
        _verbose: bool,
        _binary: bool,
    ) -> Self {
        Self {
            id:        PriceIdentifier::new(price_feed_message.id),
            price:     Price {
                price:        price_feed_message.price,
                conf:         price_feed_message.conf,
                expo:         price_feed_message.exponent,
                publish_time: price_feed_message.publish_time,
            },
            ema_price: Price {
                price:        price_feed_message.ema_price,
                conf:         price_feed_message.ema_conf,
                expo:         price_feed_message.exponent,
                publish_time: price_feed_message.publish_time,
            },
            // FIXME: Handle verbose flag properly.
            // metadata:  verbose.then_some(RpcPriceFeedMetadata {
            //     emitter_chain:              price_feed_message.emitter_chain,
            //     sequence_number:            price_feed_message.sequence_number,
            //     price_service_receive_time: price_feed_message.receive_time,
            // }),
            metadata:  None,
            // FIXME: The vaa is wrong, fix it
            // vaa:       binary.then_some(base64_standard_engine.encode(message_state.proof_set.wormhole_merkle_proof.vaa)),
            vaa:       None,
        }
    }
}
