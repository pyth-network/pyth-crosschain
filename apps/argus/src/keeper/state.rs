use anyhow::{anyhow, Result};
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::time::Duration;
use tokio::task::JoinHandle;
use tokio::time::Instant;
use tracing;

/// Represents events from the Pulse contract
#[derive(Debug, Clone)]
pub enum PulseEvent {
    /// Event emitted when a price update is requested
    PriceUpdateRequested {
        sequence_number: u64,
        publish_time: u64,
        price_ids: Vec<[u8; 32]>,
        callback_gas_limit: U256,
        requester: Address,
        provider: Address,
        fee: u128,
    },
    /// Event emitted when a price update is executed
    PriceUpdateExecuted {
        sequence_number: u64,
        provider: Address,
        price_ids: Vec<[u8; 32]>,
        prices: Vec<i64>,
        conf: Vec<u64>,
        expos: Vec<i32>,
        publish_times: Vec<u64>,
    },
}

/// Represents a block in the blockchain
pub struct Block {
    pub hash: [u8; 32],
    pub parent: Option<[u8; 32]>,
    pub block_number: u64,
    pub events: Vec<PulseEvent>,
    pub state_after: PulseRequests,
}

impl Block {
    /// Create a new Block
    pub fn new(
        hash: [u8; 32],
        parent: Option<[u8; 32]>,
        block_number: u64,
        events: Vec<PulseEvent>,
        previous_state: PulseRequests,
    ) -> Self {
        // Apply events to the previous state to get the new state
        let state_after = previous_state.clone().apply_events(&events);

        Block {
            hash,
            parent,
            block_number,
            events,
            state_after,
        }
    }
}

/// BlockHeader represents the header of a block
pub struct BlockHeader {
    pub hash: [u8; 32],
    pub parent: Option<[u8; 32]>,
    pub block_number: u64,
}

/// Trait to abstract blockchain provider interactions
pub trait BlockchainProvider {
    /// Get the header for a block
    fn get_block_header(&self, block_number: u64) -> Result<BlockHeader>;

    /// Get events for a block
    fn get_events(&self, block_number: u64) -> Result<Vec<PulseEvent>>;
}

/// Represents the state of the blockchain
pub struct BlockchainState {
    pub block_number: u64,
    /// block[i]'s parent must equal block[i-1].hash
    /// prune this at a certain length
    pub blocks: Vec<Block>,
    /// Maximum number of blocks to keep
    max_blocks: usize,
}

impl BlockchainState {
    /// Create a new BlockchainState
    pub fn new(max_blocks: usize) -> Self {
        BlockchainState {
            block_number: 0,
            blocks: Vec::new(),
            max_blocks,
        }
    }

    /// Get the current state (open requests)
    pub fn current_state(&self) -> Option<&PulseRequests> {
        self.blocks.last().map(|block| &block.state_after)
    }

    /// Process a new block
    pub fn on_new_block(
        &mut self,
        provider: &impl BlockchainProvider,
        block_number: u64,
    ) -> Result<()> {
        // If this is the first block, initialize the state
        if self.blocks.is_empty() {
            let header = provider.get_block_header(block_number)?;
            let events = provider.get_events(block_number)?;

            let initial_state = PulseRequests::new();
            let block = Block::new(
                header.hash,
                header.parent,
                block_number,
                events,
                initial_state,
            );

            self.blocks.push(block);
            self.block_number = block_number;
            return Ok(());
        }

        let my_current_block = self.blocks.last().unwrap();

        // Get the header for the new block
        let header = provider.get_block_header(block_number)?;

        // Check if there is a reorg
        if let Some(parent_hash) = header.parent {
            if parent_hash != my_current_block.hash {
                // Handle chain reorganization
                self.handle_reorg(provider, block_number, header)?;
            } else {
                // No reorg, just add the new block
                let events = provider.get_events(block_number)?;
                let previous_state = my_current_block.state_after.clone();

                let block = Block::new(
                    header.hash,
                    Some(my_current_block.hash),
                    block_number,
                    events,
                    previous_state,
                );

                self.blocks.push(block);

                // Prune old blocks if needed
                if self.blocks.len() > self.max_blocks {
                    self.blocks.remove(0);
                }
            }
        }

        self.block_number = block_number;
        Ok(())
    }

    /// Handle chain reorganization
    fn handle_reorg(
        &mut self,
        provider: &impl BlockchainProvider,
        block_number: u64,
        header: BlockHeader,
    ) -> Result<()> {
        // Find the common ancestor
        let mut current_block_index = self.blocks.len() - 1;
        let mut common_ancestor_found = false;

        // Walk backward in our history until we find the common ancestor
        while current_block_index > 0 {
            current_block_index -= 1;

            if let Some(parent_hash) = header.parent {
                if parent_hash == self.blocks[current_block_index].hash {
                    common_ancestor_found = true;
                    break;
                }
            }
        }

        if !common_ancestor_found {
            // If no common ancestor is found, reset the state
            self.blocks.clear();
            return self.on_new_block(provider, block_number);
        }

        // Truncate the blocks after the common ancestor
        self.blocks.truncate(current_block_index + 1);

        // Add the new block
        let events = provider.get_events(block_number)?;
        let previous_state = self.blocks.last().unwrap().state_after.clone();

        let block = Block::new(
            header.hash,
            Some(self.blocks.last().unwrap().hash),
            block_number,
            events,
            previous_state,
        );

        self.blocks.push(block);
        self.block_number = block_number;

        Ok(())
    }
}

/// Represents the set of open price update requests
#[derive(Debug, Clone)]
pub struct PulseRequests {
    /// Map of sequence number to request
    pub requests: HashMap<u64, PulseRequest>,
}

impl PulseRequests {
    /// Create a new empty PulseRequests
    pub fn new() -> Self {
        PulseRequests {
            requests: HashMap::new(),
        }
    }

    /// Apply events to update the state
    pub fn apply_events(mut self, events: &Vec<PulseEvent>) -> Self {
        for event in events {
            match event {
                PulseEvent::PriceUpdateRequested {
                    sequence_number, ..
                } => {
                    if let Some(request) = PulseRequest::from_event(event) {
                        self.requests.insert(*sequence_number, request);
                    }
                }
                PulseEvent::PriceUpdateExecuted {
                    sequence_number, ..
                } => {
                    // Remove the request when it's fulfilled
                    self.requests.remove(sequence_number);
                }
            }
        }
        self
    }

    /// Get all pending requests
    pub fn get_pending_requests(&self) -> Vec<&PulseRequest> {
        self.requests.values().collect()
    }
}

/// Represents an individual price update request
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PulseRequest {
    pub sequence_number: u64,
    pub publish_time: u64,
    pub price_ids: Vec<[u8; 32]>,
    pub callback_gas_limit: U256,
    pub requester: Address,
    pub provider: Address,
    pub fee: u128,
}

impl PulseRequest {
    /// Create a new PulseRequest from a PriceUpdateRequested event
    pub fn from_event(event: &PulseEvent) -> Option<Self> {
        match event {
            PulseEvent::PriceUpdateRequested {
                sequence_number,
                publish_time,
                price_ids,
                callback_gas_limit,
                requester,
                provider,
                fee,
            } => Some(PulseRequest {
                sequence_number: *sequence_number,
                publish_time: *publish_time,
                price_ids: price_ids.clone(),
                callback_gas_limit: *callback_gas_limit,
                requester: *requester,
                provider: *provider,
                fee: *fee,
            }),
            _ => None,
        }
    }
}

/// Status of a callback task
pub struct CallbackStatus {
    /// Number of retry attempts
    pub num_retries: u64,
    /// Time of the last retry attempt
    pub last_retry_time: Instant,
    /// Task handle if a task is currently running
    pub task: Option<JoinHandle<Result<()>>>,
}

/// Manages the state of callbacks
pub struct CallbackState {
    pub pending_requests: HashMap<PulseRequest, CallbackStatus>,
    /// Maximum number of retries
    max_retries: u64,
    /// Delay between retries
    retry_delay: Duration,
}

impl CallbackState {
    /// Create a new CallbackState
    pub fn new(max_retries: u64, retry_delay: Duration) -> Self {
        CallbackState {
            pending_requests: HashMap::new(),
            max_retries,
            retry_delay,
        }
    }

    /// Update the state with new requests
    pub fn update(&mut self, requests: &PulseRequests) {
        // Add new requests
        for request in requests.get_pending_requests() {
            if !self.pending_requests.contains_key(request) {
                self.pending_requests.insert(
                    request.clone(),
                    CallbackStatus {
                        num_retries: 0,
                        last_retry_time: Instant::now(),
                        task: None,
                    },
                );
            }
        }

        // Remove fulfilled requests
        self.pending_requests
            .retain(|request, _| requests.requests.contains_key(&request.sequence_number));
    }

    /// Spawn tasks to fulfill requests
    pub fn spawn_tasks(&mut self, hermes_url: &str, gas_multiplier: u64, fee_multiplier: u64) {
        let now = Instant::now();

        for (request, status) in &mut self.pending_requests {
            // Check if the request is ready to be fulfilled (publish time has passed)
            let current_time = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            if current_time < request.publish_time {
                continue; // Not time to fulfill yet
            }

            // Check if a task is already running
            if let Some(task) = &status.task {
                if !task.is_finished() {
                    continue; // Task is still running
                }

                // Task is finished, check if it succeeded
                status.task = None;
                status.num_retries += 1;

                // If max retries reached, log an error
                if status.num_retries >= self.max_retries {
                    tracing::error!(
                        "Failed to fulfill request after {} retries: {:?}",
                        self.max_retries,
                        request
                    );
                    continue;
                }

                // Check if enough time has passed since the last retry
                if now.duration_since(status.last_retry_time) < self.retry_delay {
                    continue; // Not time to retry yet
                }
            }

            // Spawn a new task
            let request_clone = request.clone();
            let hermes_url = hermes_url.to_string();
            let gas_multiplier = gas_multiplier;
            let fee_multiplier = fee_multiplier;

            let request_clone_inner = request_clone.clone();
            let hermes_url_inner = hermes_url.clone();
            status.task = Some(tokio::spawn(std::future::ready(fulfill_request(
                &request_clone_inner,
                &hermes_url_inner,
                gas_multiplier,
                fee_multiplier,
            ))));

            status.last_retry_time = now;
        }
    }
}

/// Core logic of fulfilling pulse requests
pub fn fulfill_request(
    request: &PulseRequest,
    hermes_url: &str,
    gas_estimate_multiplier_pct: u64,
    fee_estimate_multiplier_pct: u64,
) -> Result<()> {
    // Get price update by calling hermes
    // TODO: Implement the actual call to Hermes service

    // Create contract call and submit it
    // TODO: Implement the contract call to fulfill the request

    Ok(())
}
