use {
    super::types::{
        AccumulatorMessages,
        MessageIdentifier,
        MessageState,
        MessageType,
        RequestTime,
        Slot,
    },
    anyhow::Result,
    async_trait::async_trait,
    pyth_sdk::PriceIdentifier,
    pythnet_sdk::wire::v1::WormholeMerkleRoot,
};

pub mod local_storage;

#[derive(Clone, PartialEq, Debug)]
pub struct AccumulatorState {
    pub slot:                  Slot,
    pub accumulator_messages:  Option<AccumulatorMessages>,
    pub wormhole_merkle_proof: Option<(WormholeMerkleRoot, Vec<u8>)>,
}

#[derive(Clone, Copy)]
pub enum MessageStateFilter {
    All,
    Only(MessageType),
}

/// This trait defines the interface for update data storage
///
/// Price update data for Pyth can come in multiple formats, for example VAA's and
/// Merkle proofs. The abstraction therefore allows storing these as binary
/// data to abstract the details of the update data, and so each update data is stored
/// under a separate key. The caller is responsible for specifying the right
/// key for the update data they wish to access.
#[async_trait]
pub trait Storage: Send + Sync {
    async fn message_state_keys(&self) -> Vec<MessageIdentifier>;
    async fn store_message_states(&self, message_states: Vec<MessageState>) -> Result<()>;
    async fn fetch_message_states(
        &self,
        ids: Vec<PriceIdentifier>,
        request_time: RequestTime,
        filter: MessageStateFilter,
    ) -> Result<Vec<MessageState>>;

    async fn store_accumulator_state(&self, state: AccumulatorState) -> Result<()>;
    async fn fetch_accumulator_state(&self, slot: u64) -> Result<Option<AccumulatorState>>;
}

pub type StorageInstance = Box<dyn Storage>;
