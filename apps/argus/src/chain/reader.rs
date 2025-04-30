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
