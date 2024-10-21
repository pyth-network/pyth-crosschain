use alloy::primitives::{Bytes, U256};
use alloy::rpc::types::Filter;
use alloy::rpc::types::Log;
use eyre::Result;

use crate::types::UnixTimestamp;

#[derive(Debug)]
pub struct PriceUpdate {
    pub publish_time: UnixTimestamp,
    pub price_ids: Vec<[u8; 32]>,
    pub client_context: Bytes,
}

impl PriceUpdate {
    pub fn filter() -> Filter {
        Filter::new().event(&Self::event_signature_str())
    }

    pub fn decode_log(log: &Log) -> Result<Self> {
        let data = log.data().data.as_ref();

        // Assuming the event structure: PriceUpdate(int64 publish_time, bytes32[] price_ids, bytes client_context)
        let publish_time = UnixTimestamp::from_be_bytes(data[24..32].try_into()?);
        println!("publish_time: {:?}", publish_time);
        let price_ids_offset = U256::from_be_bytes::<32>(data[32..64].try_into()?).to::<usize>();
        let client_context_offset =
            U256::from_be_bytes::<32>(data[64..96].try_into()?).to::<usize>();

        let price_ids_length =
            U256::from_be_bytes::<32>(data[price_ids_offset..price_ids_offset + 32].try_into()?)
                .to::<usize>();
        let price_ids: Vec<[u8; 32]> = (0..price_ids_length)
            .map(|i| {
                let start = price_ids_offset + 32 + i * 32;
                data[start..start + 32].try_into().unwrap()
            })
            .collect();

        let client_context_length = U256::from_be_bytes::<32>(
            data[client_context_offset..client_context_offset + 32].try_into()?,
        )
        .to::<usize>();
        let client_context = Bytes::copy_from_slice(
            &data[client_context_offset + 32..client_context_offset + 32 + client_context_length],
        );

        Ok(Self {
            publish_time,
            price_ids,
            client_context,
        })
    }

    fn event_signature_str() -> &'static str {
        "PriceUpdate(int64,bytes32[],bytes)"
    }
}
