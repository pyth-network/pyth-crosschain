use std::sync::Arc;
use ethers::{
    providers::{Http, Middleware, Provider},
    types::Address,
    signers::LocalWallet,
};
use fortuna::eth_utils::traced_client::{RpcMetrics, TracedClient};

pub struct PythPulse<M> {
    address: Address,
    client: Arc<M>,
}

impl<M: Middleware + 'static> PythPulse<M> {
    pub fn new(address: Address, client: Arc<M>) -> Self {
        Self { address, client }
    }

    pub fn client(&self) -> &Arc<M> {
        &self.client
    }
}

pub mod pyth_pulse {
    pub use crate::state::SubscriptionParams;
}
