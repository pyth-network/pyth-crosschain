




pub struct Block {
    pub hash: [u8; 32],
    pub parent: Option<[u8; 32]>,
    pub block_number: u64,

    pub events: Vec<PulseEvent>,
    pub state_after: PulseRequests,
}


pub struct BlockchainState {
    pub block_number: u64,

    // block[i]'s parent must equal block[i-1].hash
    // prune this at a certain length?
    pub blocks: Vec<Block>,
}

// TODO: implement this so we can mock out the provider and the blockchain requests so we can test
// TODO: whatever interface we choose for mocking out the provider, we should implement with multiple redundant RPCs
impl BlockchainState {
    pub fn on_new_block_number(&mut self, block_number: u64) {
        let header = provider.get_block_header(block_number);

        let my_current_block = self.blocks[self.blocks.len() - 1];

        let mut headers = Vec::new();
        headers.push(header);

        // get all headers for block numbers that are ahead of the current block we have
        let current_block_number = my_current_block.block_number;
        while (current_block_number + 1 < block_number) {
            let header = provider.get_block_header(current_block_number);
            headers.push(header);
        }

        // check if there is a reorg (meaning the latest header's parent doesn't match our current block).
        // If there is a reorg, walk backward in our history and the header history until we find the common ancestor.
        // Also need to handle the case where the reorg spans the whole block history
        let mut current_block_index = self.blocks.len() - 1;
        if headers[headers.len() - 1].parent_hash != self.blocks[current_block_index].hash {
            current_block_index -= 1;
            let header = provider.get_block_header(current_block_number);
            headers.push(header);
        }

        // Fetch the events for each header
        // make some blocks and put them in the array

        // play forward the events to get the state.
    }
}

// full set of currently pending on-chain requests
pub struct PulseRequests {

}

impl PulseRequests {
    pub fn apply_events(events: &Vec<PulseEvent>) -> PulseRequests {

    }
}

pub struct PulseRequest {
    // whatever parameters you need for the callback
}


pub struct CallbackState {
    pub pending_requests: HashMap<PulseRequest, CallbackStatus>,
}

impl CallbackState {
    pub fn update(requests: PulseRequests) {
        // add in new requests to pending_requests
        // remove any fulfilled requests or disappeared requests
    }

    // this probably gets called in a loop forever
    pub fn spawn_tasks() {
        // loop over pending_requests and spawn a thread to fulfill the request
        // only spawn threads for requests that we think we can fulfill at the current time.
        // check status.task
        // - None - spawnable task
        // - Some(fut) -- see if fut is done, if so, increment num_retries. Potentially keep around the Result ?
        //     - you could spawn a new task to retry here
        //

        // keep pulse requests around for a long time and keep retrying them over that time
        // if any request has been around longer than XX minutes, then fire an alert.
        // (we have failed_requests counter that goes into grafana and then we trigger an alert from there)
        // log the request and the block where it was created.

        // can potentially keep pending requests around if we think the blockchain is offline until it comes back.
    }

    fn spawn_task(request: &PulseRequest) {
        // implement escalation policy to determine multipliers
        // call fulfill_request
    }
}

// core logic of fulfilling pulse requests
pub async fn fulfill_request(request: &PulseRequest, hermes: &str,  gas_estimate_multiplier_pct: u64,
    fee_estimate_multiplier_pct: u64,) -> Result<()> {
    // get price update by calling hermes
    // create contract call and submit it
}


pub struct CallbackStatus {
    // task needs the ability to update these values.
    num_retries: u64,
    last_retry_time: Instant,
    task: Option<JoinHandle<Result<()>>>,
}
