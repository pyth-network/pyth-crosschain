use {
    anyhow::Result,
    axum::async_trait,
    ethers::{
        prelude::LogMeta,
        types::{Address, BlockNumber as EthersBlockNumber, U256},
    },
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

#[derive(Clone, Debug, PartialEq)]
pub struct EntropyRequestInfo {
    pub provider: Address,
    pub sequence_number: u64,
    pub num_hashes: u32,
    pub commitment: [u8; 32],
    pub block_number: u64,
    pub requester: Address,
    pub use_blockhash: bool,
    pub is_request_with_callback: bool,
}

#[derive(Clone)]
pub struct RequestedV2Event {
    pub sequence_number: u64,
    pub user_random_number: [u8; 32],
    pub provider_address: Address,
    pub sender: Address,
    pub gas_limit: u32,
    pub log_meta: LogMeta,
}

/// EntropyReader is the read-only interface of the Entropy contract.
#[async_trait]
pub trait EntropyReader: Send + Sync {
    /// Get an in-flight request (if it exists)
    /// Note that if we support additional blockchains in the future, the type of `provider` may
    /// need to become more generic.
    async fn get_request_v2(
        &self,
        provider: Address,
        sequence_number: u64,
    ) -> Result<Option<Request>>;

    async fn get_block_number(&self, confirmed_block_status: BlockStatus) -> Result<BlockNumber>;

    async fn get_request_with_callback_events(
        &self,
        from_block: BlockNumber,
        to_block: BlockNumber,
        provider: Address,
    ) -> Result<Vec<RequestedV2Event>>;

    /// Estimate the gas required to reveal a random number with a callback.
    async fn estimate_reveal_with_callback_gas(
        &self,
        sender: Address,
        provider: Address,
        sequence_number: u64,
        user_random_number: [u8; 32],
        provider_revelation: [u8; 32],
    ) -> Result<U256>;
}

/// An in-flight request stored in the contract.
/// (This struct is missing many fields that are defined in the contract, as they
/// aren't used in fortuna anywhere. Feel free to add any missing fields as necessary.)
#[derive(Clone, Debug)]
pub struct Request {
    pub provider: Address,
    pub sequence_number: u64,
    // The block number where this request was created
    pub block_number: BlockNumber,
    pub use_blockhash: bool,
    pub callback_status: RequestCallbackStatus,
    /// The gas limit for the request, in 10k gas units. (i.e., 2 = 20k gas).
    pub gas_limit_10k: u16,
}

/// Status values for Request.callback_status
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RequestCallbackStatus {
    /// Not a request with callback
    CallbackNotNecessary = 0,
    /// A request with callback where the callback hasn't been invoked yet
    CallbackNotStarted = 1,
    /// A request with callback where the callback is currently in flight (this state is a reentry guard)
    CallbackInProgress = 2,
    /// A request with callback where the callback has been invoked and failed
    CallbackFailed = 3,
}

impl TryFrom<u8> for RequestCallbackStatus {
    type Error = anyhow::Error;

    fn try_from(value: u8) -> Result<Self> {
        match value {
            0 => Ok(RequestCallbackStatus::CallbackNotNecessary),
            1 => Ok(RequestCallbackStatus::CallbackNotStarted),
            2 => Ok(RequestCallbackStatus::CallbackInProgress),
            3 => Ok(RequestCallbackStatus::CallbackFailed),
            _ => Err(anyhow::anyhow!("Invalid callback status value: {}", value)),
        }
    }
}

impl From<RequestCallbackStatus> for u8 {
    fn from(status: RequestCallbackStatus) -> Self {
        status as u8
    }
}

#[cfg(test)]
pub mod mock {
    use {
        crate::chain::reader::{
            BlockNumber, BlockStatus, EntropyReader, Request, RequestCallbackStatus,
        },
        anyhow::Result,
        axum::async_trait,
        ethers::types::{Address, U256},
        std::sync::RwLock,
    };

    /// Mock version of the entropy contract intended for testing.
    /// This class is internally locked to allow tests to modify the in-flight requests while
    /// the API is also holding a pointer to the same data structure.
    pub struct MockEntropyReader {
        block_number: RwLock<BlockNumber>,
        /// The set of requests that are currently in-flight.
        requests: RwLock<Vec<Request>>,
    }

    impl MockEntropyReader {
        pub fn with_requests(
            block_number: BlockNumber,
            requests: &[(Address, u64, BlockNumber, bool)],
        ) -> MockEntropyReader {
            MockEntropyReader {
                block_number: RwLock::new(block_number),
                requests: RwLock::new(
                    requests
                        .iter()
                        .map(|&(a, s, b, u)| Request {
                            provider: a,
                            sequence_number: s,
                            block_number: b,
                            use_blockhash: u,
                            callback_status: RequestCallbackStatus::CallbackNotNecessary,
                            gas_limit_10k: 0,
                        })
                        .collect(),
                ),
            }
        }

        /// Insert a new request into the set of in-flight requests.
        pub fn insert(
            &self,
            provider: Address,
            sequence: u64,
            block_number: BlockNumber,
            use_blockhash: bool,
        ) -> &Self {
            self.requests.write().unwrap().push(Request {
                provider,
                sequence_number: sequence,
                block_number,
                use_blockhash,
                callback_status: RequestCallbackStatus::CallbackNotNecessary,
                gas_limit_10k: 0,
            });
            self
        }

        pub fn set_block_number(&self, block_number: BlockNumber) -> &Self {
            *(self.block_number.write().unwrap()) = block_number;
            self
        }
    }

    #[async_trait]
    impl EntropyReader for MockEntropyReader {
        async fn get_request_v2(
            &self,
            provider: Address,
            sequence_number: u64,
        ) -> Result<Option<Request>> {
            Ok(self
                .requests
                .read()
                .unwrap()
                .iter()
                .find(|&r| r.sequence_number == sequence_number && r.provider == provider)
                .map(|r| (*r).clone()))
        }

        async fn get_block_number(
            &self,
            _confirmed_block_status: BlockStatus,
        ) -> Result<BlockNumber> {
            Ok(*self.block_number.read().unwrap())
        }

        async fn get_request_with_callback_events(
            &self,
            _from_block: BlockNumber,
            _to_block: BlockNumber,
            _provider: Address,
        ) -> Result<Vec<super::RequestedV2Event>> {
            Ok(vec![])
        }

        async fn estimate_reveal_with_callback_gas(
            &self,
            _sender: Address,
            _provider: Address,
            _sequence_number: u64,
            _user_random_number: [u8; 32],
            _provider_revelation: [u8; 32],
        ) -> Result<U256> {
            Ok(U256::from(5))
        }
    }
}
