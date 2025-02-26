use {
    anyhow::Result,
    axum::async_trait,
    ethers::types::{Address, BlockNumber as EthersBlockNumber, U256},
};

pub type BlockNumber = u64;

#[derive(
    Copy, Clone, Debug, Default, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize,
)]
pub enum BlockStatus {
    /// Latest block
    #[default]
    Latest,
    /// Finalized block accepted as canonical
    Finalized,
    /// Safe head block
    Safe,
}

impl From<BlockStatus> for EthersBlockNumber {
    fn from(val: BlockStatus) -> Self {
        match val {
            BlockStatus::Latest => EthersBlockNumber::Latest,
            BlockStatus::Finalized => EthersBlockNumber::Finalized,
            BlockStatus::Safe => EthersBlockNumber::Safe,
        }
    }
}

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

    async fn get_block_number(&self, confirmed_block_status: BlockStatus) -> Result<BlockNumber>;

    async fn get_price_update_requested_events(
        &self,
        from_block: BlockNumber,
        to_block: BlockNumber,
    ) -> Result<Vec<RequestedWithCallbackEvent>>;

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
}

#[cfg(test)]
pub mod mock {
    use {
        crate::chain::reader::{
            BlockNumber, BlockStatus, PulseReader, Request, RequestedWithCallbackEvent,
        },
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
                        .map(|&(a, s, b, c, ref p, t)| Request {
                            requester: a,
                            sequence_number: s,
                            block_number: b,
                            callback_gas_limit: c,
                            price_ids: p.clone(),
                            publish_time: t,
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
            block_number: BlockNumber,
            callback_gas_limit: U256,
            price_ids: Vec<[u8; 32]>,
            publish_time: U256,
        ) -> &Self {
            self.requests.write().unwrap().push(Request {
                requester,
                sequence_number: sequence,
                block_number,
                callback_gas_limit,
                price_ids,
                publish_time,
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
            Ok(self
                .requests
                .read()
                .unwrap()
                .iter()
                .find(|&r| r.sequence_number == sequence_number)
                .map(|r| (*r).clone()))
        }

        async fn get_block_number(
            &self,
            _confirmed_block_status: BlockStatus,
        ) -> Result<BlockNumber> {
            Ok(*self.block_number.read().unwrap())
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
