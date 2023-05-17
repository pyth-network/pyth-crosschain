use {
    super::types::{
        MessageIdentifier,
        MessageKey,
        MessageState,
        RequestTime,
        RequestType,
    },
    anyhow::Result,
    std::sync::Arc,
};

pub mod local_storage;

/// This trait defines the interface for update data storage
///
/// Price update data for Pyth can come in multiple formats, for example VAA's and
/// Merkle proofs. The abstraction therefore allows storing these as binary
/// data to abstract the details of the update data, and so each update data is stored
/// under a separate key. The caller is responsible for specifying the right
/// key for the update data they wish to access.
pub trait Storage: Send + Sync {
    fn store_message_states(&self, message_states: Vec<MessageState>) -> Result<()>;
    fn retrieve_message_states(
        &self,
        ids: Vec<MessageIdentifier>,
        request_type: RequestType,
        request_time: RequestTime,
    ) -> Result<Vec<MessageState>>;
    fn keys(&self) -> Vec<MessageKey>;
}

pub type StorageInstance = Arc<Box<dyn Storage>>;
