use {
    crate::{
        impl_deserialize_for_hex_string_wrapper,
        store::{
            proof::batch_vaa::PriceInfo,
            UnixTimestamp,
        },
    },
    base64::{
        engine::general_purpose::STANDARD as base64_standard_engine,
        Engine as _,
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
    pub attestation_time:           UnixTimestamp,
    pub sequence_number:            u64,
    pub price_service_receive_time: UnixTimestamp,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RpcPriceFeed {
    pub id:        PriceIdentifier,
    pub price:     Price,
    pub ema_price: Price,
    pub metadata:  Option<RpcPriceFeedMetadata>,
    /// Vaa binary represented in base64.
    pub vaa:       Option<Base64String>,
}

impl RpcPriceFeed {
    // TODO: Use a Encoding type to have None, Base64, and Hex variants instead of binary flag.
    // TODO: Use a Verbosity type to define None, or Full instead of verbose flag.
    pub fn from_price_info(price_info: PriceInfo, verbose: bool, binary: bool) -> Self {
        Self {
            id:        price_info.price_feed.id,
            price:     price_info.price_feed.get_price_unchecked(),
            ema_price: price_info.price_feed.get_ema_price_unchecked(),
            metadata:  verbose.then_some(RpcPriceFeedMetadata {
                emitter_chain:              price_info.emitter_chain,
                attestation_time:           price_info.attestation_time,
                sequence_number:            price_info.sequence_number,
                price_service_receive_time: price_info.receive_time,
            }),
            vaa:       binary.then_some(base64_standard_engine.encode(price_info.vaa_bytes)),
        }
    }
}
