use {
    anyhow::Result,
    axum::async_trait,
    ethers::types::Address,
};

#[async_trait]
pub trait EntropyRead: Send + Sync {
    // Note: this interface is likely not generic enough for other types of blockchains
    async fn get_request(&self, provider: Address, sequence_number: u64)
        -> Result<Option<Request>>;
}

/*
pub trait Entropy: EntropyRead {

    async fn request(&self, provider: &Address,
                     user_randomness: &[u8; 32],
                     use_blockhash: bool)
}
 */

#[derive(Clone, Debug)]
pub struct Request {
    pub provider:        Address,
    pub sequence_number: u64,
}


#[cfg(test)]
pub mod test {
    use {
        crate::chain::reader::{
            EntropyRead,
            Request,
        },
        anyhow::Result,
        axum::async_trait,
        ethers::types::Address,
    };

    pub struct MockEntropyRead {
        requests: Vec<Request>,
    }

    pub fn mock_chain(requests: &[(Address, u64)]) -> MockEntropyRead {
        MockEntropyRead {
            requests: requests
                .iter()
                .map(|&(a, s)| Request {
                    provider:        a,
                    sequence_number: s,
                })
                .collect(),
        }
    }

    #[async_trait]
    impl EntropyRead for MockEntropyRead {
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
