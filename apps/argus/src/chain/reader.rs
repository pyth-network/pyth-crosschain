use {
    anyhow::Result,
    axum::async_trait,
    ethers::types::{Address, U256},
};

pub type BlockNumber = u64;

#[derive(Clone)]
pub struct RequestedWithCallbackEvent {
    pub sequence_number: u64,
    pub requester: Address,
    pub price_ids: Vec<[u8; 32]>,
    pub callback_gas_limit: U256,
}

/// PulseReader is the read-only interface of the Pulse contract.
#[async_trait]
pub trait PulseReader: Send + Sync {
    /// Get an in-flight request (if it exists)
    async fn get_request(&self, sequence_number: u64) -> Result<Option<Request>>;

    /// Get the latest block number
    async fn get_block_number(&self) -> Result<BlockNumber>;

    async fn get_price_update_requested_events(
        &self,
        from_block: BlockNumber,
        to_block: BlockNumber,
    ) -> Result<Vec<RequestedWithCallbackEvent>>;

    /// Alias for get_price_update_requested_events to maintain compatibility with existing code
    async fn get_request_with_callback_events(
        &self,
        from_block: BlockNumber,
        to_block: BlockNumber,
    ) -> Result<Vec<RequestedWithCallbackEvent>> {
        self.get_price_update_requested_events(from_block, to_block)
            .await
    }

    /// Get active requests directly from contract storage
    /// This is more efficient than searching for events in the backlog
    async fn get_active_requests(&self, count: usize) -> Result<Vec<Request>>;

    /// Estimate the gas required to execute a callback for price updates.
    async fn estimate_execute_callback_gas(
        &self,
        sender: Address,
        sequence_number: u64,
        update_data: Vec<Vec<u8>>,
        price_ids: Vec<[u8; 32]>,
    ) -> Result<U256>;
}

/// An in-flight request stored in the contract.
/// (This struct is missing many fields that are defined in the contract, as they
/// aren't used in argus anywhere. Feel free to add any missing fields as necessary.)
#[derive(Clone, Debug)]
pub struct Request {
    pub requester: Address,
    pub sequence_number: u64,
    pub callback_gas_limit: U256,
    pub price_ids: Vec<[u8; 32]>,
    pub publish_time: U256,
    pub num_price_ids: u8,
}

#[cfg(test)]
pub mod mock {
    use {
        crate::chain::reader::{BlockNumber, PulseReader, Request, RequestedWithCallbackEvent},
        anyhow::Result,
        axum::async_trait,
        ethers::types::{Address, U256},
        std::sync::RwLock,
    };

    /// Mock version of the pulse contract intended for testing.
    /// This class is internally locked to allow tests to modify the in-flight requests while
    /// the API is also holding a pointer to the same data structure.
    pub struct MockPulseReader {
        block_number: RwLock<BlockNumber>,
        /// The set of requests that are currently in-flight.
        requests: RwLock<Vec<Request>>,
    }

    impl MockPulseReader {
        pub fn with_requests(
            block_number: BlockNumber,
            requests: &[(Address, u64, BlockNumber, U256, Vec<[u8; 32]>, U256)],
        ) -> MockPulseReader {
            MockPulseReader {
                block_number: RwLock::new(block_number),
                requests: RwLock::new(
                    requests
                        .iter()
                        .map(|&(a, s, _, c, ref p, t)| Request {
                            requester: a,
                            sequence_number: s,
                            callback_gas_limit: c,
                            price_ids: p.clone(),
                            publish_time: t,
                            num_price_ids: p.len().min(255) as u8,
                        })
                        .collect(),
                ),
            }
        }

        /// Insert a new request into the set of in-flight requests.
        pub fn insert(
            &self,
            requester: Address,
            sequence: u64,
            callback_gas_limit: U256,
            price_ids: Vec<[u8; 32]>,
            publish_time: U256,
        ) -> &Self {
            self.requests.write().unwrap().push(Request {
                requester,
                sequence_number: sequence,
                callback_gas_limit,
                price_ids: price_ids.clone(),
                publish_time,
                num_price_ids: price_ids.len().min(255) as u8,
            });
            self
        }

        pub fn set_block_number(&self, block_number: BlockNumber) -> &Self {
            *(self.block_number.write().unwrap()) = block_number;
            self
        }
    }

    #[async_trait]
    impl PulseReader for MockPulseReader {
        async fn get_request(&self, sequence_number: u64) -> Result<Option<Request>> {
            let requests = self.requests.read().unwrap();
            Ok(requests
                .iter()
                .find(|r| r.sequence_number == sequence_number)
                .cloned())
        }

        async fn get_block_number(&self) -> Result<BlockNumber> {
            Ok(*self.block_number.read().unwrap())
        }

        async fn get_active_requests(&self, count: usize) -> Result<Vec<Request>> {
            let requests = self.requests.read().unwrap();
            Ok(requests.iter().take(count).cloned().collect())
        }

        async fn get_price_update_requested_events(
            &self,
            _from_block: BlockNumber,
            _to_block: BlockNumber,
        ) -> Result<Vec<RequestedWithCallbackEvent>> {
            Ok(vec![])
        }

        async fn estimate_execute_callback_gas(
            &self,
            _sender: Address,
            _sequence_number: u64,
            _update_data: Vec<Vec<u8>>,
            _price_ids: Vec<[u8; 32]>,
        ) -> Result<U256> {
            Ok(U256::from(5))
        }
    }
}
