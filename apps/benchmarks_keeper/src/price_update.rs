use alloy::primitives::{Address, Bytes, U256};
use alloy::rpc::types::Filter;
use alloy::rpc::types::Log;
use eyre::Result;

#[derive(Debug)]
pub struct PriceUpdate {
    pub publish_time: U256,
    pub price_ids: Vec<[u8; 32]>,
    pub metadata: Bytes,
}

impl PriceUpdate {
    pub fn filter() -> Filter {
        Filter::new()
            .event(&Self::event_signature_str())
            .address(Address::ZERO) // TODO: Replace with the actual contract address
    }

    pub fn decode_log(log: &Log) -> Result<Self> {
        let data = log.data().data.as_ref();

        // Assuming the event structure: PriceUpdate(uint256 publish_time, bytes32[] price_ids, bytes metadata)
        let publish_time = U256::from_be_bytes::<32>(data[0..32].try_into()?);
        let price_ids_offset = U256::from_be_bytes::<32>(data[32..64].try_into()?).to::<usize>();
        let metadata_offset = U256::from_be_bytes::<32>(data[64..96].try_into()?).to::<usize>();

        let price_ids_length =
            U256::from_be_bytes::<32>(data[price_ids_offset..price_ids_offset + 32].try_into()?)
                .to::<usize>();
        let price_ids: Vec<[u8; 32]> = (0..price_ids_length)
            .map(|i| {
                let start = price_ids_offset + 32 + i * 32;
                data[start..start + 32].try_into().unwrap()
            })
            .collect();

        let metadata_length =
            U256::from_be_bytes::<32>(data[metadata_offset..metadata_offset + 32].try_into()?)
                .to::<usize>();
        let metadata = Bytes::copy_from_slice(
            &data[metadata_offset + 32..metadata_offset + 32 + metadata_length],
        );

        Ok(Self {
            publish_time,
            price_ids,
            metadata,
        })
    }

    fn event_signature_str() -> &'static str {
        "PriceUpdate(uint256,bytes32[],bytes)"
    }
}
