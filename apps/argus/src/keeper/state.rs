//! Keeper state management module.
//!
//! This module provides the state layer for the keeper, responsible for tracking
//! and managing on-chain price update requests. It maintains the current state of
//! pending requests and their fulfillment status.

use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use super::{
    fulfillment_task::{RequestFulfiller, RequestFulfillmentTask},
    keeper_metrics::KeeperMetrics,
};
use ethers::types::Address;
use tokio::sync::RwLock;
use tracing::{error, info};
use url::Url;

/// The price request from the Pulse contract (only fields useful in Argus are present here.)
// TODO: Get this from somewhere else, SDK perhaps?
#[derive(Debug, Clone, Eq, PartialEq, Hash)]
pub struct PulseRequest {
    pub sequence_number: u64,
    pub feed_id_prefixes: Vec<[u8; 8]>,

    // The timestamp at which the callback should be fulfilled
    pub publish_time: u64,

    // Max gas the user's callback can consume. Passed as a parameter
    // to the user callback by Pulse.executeCallback.
    pub callback_gas_limit: u32,

    // Provider's address
    pub provider: Address,
}
// FIXME: Stub EscalationPolicy until we need it. At that point we should
// refactor it out of Fortuna into a common SDK.
#[derive(Debug, Clone)]
pub struct EscalationPolicy;

impl Default for EscalationPolicy {
    fn default() -> Self {
        Self {}
    }
}

#[allow(dead_code)]
pub struct KeeperState {
    /// All currently fulfillable requests from the Pulse contract
    pub pending_requests: Arc<RwLock<HashMap<PulseRequest, RequestFulfillmentTask>>>,

    /// Map from a prefix feed ID prefix (the values stored in the on-chain requests)
    /// to the actual price feed ID, which is queryable in Hermes.
    ///
    /// NOTE: Maybe support querying by prefix in Hermes? that way we don't have to keep
    /// an up-to-date map in Argus since that's a little clunky, and we can avoid
    /// failing to recognize freshly listed IDs if our map is stale.
    /// OR, we fetch all price ids from Hermes every time and find the prefix.
    pub prefix_to_price_ids: Arc<HashMap<String, String>>,

    /// The time period after a request's publish_time during which only the requested provider
    /// can fulfill the request.
    /// After this period lapses, any provider can fulfill it (TODO: for an extra reward?)
    pub exclusivity_period_seconds: u32,

    /// The amount of time a request can retry until it's considered unfulfillable and is ignored.
    pub failure_timeout_seconds: u64,

    /// Policy that defines the internal retries for landing the callback execution tx.
    /// Increases gas and fees until the tx lands.
    pub escalation_policy: EscalationPolicy,

    /// The Hermes endpoint to fetch price data from
    pub hermes_url: Url,

    /// The public key of the provider whose requests this keeper will respond to.
    pub provider_address: Address,

    /// RequestFulfiller implementor that can execute the callback request
    pub request_fulfiller: Arc<dyn RequestFulfiller>,

    /// Metrics for tracking keeper performance
    /// TODO: emit metrics
    pub metrics: Arc<KeeperMetrics>,
}

impl KeeperState {
    #[allow(dead_code)]
    /// Update the set of pending requests. Add any new requests to the set,
    /// remove any missing requests (these have been fulfilled/disappeared.)
    pub async fn update(&mut self, incoming: Vec<PulseRequest>) {
        let mut pending_requests = self.pending_requests.write().await;

        // Create a set of sequence numbers from the new requests
        let incoming_sequence_numbers: HashSet<u64> =
            incoming.iter().map(|req| req.sequence_number).collect();

        // Remove requests that are no longer present
        pending_requests.retain(|req, _| incoming_sequence_numbers.contains(&req.sequence_number));

        // Add new requests that aren't already being tracked
        for request in incoming {
            if !pending_requests.contains_key(&request) {
                pending_requests.insert(
                    request,
                    RequestFulfillmentTask {
                        task: None,
                        retries: 0,
                        success: false,
                        error: None,
                    },
                );
            }
        }
    }

    #[allow(dead_code)]
    /// Spawns fulfillment tasks and retries for requests that are ready to be fulfilled.
    /// Intended to be called in a loop. High level flow:
    /// - Loop over pending_requests and spawn tasks to fulfill.
    /// - Only spawn tasks for requests that we think we can fulfill at the current time.
    /// - Check status.task:
    ///   - None -> Spawnable task
    ///   - Some(JoinHandle) -> Running or finished task
    ///     - Retry if the result was failure
    /// - Keep Pulse requests around for a long time and keep retrying over that time. If any
    ///   request has been around longer than failure_timeout_seconds, consider it unfulfillable
    ///   and ignore it. TODO: implement cleaning these up on-chain.
    pub async fn process_pending_requests(
        &self,
        current_time: u64, // Unix timestamp in seconds
    ) {
        // TODO: if we see issues with high contention on pending_requests, we can refactor this to use a read lock, and only take the write lock when needed
        let mut pending_requests = self.pending_requests.write().await;

        for (request, fulfillment_task) in pending_requests.iter_mut() {
            // Skip requests that aren't fulfillable yet
            if !self.is_request_fulfillable(request, fulfillment_task, current_time) {
                continue;
            }

            // Handle task based on its current state
            match &fulfillment_task.task {
                None => {
                    // Task doesn't exist yet, spawn it
                    let req_clone = request.clone();
                    let hermes_url = self.hermes_url.to_string().clone();
                    let escalation_policy = self.escalation_policy.clone();
                    let fulfiller = self.request_fulfiller.clone();

                    let handle = tokio::spawn(async move {
                        info!("Executing task...");
                        match fulfiller
                            .fulfill_request(req_clone, &hermes_url, escalation_policy)
                            .await
                        {
                            Ok(()) => Ok(()),
                            Err(e) => {
                                error!("Error fulfilling request: {}", e);
                                Err(e)
                            }
                        }
                    });

                    fulfillment_task.task = Some(handle);
                    info!(
                        sequence_number = request.sequence_number,
                        "Spawned new fulfillment task for request {}", request.sequence_number
                    );
                }
                // Task exists and is completed
                Some(handle) if handle.is_finished() => {
                    // Take ownership of the handle and consume the result
                    let handle = fulfillment_task.task.take().unwrap();
                    match handle.await {
                        Ok(Ok(())) => {
                            // Task completed successfully
                            fulfillment_task.success = true;
                            info!(
                                sequence_number = request.sequence_number,
                                "Successfully fulfilled request {}", request.sequence_number
                            );
                        }
                        Ok(Err(e)) => {
                            // Task failed with an error
                            fulfillment_task.success = false;
                            fulfillment_task.retries += 1;
                            let err = e.to_string();
                            error!(
                                sequence_number = request.sequence_number,
                                error = err,
                                "Request {} fulfillment failed on attempt {} with error '{}'",
                                request.sequence_number,
                                fulfillment_task.retries,
                                err,
                            );

                            // Reset the task handle so we retry next loop
                            fulfillment_task.task = None;
                        }
                        Err(e) => {
                            // Task panicked
                            fulfillment_task.success = false;
                            fulfillment_task.retries += 1;
                            let err = e.to_string();
                            error!(
                                sequence_number = request.sequence_number,
                                error = err,
                                "Request {} fulfillment panicked on attempt {} with error '{}'",
                                request.sequence_number,
                                fulfillment_task.retries,
                                err,
                            );

                            // Reset the task handle so we retry next loop
                            fulfillment_task.task = None;
                        }
                    }
                }

                // Task exists and is still running - leave it alone
                Some(_) => {}
            }

            // Check if request has been around too long without success
            let request_age_seconds = current_time - request.publish_time;
            if !fulfillment_task.success && request_age_seconds > self.failure_timeout_seconds {
                error!(
                    "Request #{} has exceeded timeout of {} minutes without successful fulfillment",
                    request.sequence_number, self.failure_timeout_seconds
                );

                // TODO: Emit metrics here for monitoring/alerting
            }
        }
    }

    /// Determines if a request is currently fulfillable by this provider
    fn is_request_fulfillable(
        &self,
        request: &PulseRequest,
        fulfillment_task: &RequestFulfillmentTask,
        current_time: u64,
    ) -> bool {
        // Check if the request's publish time has been reached, or if we've already responded
        if fulfillment_task.success || current_time < request.publish_time {
            return false;
        }

        // Check exclusivity period constraints
        let is_exclusive_period =
            current_time < request.publish_time + self.exclusivity_period_seconds as u64;
        let is_designated_provider = &request.provider == &self.provider_address;

        if is_exclusive_period && !is_designated_provider {
            return false;
        }

        // Request is fulfillable
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Result;
    use async_trait::async_trait;
    use lazy_static::lazy_static;
    use mockall::predicate::*;
    use mockall::*;
    use std::str::FromStr;
    use std::sync::Arc;
    use std::sync::Once;
    use tokio::sync::RwLock;
    use tracing_subscriber::fmt::format::FmtSpan;

    lazy_static! {
        static ref INIT: Once = Once::new();
    }

    #[allow(dead_code)]
    /// Call this in a test to enable logs
    fn init_test_logging() {
        INIT.call_once(|| {
            let _ = tracing_subscriber::fmt()
                .with_env_filter("info,keeper=debug")
                .with_span_events(FmtSpan::CLOSE)
                .try_init();
        });
    }

    const MOCK_PROVIDER_ADDRESS: &str = "0x0000000000000000000000000000000000000001";
    const MOCK_HERMES_URL: &str = "https://hermes.pyth.mock";

    // Create a mock fulfiller that lets us control whether
    // or not the fulfillment task succeeds
    mock! {
        pub Fulfiller {}

        #[async_trait]
        impl RequestFulfiller for Fulfiller {
            async fn fulfill_request(
                &self,
                request: PulseRequest,
                hermes_url: &str,
                escalation_policy: EscalationPolicy,
            ) -> Result<()>;
        }
    }

    /// Helper function to create a test KeeperState with default values and a MockFulfiller
    /// that we can control the behavior of to simulate callback success and/or failure.
    fn create_test_keeper_state(mock_fulfiller: Option<MockFulfiller>) -> KeeperState {
        let provider_address = Address::from_str(MOCK_PROVIDER_ADDRESS).unwrap();
        let metrics = KeeperMetrics::default();

        // Create a mock fulfiller if one wasn't provided
        let mock_fulfiller = match mock_fulfiller {
            Some(fulfiller) => fulfiller,
            None => {
                let mut fulfiller = MockFulfiller::new();
                // Default behavior - succeed on fulfillment
                fulfiller
                    .expect_fulfill_request()
                    .returning(|_, _, _| Ok(()));
                fulfiller
            }
        };

        KeeperState {
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            prefix_to_price_ids: Arc::new(HashMap::new()),
            exclusivity_period_seconds: 300,
            failure_timeout_seconds: 3600,
            escalation_policy: EscalationPolicy::default(),
            hermes_url: Url::parse(MOCK_HERMES_URL).unwrap(),
            provider_address,
            metrics: Arc::new(metrics),
            request_fulfiller: Arc::new(mock_fulfiller),
        }
    }

    // Helper to create a test PulseRequest
    fn create_test_request(
        sequence_number: u64,
        publish_time: u64,
        provider: &str,
    ) -> PulseRequest {
        PulseRequest {
            sequence_number,
            feed_id_prefixes: vec![[0xff, 0x61, 0x49, 0x1a, 0x00, 0x00, 0x00, 0x00]],
            publish_time,
            callback_gas_limit: 100000,
            provider: Address::from_str(provider).unwrap_or_default(),
        }
    }

    #[tokio::test]
    async fn test_is_request_fulfillable() {
        let keeper = create_test_keeper_state(None);
        let current_time = 1000u64; // Base time for tests

        // Case 1: Request with future publish time should not be fulfillable
        let future_request = create_test_request(1, current_time + 100, MOCK_PROVIDER_ADDRESS);
        let task = RequestFulfillmentTask {
            task: None,
            retries: 0,
            success: false,
            error: None,
        };

        assert!(!keeper.is_request_fulfillable(&future_request, &task, current_time));

        // Case 2: Already fulfilled request should not be fulfillable
        let past_request = create_test_request(2, current_time - 100, MOCK_PROVIDER_ADDRESS);
        let successful_task = RequestFulfillmentTask {
            task: None,
            retries: 1,
            success: true,
            error: None,
        };

        assert!(!keeper.is_request_fulfillable(&past_request, &successful_task, current_time));

        // Case 3: Request in exclusivity period for a different provider
        let other_provider_request = create_test_request(
            3,
            current_time - 100,
            "0x0000000000000000000000000000000000000002", // Different provider
        );
        let task = RequestFulfillmentTask {
            task: None,
            retries: 0,
            success: false,
            error: None,
        };

        // Should not be fulfillable if in exclusivity period and we're not the provider
        assert!(!keeper.is_request_fulfillable(&other_provider_request, &task, current_time));

        // Case 4: Request in exclusivity period for our provider
        let our_provider_request = create_test_request(
            4,
            current_time - 100,
            MOCK_PROVIDER_ADDRESS, // Our provider
        );

        // Should be fulfillable if we're the requested provider
        assert!(keeper.is_request_fulfillable(&our_provider_request, &task, current_time));

        // Case 5: Request after exclusivity period
        let after_exclusivity_time = current_time + keeper.exclusivity_period_seconds as u64 + 100;

        // Any provider can fulfill after exclusivity period
        assert!(keeper.is_request_fulfillable(
            &other_provider_request,
            &task,
            after_exclusivity_time
        ));
    }

    #[tokio::test]
    async fn test_update() {
        let mut keeper = create_test_keeper_state(None);

        // Add initial requests
        let request1 = create_test_request(1, 1000, MOCK_PROVIDER_ADDRESS);
        let request2 = create_test_request(2, 1000, MOCK_PROVIDER_ADDRESS);

        keeper
            .update(vec![request1.clone(), request2.clone()])
            .await;

        // Verify both requests are in the state
        {
            let pending = keeper.pending_requests.read().await;
            assert_eq!(pending.len(), 2);
            assert!(pending.contains_key(&request1));
            assert!(pending.contains_key(&request2));
        }

        // Update with only one request - should remove the other
        let request3 = create_test_request(3, 1000, MOCK_PROVIDER_ADDRESS);
        keeper
            .update(vec![request1.clone(), request3.clone()])
            .await;

        let pending = keeper.pending_requests.read().await;
        assert_eq!(pending.len(), 2);
        assert!(pending.contains_key(&request1));
        assert!(!pending.contains_key(&request2));
        assert!(pending.contains_key(&request3));
    }

    #[tokio::test]
    async fn test_process_pending_requests() {
        // Create a test keeper state with a mock fulfiller that we can control
        let mut mock_fulfiller = MockFulfiller::new();
        let current_time = 1000u64;
        let request = create_test_request(1, current_time - 100, MOCK_PROVIDER_ADDRESS);

        // Setup expectations for the mock
        mock_fulfiller
            .expect_fulfill_request()
            .times(1)
            .returning(|_, _, _| Ok(()));

        let mut keeper = create_test_keeper_state(Some(mock_fulfiller));
        keeper.update(vec![request.clone()]).await;

        // Code under test
        keeper.process_pending_requests(current_time).await;

        // Verify that a task was spawned
        {
            let pending = keeper.pending_requests.read().await;
            let task = pending.get(&request).unwrap();
            assert!(task.task.is_some(), "Expected a task to be spawned");
        }

        // Wait and poll again, the task should have completed successfully
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        keeper.process_pending_requests(current_time).await;
        {
            let pending = keeper.pending_requests.read().await;
            let task = pending.get(&request).unwrap();
            assert!(task.success, "Task should have completed successfully");
            assert_eq!(task.retries, 0, "No retries should have occurred");
        }
    }

    #[tokio::test]
    async fn test_process_pending_requests_failure_and_retry() {
        let mut mock_fulfiller = MockFulfiller::new();
        let current_time = 1000u64;
        let request = create_test_request(1, current_time - 100, MOCK_PROVIDER_ADDRESS);

        // First fulfillment call fails, second call succeeds
        mock_fulfiller
            .expect_fulfill_request()
            .times(1)
            .returning(|_, _, _| anyhow::bail!("Simulated failure"));

        mock_fulfiller
            .expect_fulfill_request()
            .times(1)
            .returning(|_, _, _| Ok(()));

        let mut keeper = create_test_keeper_state(Some(mock_fulfiller));
        keeper.update(vec![request.clone()]).await;

        // First attempt - should fail
        keeper.process_pending_requests(current_time).await;

        // Wait for first task to complete, check that it failed and is ready for retry
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        keeper.process_pending_requests(current_time).await;
        {
            let pending = keeper.pending_requests.read().await;
            let task = pending.get(&request).unwrap();
            assert!(!task.success, "Task should have failed");
            assert_eq!(task.retries, 1, "One retry should have been recorded");
            assert!(task.task.is_none(), "Task should be reset for retry");
        }

        // Second attempt - should succeed
        keeper.process_pending_requests(current_time).await;

        // Wait for task to complete, check that it succeeded on retry
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        keeper.process_pending_requests(current_time).await;
        {
            let pending = keeper.pending_requests.read().await;
            let task = pending.get(&request).unwrap();
            assert!(task.success, "Task should have succeeded on retry");
            assert_eq!(task.retries, 1, "Retry count should remain at 1");
        }
    }

    #[tokio::test]
    async fn test_process_pending_requests_timeout() {
        let mut mock_fulfiller = MockFulfiller::new();
        let start_time = 1000u64;
        let request = create_test_request(1, start_time - 100, MOCK_PROVIDER_ADDRESS);

        // Setup fulfillment to always fail
        mock_fulfiller
            .expect_fulfill_request()
            .returning(|_, _, _| anyhow::bail!("Simulated persistent failure"));

        let mut keeper = create_test_keeper_state(Some(mock_fulfiller));
        keeper.update(vec![request.clone()]).await;

        // Process with current time
        keeper.process_pending_requests(start_time).await;

        // Verify task failed but is still eligible for retry
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        keeper.process_pending_requests(start_time).await;
        {
            let pending = keeper.pending_requests.read().await;
            let task = pending.get(&request).unwrap();
            assert!(!task.success);
            assert_eq!(task.retries, 1);
        }

        // Now process with a time that exceeds the timeout
        let timeout_time = start_time + keeper.failure_timeout_seconds + 10;
        keeper.process_pending_requests(timeout_time).await;

        // Task should not be retried due to timeout, but should still be in the map
        {
            let pending = keeper.pending_requests.read().await;
            let task = pending.get(&request).unwrap();
            assert!(!task.success);
            // Retries should still be 1 since no new attempt was made due to timeout
            assert_eq!(task.retries, 1);
        }
    }
}
