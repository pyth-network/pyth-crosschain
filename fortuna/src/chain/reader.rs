use {
    anyhow::Result,
    axum::async_trait,
    ethers::types::{
        Address,
        BlockNumber,
    },
};

/// EntropyReader is the read-only interface of the Entropy contract.
#[async_trait]
pub trait EntropyReader: Send + Sync {
    /// Get an in-flight request (if it exists)
    /// Note that if we support additional blockchains in the future, the type of `provider` may
    /// need to become more generic.
    async fn get_request(&self, provider: Address, sequence_number: u64)
        -> Result<Option<Request>>;

    async fn get_block_number(&self, request_block_status: BlockNumber) -> Result<u64>;
}

/// An in-flight request stored in the contract.
/// (This struct is missing many fields that are defined in the contract, as they
/// aren't used in fortuna anywhere. Feel free to add any missing fields as necessary.)
#[derive(Clone, Debug)]
pub struct Request {
    pub provider:        Address,
    pub sequence_number: u64,
    // The block number where this request was created
    pub block_number:    u64,
    pub use_blockhash:   bool,
}


#[cfg(test)]
pub mod mock {
    use {
        crate::chain::reader::{
            EntropyReader,
            Request,
        },
        anyhow::Result,
        axum::async_trait,
        ethers::types::Address,
        std::sync::RwLock,
    };

    /// Mock version of the entropy contract intended for testing.
    /// This class is internally locked to allow tests to modify the in-flight requests while
    /// the API is also holding a pointer to the same data structure.
    pub struct MockEntropyReader {
        block_number: RwLock<u64>,
        /// The set of requests that are currently in-flight.
        requests:     RwLock<Vec<Request>>,
    }

    impl MockEntropyReader {
        pub fn with_requests(
            block_number: u64,
            requests: &[(Address, u64, u64, bool)],
        ) -> MockEntropyReader {
            MockEntropyReader {
                block_number: RwLock::new(block_number),
                requests:     RwLock::new(
                    requests
                        .iter()
                        .map(|&(a, s, b, u)| Request {
                            provider:        a,
                            sequence_number: s,
                            block_number:    b,
                            use_blockhash:   u,
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
            block_number: u64,
            use_blockhash: bool,
        ) -> &Self {
            self.requests.write().unwrap().push(Request {
                provider,
                sequence_number: sequence,
                block_number,
                use_blockhash,
            });
            self
        }

        pub fn set_block_number(&self, block_number: u64) -> &Self {
            *(self.block_number.write().unwrap()) = block_number;
            self
        }
    }

    #[async_trait]
    impl EntropyReader for MockEntropyReader {
        async fn get_request(
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

        async fn get_block_number(&self) -> Result<u64> {
            Ok(*self.block_number.read().unwrap())
        }
    }
}
