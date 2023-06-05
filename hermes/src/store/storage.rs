use {
    super::{
        proof::wormhole_merkle::WormholeMerkleState,
        types::{
            AccumulatorMessages,
            ProofSet,
            RequestTime,
            Slot,
            UnixTimestamp,
        },
    },
    anyhow::{
        anyhow,
        Result,
    },
    async_trait::async_trait,
    pyth_oracle::{
        Message,
        MessageType,
    },
    pyth_sdk::PriceIdentifier,
};

pub mod local_storage;

#[derive(Clone, PartialEq, Debug)]
pub struct AccumulatorState {
    pub slot:                  Slot,
    pub accumulator_messages:  Option<AccumulatorMessages>,
    pub wormhole_merkle_state: Option<WormholeMerkleState>,
}

#[derive(Clone, PartialEq, Debug)]
pub struct CompletedAccumulatorState {
    pub slot:                  Slot,
    pub accumulator_messages:  AccumulatorMessages,
    pub wormhole_merkle_state: WormholeMerkleState,
}

impl TryFrom<AccumulatorState> for CompletedAccumulatorState {
    type Error = anyhow::Error;

    fn try_from(state: AccumulatorState) -> Result<Self> {
        let accumulator_messages = state
            .accumulator_messages
            .ok_or_else(|| anyhow!("missing accumulator messages"))?;
        let wormhole_merkle_state = state
            .wormhole_merkle_state
            .ok_or_else(|| anyhow!("missing wormhole merkle state"))?;
        Ok(Self {
            slot: state.slot,
            accumulator_messages,
            wormhole_merkle_state,
        })
    }
}

#[derive(Clone, PartialEq, Eq, Debug, Hash)]
pub struct MessageStateKey {
    pub id:    [u8; 32],
    pub type_: MessageType,
}

#[derive(Clone, PartialEq, Eq, Debug, PartialOrd, Ord)]
pub struct MessageStateTime {
    pub publish_time: UnixTimestamp,
    pub slot:         Slot,
}

#[derive(Clone, PartialEq, Debug)]
pub struct MessageState {
    pub slot:        Slot,
    pub message:     Message,
    pub proof_set:   ProofSet,
    pub received_at: UnixTimestamp,
}

impl MessageState {
    pub fn time(&self) -> MessageStateTime {
        MessageStateTime {
            publish_time: self.message.publish_time(),
            slot:         self.slot,
        }
    }

    pub fn key(&self) -> MessageStateKey {
        MessageStateKey {
            id:    self.message.id(),
            type_: self.message.into(),
        }
    }

    pub fn new(
        message: Message,
        proof_set: ProofSet,
        slot: Slot,
        received_at: UnixTimestamp,
    ) -> Self {
        Self {
            slot,
            message,
            proof_set,
            received_at,
        }
    }
}

#[derive(Clone, Copy)]
#[allow(dead_code)]
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
    async fn message_state_keys(&self) -> Vec<MessageStateKey>;
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
