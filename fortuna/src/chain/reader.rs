use {
    anyhow::Result,
    axum::async_trait,
    ethers::types::Address,
};

#[async_trait]
pub trait EntropyReader: Send + Sync {
    // Note: this interface is likely not generic enough for other types of blockchains
    async fn get_request(&self, provider: Address, sequence_number: u64)
        -> Result<Option<Request>>;
}

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
    };

    pub struct MockEntropyReader {
        requests: Vec<Request>,
    }

    impl MockEntropyReader {
        pub fn with_requests(requests: &[(Address, u64)]) -> MockEntropyReader {
            MockEntropyReader {
                requests: requests
                    .iter()
                    .map(|&(a, s)| Request {
                        provider:        a,
                        sequence_number: s,
                    })
                    .collect(),
            }
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
                .iter()
                .find(|&r| r.sequence_number == sequence_number)
                .map(|r| (*r).clone()))
        }
    }
}
