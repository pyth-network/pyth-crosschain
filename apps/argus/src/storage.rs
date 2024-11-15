use {
    crate::types::PriceUpdateRequest,
    alloy::{
        primitives::{Address, U256},
        providers::Provider,
    },
    anyhow::Result,
    prometheus_client::{
        metrics::{counter::Counter, family::Family},
        registry::Registry,
    },
    sha3::{Digest, Keccak256},
    std::{sync::Arc, time::Duration},
    tokio::{sync::mpsc, time},
};

const NUM_REQUESTS: u8 = 32;
const NUM_REQUESTS_MASK: u8 = 0x1f;

#[derive(Clone, Debug)]
pub struct StorageMetrics {
    pub requests_found: Counter,
    pub polling_errors: Counter,
}

pub struct StoragePoller {
    provider: Arc<Provider>,
    contract_addr: Address,
    poll_interval: Duration,
    request_tx: mpsc::Sender<PriceUpdateRequest>,
    metrics: Arc<StorageMetrics>,
}

impl StoragePoller {
    pub async fn new(
        provider: Arc<Provider>,
        contract_addr: Address,
        poll_interval: Duration,
        request_tx: mpsc::Sender<PriceUpdateRequest>,
        metrics: Arc<StorageMetrics>,
    ) -> Result<Self> {
        Ok(Self {
            provider,
            contract_addr,
            poll_interval,
            request_tx,
            metrics,
        })
    }

    pub async fn start_polling(&self) -> Result<()> {
        loop {
            match self.poll_requests().await {
                Ok(requests) => {
                    for request in requests {
                        if let Err(e) = self.request_tx.send(request).await {
                            tracing::error!("Failed to send request to keeper: {}", e);
                            self.metrics.polling_errors.inc();
                        } else {
                            self.metrics.requests_found.inc();
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Error polling requests: {}", e);
                    self.metrics.polling_errors.inc();
                }
            }

            time::sleep(self.poll_interval).await;
        }
    }

    async fn poll_requests(&self) -> Result<Vec<PriceUpdateRequest>> {
        let mut requests = Vec::new();

        // The Pulse contract has a fixed array of 32 requests and an overflow mapping
        // First read the fixed array (slot 2 in the contract)
        for i in 0..NUM_REQUESTS {
            let slot = self.calculate_request_slot(i);
            let request = self.read_request_at_slot(slot).await?;

            // sequence_number == 0 means empty/inactive request
            if request.sequence_number.as_u64() != 0 {
                requests.push(request);
            }
        }

        // TODO: Read overflow mapping if needed
        // The overflow mapping is used when there's a hash collision in the fixed array
        // We'll need to read slot keccak256(key, OVERFLOW_SLOT) where key is keccak256(provider, sequence)

        Ok(requests)
    }

    fn calculate_request_slot(&self, index: u8) -> U256 {
        // In the Pulse contract, the requests array is at slot 2
        // For arrays, Solidity stores data at: keccak256(slot) + index
        const REQUESTS_SLOT: u8 = 2;

        // Calculate base slot for requests array
        let base_slot = U256::from(REQUESTS_SLOT);

        // Calculate actual slot: keccak256(slot) + index
        let array_slot = keccak256(&base_slot.to_be_bytes::<32>());
        U256::from_be_bytes(array_slot) + U256::from(index)
    }

    async fn read_request_at_slot(&self, slot: U256) -> Result<PriceUpdateRequest> {
        // Each Request struct takes multiple slots:
        // slot + 0: provider (address) and sequence_number (uint64) packed together
        // slot + 1: publish_time (uint256)
        // slot + 2: priceIds array length
        // slot + 3: callback_gas_limit (uint256)
        // slot + 4: requester (address)
        // priceIds array is stored starting at keccak256(slot + 2)

        let slot_0 = self.provider.get_storage_at(self.contract_addr, slot).await?;
        let slot_1 = self.provider.get_storage_at(self.contract_addr, slot + 1).await?;
        let slot_2 = self.provider.get_storage_at(self.contract_addr, slot + 2).await?;
        let slot_3 = self.provider.get_storage_at(self.contract_addr, slot + 3).await?;
        let slot_4 = self.provider.get_storage_at(self.contract_addr, slot + 4).await?;

        // Parse provider (20 bytes) and sequence_number (8 bytes) from slot_0
        let provider = Address::from_slice(&slot_0[0..20]);
        let sequence_number = U64::from_be_bytes(slot_0[20..28].try_into()?);

        // Parse publish_time
        let publish_time = U256::from_be_bytes(slot_1);

        // Parse price IDs array
        let price_ids_length = U256::from_be_bytes(slot_2).as_usize();
        let mut price_ids = Vec::with_capacity(price_ids_length);

        if price_ids_length > 0 {
            let price_ids_slot = keccak256(&(slot + 2).to_be_bytes::<32>());
            for i in 0..price_ids_length {
                let price_id_slot = U256::from_be_bytes(price_ids_slot) + U256::from(i);
                let price_id_data = self.provider.get_storage_at(self.contract_addr, price_id_slot).await?;
                price_ids.push(price_id_data.try_into()?);
            }
        }

        // Parse callback gas limit and requester
        let callback_gas_limit = U256::from_be_bytes(slot_3);
        let requester = Address::from_slice(&slot_4[0..20]);

        Ok(PriceUpdateRequest {
            provider,
            sequence_number,
            publish_time,
            price_ids,
            callback_gas_limit,
            requester,
        })
    }
}

// Helper function to calculate keccak256 hash
fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().into()
}
