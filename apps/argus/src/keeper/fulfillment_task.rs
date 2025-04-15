use anyhow::Result;
use tokio::task::JoinHandle;

use super::state::{EscalationPolicy, PulseRequest};
use async_trait::async_trait;

#[allow(dead_code)]
#[derive(Debug)]
pub struct RequestFulfillmentTask {
    /// If None, the task hasn't been spawned. If Some(fut), task is in flight or completed.
    pub task: Option<JoinHandle<Result<()>>>,
    pub retries: u32,
    pub success: bool,

    // The error received during fulfillment if `success` is false.
    // We don't consider the consumer callback reverting as a failure since we catch those
    // in the Pulse contract. Thus, this should only happen if there's a transient RPC error
    // (tx failed to land, out of gas, etc)
    pub error: Option<String>,
}

#[async_trait]
pub trait RequestFulfiller: Send + Sync + 'static {
    #[allow(dead_code)]
    async fn fulfill_request(
        &self,
        request: PulseRequest,
        hermes_url: &str,
        escalation_policy: EscalationPolicy,
    ) -> Result<()>;
}

#[allow(dead_code)]
pub struct DefaultRequestFulfiller;

#[async_trait]
impl RequestFulfiller for DefaultRequestFulfiller {
    /// Core logic of fulfilling a Pulse request
    async fn fulfill_request(
        &self,
        _request: PulseRequest,
        _hermes_url: &str,
        _escalation_policy: EscalationPolicy,
    ) -> Result<()> {
        // TODO:
        // 1. get price update by calling hermes
        // 2. create contract call and submit it with escalation policy
        // 3. validate receipt from tx
        Ok(())
    }
}
