use {
    anyhow::Result,
    axum::async_trait,
    ethers::types::Address,
};

/// EntropyReader is the read-only interface of the Entropy contract.
#[async_trait]
pub trait EntropyReader: Send + Sync {
    /// Get an in-flight request (if it exists)
    /// Note that if we support additional blockchains in the future, the type of `provider` may
    /// need to become more generic.
    async fn get_request(&self, provider: Address, sequence_number: u64)
        -> Result<Option<Request>>;
}

/// An in-flight request stored in the contract.
/// (This struct is missing many fields that are defined in the contract, as they
/// aren't used in fortuna anywhere. Feel free to add any missing fields as necessary.)
#[derive(Clone, Debug)]
pub struct Request {
    pub provider:        Address,
    pub sequence_number: u64,
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
        /// The set of requests that are currently in-flight.
        requests: RwLock<Vec<Request>>,
    }

    impl MockEntropyReader {
        pub fn with_requests(requests: &[(Address, u64)]) -> MockEntropyReader {
            MockEntropyReader {
                requests: RwLock::new(
                    requests
                        .iter()
                        .map(|&(a, s)| Request {
                            provider:        a,
                            sequence_number: s,
                        })
                        .collect(),
                ),
            }
        }

        /// Insert a new request into the set of in-flight requests.
        pub fn insert(&self, provider: Address, sequence: u64) -> &Self {
            self.requests.write().unwrap().push(Request {
                provider,
                sequence_number: sequence,
            });
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
    }
}
