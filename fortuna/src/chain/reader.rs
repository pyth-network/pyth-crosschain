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

pub struct Request {
    pub provider:        Address,
    pub sequence_number: u64,
}
