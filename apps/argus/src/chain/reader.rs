use ethers::types::{Address, BlockNumber as EthersBlockNumber};

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
    pub user_random_number: [u8; 32],
    pub provider_address: Address,
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
}
