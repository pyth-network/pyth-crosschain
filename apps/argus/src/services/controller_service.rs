//! Controller Service
//!
//! This service orchestrates the price update process for a given blockchain network.
//! It reads from the SubscriptionState, PythPriceState, and ChainPriceState to determine
//! whether to update the on-chain price for a given subscription. It also triggers the
//! PricePusherService to push the update to the target blockchain network.

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, watch};
use tokio::time;
use tracing;

use crate::adapters::ethereum::UpdateCriteria;
use crate::adapters::types::{PriceId, SubscriptionId};
use crate::services::types::PushRequest;
use crate::services::Service;
use crate::state::ChainName;
use crate::state::{ChainPriceState, PythPriceState, SubscriptionState};
use pyth_sdk::Price;

pub struct ControllerService {
    name: String,
    chain_name: ChainName,
    update_interval: Duration,
    subscription_state: Arc<SubscriptionState>,
    pyth_price_state: Arc<PythPriceState>,
    chain_price_state: Arc<ChainPriceState>,
    price_pusher_tx: mpsc::Sender<PushRequest>,
}

impl ControllerService {
    pub fn new(
        chain_name: ChainName,
        update_interval: Duration,
        subscription_state: Arc<SubscriptionState>,
        pyth_price_state: Arc<PythPriceState>,
        chain_price_state: Arc<ChainPriceState>,
        price_pusher_tx: mpsc::Sender<PushRequest>,
    ) -> Self {
        Self {
            name: format!("ControllerService-{}", chain_name),
            chain_name,
            update_interval,
            subscription_state,
            pyth_price_state,
            chain_price_state,
            price_pusher_tx,
        }
    }

    #[tracing::instrument(skip_all, fields(task = self.name, chain_name = self.chain_name))]
    async fn perform_update(&self) -> Result<()> {
        let subscriptions = self.subscription_state.get_subscriptions();

        tracing::debug!(
            service = self.name,
            subscription_count = subscriptions.len(),
            "Checking subscriptions for updates"
        );

        for item in subscriptions.iter() {
            let sub_id = item.key().clone();
            let params = item.value().clone();
            let price_ids: Vec<PriceId> = params
                .price_ids
                .iter()
                .map(|id| PriceId::new(*id))
                .collect();

            // Check each feed until we find one that needs updating
            for feed_id in price_ids.iter() {
                let pyth_price_opt = self.pyth_price_state.get_price(&feed_id);
                let chain_price_opt = self.chain_price_state.get_price(&sub_id, &feed_id);

                if pyth_price_opt.is_none() {
                    tracing::warn!("No Pyth price found for feed, skipping");
                    continue;
                }

                let pyth_price = pyth_price_opt.as_ref().unwrap();

                if needs_update(
                    pyth_price,
                    chain_price_opt.as_ref(),
                    &params.update_criteria,
                ) {
                    // If any feed needs updating, trigger update for all feeds in this subscription
                    // and move on to next subscription
                    self.trigger_update(sub_id, price_ids.clone()).await?;
                    break;
                }
            }
        }
        Ok(())
    }

    async fn trigger_update(
        &self,
        subscription_id: SubscriptionId,
        price_ids: Vec<PriceId>,
    ) -> Result<()> {
        tracing::info!(
            service = self.name,
            subscription_id = subscription_id.to_string(),
            feed_count = price_ids.len(),
            "Triggering price update"
        );

        let request = PushRequest {
            subscription_id,
            price_ids,
        };

        tracing::debug!(
            service = self.name,
            "Would push update for subscription {}",
            subscription_id
        );

        self.price_pusher_tx.send(request).await?;

        Ok(())
    }
}

#[async_trait]
impl Service for ControllerService {
    fn name(&self) -> &str {
        &self.name
    }

    async fn start(&self, mut stop_rx: watch::Receiver<bool>) -> Result<()> {
        let mut interval = time::interval(self.update_interval);

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = self.perform_update().await {
                        tracing::error!(
                            service = self.name,
                            error = %e,
                            "Failed to perform price update"
                        );
                    }
                }
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        tracing::info!(
                            service = self.name,
                            "Stopping controller service"
                        );
                        break;
                    }
                }
            }
        }

        Ok(())
    }
}

/// Determines if an on-chain price update is needed based on the latest Pyth price,
/// the current on-chain price (if available), and the subscription's update criteria.
#[tracing::instrument()]
fn needs_update(
    pyth_price: &Price,
    chain_price_opt: Option<&Price>,
    update_criteria: &UpdateCriteria,
) -> bool {
    // If there's no price currently on the chain for this feed, an update is always needed.
    let chain_price = match chain_price_opt {
        None => {
            tracing::debug!("Update criteria met: No chain price available.");
            return true;
        }
        Some(cp) => cp,
    };

    // 1. Heartbeat Check:
    // Updates if `update_on_heartbeat` is enabled and the Pyth price is newer than or equal to
    // the chain price plus `heartbeat_seconds`.
    if update_criteria.update_on_heartbeat {
        if pyth_price.publish_time
            >= chain_price.publish_time + (update_criteria.heartbeat_seconds as i64)
        {
            tracing::debug!(
                "Heartbeat criteria met: Pyth price is sufficiently newer or same age with met delta."
            );
            return true;
        }
    }

    // 2. Deviation Check:
    // If `update_on_deviation` is enabled, checks if the Pyth price has deviated from the chain price
    // by more than `deviation_threshold_bps`.
    // Example: If chain_price is 100 and deviation_threshold_bps is 50 (0.5%),
    // then threshold_value = (100 * 50) / 10000 = 0.5
    // This means a price difference of more than 0.5 would trigger an update
    if update_criteria.update_on_deviation {
        // Critical assumption: The `expo` fields of `pyth_price` and `chain_price` are identical,
        // since we directly compare the `price` fields.
        if chain_price.price == 0 {
            if pyth_price.price != 0 {
                tracing::debug!(
                    "Deviation criteria met: Chain price is 0, Pyth price is non-zero."
                );
                return true;
            }
        } else {
            let price_diff = pyth_price.price.abs_diff(chain_price.price);
            let threshold_val = (chain_price.price.abs() as u64
                * update_criteria.deviation_threshold_bps as u64)
                / 10000;

            if price_diff > threshold_val {
                tracing::debug!(
                    abs_price_diff = price_diff,
                    threshold = threshold_val,
                    "Deviation criteria met: Price difference exceeds threshold."
                );
                return true;
            }
        }
    }

    // If neither heartbeat nor deviation criteria were met.
    tracing::debug!("No update criteria met.");
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::ethereum::{SubscriptionParams, UpdateCriteria};
    use crate::state::{ChainPriceState, PythPriceState, SubscriptionState};
    use ethers::types::U256;
    use pyth_sdk::{Price, PriceIdentifier};
    use std::collections::HashMap;
    use std::time::Duration;
    use tokio::sync::mpsc;

    /// Helper to create a mock Price
    fn mock_price(price: i64, conf: u64, expo: i32, publish_time: i64) -> Price {
        Price {
            price,
            conf,
            expo,
            publish_time,
        }
    }

    /// Helper to create mock UpdateCriteria
    fn mock_criteria(
        update_on_heartbeat: bool,
        heartbeat_seconds: u32,
        update_on_deviation: bool,
        deviation_threshold_bps: u32,
    ) -> UpdateCriteria {
        UpdateCriteria {
            update_on_heartbeat,
            heartbeat_seconds,
            update_on_deviation,
            deviation_threshold_bps,
        }
    }

    /// Helper function to create a default SubscriptionParams for tests
    fn mock_subscription_params(
        price_ids_bytes: Vec<[u8; 32]>,
        update_criteria: UpdateCriteria,
    ) -> SubscriptionParams {
        SubscriptionParams {
            price_ids: price_ids_bytes,
            update_criteria,
            // Initialize all fields of SubscriptionParams
            reader_whitelist: vec![], // Default to empty list
            whitelist_enabled: false, // Default to false
            is_active: true,          // Default to true, important for processing in tests
            is_permanent: false,      // Default to false
        }
    }

    struct TestControllerSetup {
        controller: ControllerService,
        pyth_state: Arc<PythPriceState>,
        chain_state: Arc<ChainPriceState>,
        sub_state: Arc<SubscriptionState>,
        push_request_rx: mpsc::Receiver<PushRequest>,
    }

    fn setup_test_controller() -> TestControllerSetup {
        let sub_state = Arc::new(SubscriptionState::new());
        let pyth_state = Arc::new(PythPriceState::new());
        let chain_state = Arc::new(ChainPriceState::new());
        let (pusher_tx, push_request_rx) = mpsc::channel(10); // Small buffer for tests

        let controller = ControllerService::new(
            "test_chain".to_string(),
            Duration::from_millis(100), // Interval doesn't really matter for perform_update direct call
            sub_state.clone(),
            pyth_state.clone(),
            chain_state.clone(),
            pusher_tx,
        );

        TestControllerSetup {
            controller,
            pyth_state,
            chain_state,
            sub_state,
            push_request_rx,
        }
    }

    #[tokio::test]
    async fn test_perform_update_no_subscriptions() {
        let TestControllerSetup {
            controller,
            mut push_request_rx,
            ..
        } = setup_test_controller();

        controller
            .perform_update()
            .await
            .expect("perform_update should not fail");

        // Expect no requests to be sent
        assert!(
            push_request_rx.try_recv().is_err(),
            "Should be no push requests if no subscriptions"
        );
    }

    #[tokio::test]
    async fn test_perform_update_subscription_no_feed_ids() {
        let TestControllerSetup {
            controller,
            sub_state,
            mut push_request_rx,
            ..
        } = setup_test_controller();

        let sub_id = U256::from(1);
        let criteria = mock_criteria(true, 60, true, 100);
        let params = mock_subscription_params(vec![], criteria); // Empty feed_ids

        let mut subs_map = HashMap::new();
        subs_map.insert(sub_id, params);
        sub_state.update_subscriptions(subs_map);

        controller
            .perform_update()
            .await
            .expect("perform_update should not fail");
        assert!(
            push_request_rx.try_recv().is_err(),
            "Should be no push requests if subscription has no feed IDs"
        );
    }

    #[tokio::test]
    async fn test_perform_update_single_sub_single_feed_update_needed_heartbeat() {
        let TestControllerSetup {
            controller,
            sub_state,
            pyth_state,
            chain_state,
            mut push_request_rx,
        } = setup_test_controller();

        let sub_id = U256::from(123);
        let feed_id_bytes = [1u8; 32];
        let feed_id = PriceIdentifier::new(feed_id_bytes);
        let criteria = mock_criteria(true, 60, false, 0); // Heartbeat only
        let params = mock_subscription_params(vec![feed_id_bytes], criteria);

        sub_state.update_subscriptions(HashMap::from([(sub_id, params)]));
        pyth_state.update_price(feed_id, mock_price(100, 10, -2, 1000)); // Pyth price @ t=1000
        chain_state.update_price(&sub_id, feed_id, mock_price(100, 10, -2, 900)); // Chain price @ t=900 (1000 >= 900 + 60)

        controller
            .perform_update()
            .await
            .expect("perform_update failed");

        let request = push_request_rx
            .recv()
            .await
            .expect("Should receive a PushRequest");
        assert_eq!(request.subscription_id, sub_id);
        assert_eq!(request.price_ids.len(), 1);
        assert_eq!(request.price_ids[0], feed_id);
        assert!(
            push_request_rx.try_recv().is_err(),
            "Should be no more requests"
        );
    }

    #[tokio::test]
    async fn test_perform_update_single_sub_single_feed_update_needed_deviation() {
        let TestControllerSetup {
            controller,
            sub_state,
            pyth_state,
            chain_state,
            mut push_request_rx,
        } = setup_test_controller();

        let sub_id = U256::from(456);
        let feed_id_bytes = [2u8; 32];
        let feed_id = PriceIdentifier::new(feed_id_bytes);
        let criteria = mock_criteria(false, 0, true, 100); // Deviation only, 100 bps = 1%
        let params = mock_subscription_params(vec![feed_id_bytes], criteria);

        sub_state.update_subscriptions(HashMap::from([(sub_id, params)]));
        pyth_state.update_price(feed_id, mock_price(102, 10, -2, 1000)); // Pyth price 102
        chain_state.update_price(&sub_id, feed_id, mock_price(100, 10, -2, 1000)); // Chain price 100. Diff 2 > (100*100)/10000=1

        controller
            .perform_update()
            .await
            .expect("perform_update failed");

        let request = push_request_rx
            .recv()
            .await
            .expect("Should receive a PushRequest");
        assert_eq!(request.subscription_id, sub_id);
        assert_eq!(request.price_ids.len(), 1);
        assert_eq!(request.price_ids[0], feed_id);
        assert!(
            push_request_rx.try_recv().is_err(),
            "Should be no more requests"
        );
    }

    #[tokio::test]
    async fn test_perform_update_single_sub_single_feed_no_update_needed() {
        let TestControllerSetup {
            controller,
            sub_state,
            pyth_state,
            chain_state,
            mut push_request_rx,
        } = setup_test_controller();

        let sub_id = U256::from(789);
        let feed_id_bytes = [3u8; 32];
        let feed_id = PriceIdentifier::new(feed_id_bytes);
        // Criteria: heartbeat 60s, deviation 100bps (1%)
        let criteria = mock_criteria(true, 60, true, 100);
        let params = mock_subscription_params(vec![feed_id_bytes], criteria);

        sub_state.update_subscriptions(HashMap::from([(sub_id, params)]));
        // Pyth price: t=950, val=100. Chain price: t=900, val=100
        // Heartbeat not met: 950 is not >= 900 + 60 (960)
        // Deviation not met: 100 vs 100 is 0 diff.
        pyth_state.update_price(feed_id, mock_price(100, 10, -2, 950));
        chain_state.update_price(&sub_id, feed_id, mock_price(100, 10, -2, 900));

        controller
            .perform_update()
            .await
            .expect("perform_update failed");
        assert!(
            push_request_rx.try_recv().is_err(),
            "Should be no push requests if no update needed"
        );
    }

    #[tokio::test]
    async fn test_perform_update_single_sub_multiple_feeds_mixed_updates() {
        let TestControllerSetup {
            controller,
            sub_state,
            pyth_state,
            chain_state,
            mut push_request_rx,
        } = setup_test_controller();

        let sub_id = U256::from(111);
        let feed1_bytes = [11u8; 32];
        let feed1_id = PriceIdentifier::new(feed1_bytes);
        let feed2_bytes = [22u8; 32];
        let feed2_id = PriceIdentifier::new(feed2_bytes);
        let feed3_bytes = [33u8; 32];
        let feed3_id = PriceIdentifier::new(feed3_bytes);

        let criteria = mock_criteria(true, 60, true, 100); // Heartbeat 60s, Dev 1%
        let params =
            mock_subscription_params(vec![feed1_bytes, feed2_bytes, feed3_bytes], criteria);
        sub_state.update_subscriptions(HashMap::from([(sub_id, params)]));

        // Feed 1: Needs update (heartbeat)
        pyth_state.update_price(feed1_id, mock_price(100, 10, -2, 1000));
        chain_state.update_price(&sub_id, feed1_id, mock_price(100, 10, -2, 900)); // 1000 >= 900 + 60

        // Feed 2: Needs update (deviation)
        pyth_state.update_price(feed2_id, mock_price(102, 10, -2, 950));
        chain_state.update_price(&sub_id, feed2_id, mock_price(100, 10, -2, 950)); // Diff 2 > 1 (1% of 100)

        // Feed 3: No update needed
        pyth_state.update_price(feed3_id, mock_price(100, 10, -2, 950));
        chain_state.update_price(&sub_id, feed3_id, mock_price(100, 10, -2, 900)); // No criteria met

        controller
            .perform_update()
            .await
            .expect("perform_update failed");

        let request = push_request_rx
            .recv()
            .await
            .expect("Should receive a PushRequest");
        assert_eq!(request.subscription_id, sub_id);
        assert_eq!(
            request.price_ids.len(),
            3,
            "Expected all 3 feeds to be in the request as one or more needed an update"
        );
        assert!(request.price_ids.contains(&feed1_id));
        assert!(request.price_ids.contains(&feed2_id));
        assert!(request.price_ids.contains(&feed3_id)); // Feed3 should now be included
        assert!(
            push_request_rx.try_recv().is_err(),
            "Should be no more requests"
        );
    }

    #[tokio::test]
    async fn test_perform_update_no_pyth_price_for_feed() {
        let TestControllerSetup {
            controller,
            sub_state,
            pyth_state,
            chain_state,
            mut push_request_rx,
        } = setup_test_controller();

        let sub_id = U256::from(222);
        let feed1_bytes = [44u8; 32]; // Pyth price will be missing for this one
        let feed1_id = PriceIdentifier::new(feed1_bytes);
        let feed2_bytes = [55u8; 32]; // This one will have Pyth price and need update
        let feed2_id = PriceIdentifier::new(feed2_bytes);

        let criteria = mock_criteria(true, 60, false, 0);
        let params = mock_subscription_params(vec![feed1_bytes, feed2_bytes], criteria);
        sub_state.update_subscriptions(HashMap::from([(sub_id, params)]));

        // No Pyth price for feed1_id
        // Pyth price for feed2_id, needs update by heartbeat
        pyth_state.update_price(feed2_id, mock_price(100, 10, -2, 1000));
        chain_state.update_price(&sub_id, feed2_id, mock_price(100, 10, -2, 900));
        // Optionally set chain price for feed1 too, though it won't matter without Pyth price
        chain_state.update_price(&sub_id, feed1_id, mock_price(200, 10, -2, 900));

        controller
            .perform_update()
            .await
            .expect("perform_update failed");

        let request = push_request_rx
            .recv()
            .await
            .expect("Should receive one PushRequest for feed2");
        assert_eq!(request.subscription_id, sub_id);
        assert_eq!(
            request.price_ids.len(),
            2, // Expecting both feeds from the subscription
            "Expected all feeds from the subscription to be in the request as one needed an update"
        );
        assert!(request.price_ids.contains(&feed1_id)); // The one with no pyth price initially
        assert!(request.price_ids.contains(&feed2_id)); // The one that triggered the update
        assert!(
            push_request_rx.try_recv().is_err(),
            "Should be no more requests"
        );
    }

    #[tokio::test]
    async fn test_perform_update_error_on_send() {
        let TestControllerSetup {
            controller,
            sub_state,
            pyth_state,
            chain_state,
            mut push_request_rx,
        } = setup_test_controller();

        let sub_id = U256::from(333);
        let feed_id_bytes = [66u8; 32];
        let feed_id = PriceIdentifier::new(feed_id_bytes);
        let criteria = mock_criteria(true, 60, false, 0);
        let params = mock_subscription_params(vec![feed_id_bytes], criteria);

        sub_state.update_subscriptions(HashMap::from([(sub_id, params)]));
        pyth_state.update_price(feed_id, mock_price(100, 10, -2, 1000));
        chain_state.update_price(&sub_id, feed_id, mock_price(100, 10, -2, 900));

        // Close the receiver end to simulate a send error
        push_request_rx.close();

        let result = controller.perform_update().await;
        assert!(
            result.is_err(),
            "perform_update should return an error if send fails"
        );
        // Further assertions on the specific error type could be added if desired
        // e.g., assert_matches!(result.unwrap_err().downcast_ref::<mpsc::error::SendError<PushRequest>>(), Some(_));
    }

    // ================================
    // UNIT TESTS FOR `needs_update`
    // ================================

    #[test]
    fn test_needs_update_no_chain_price() {
        let pyth_price = mock_price(100, 10, -2, 1000);
        let criteria = mock_criteria(true, 60, true, 100);
        assert!(needs_update(&pyth_price, None, &criteria));
    }

    #[test]
    fn test_needs_update_heartbeat_triggered() {
        let pyth_price = mock_price(100, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(true, 60, false, 0);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_heartbeat_not_triggered_too_soon() {
        let pyth_price = mock_price(100, 10, -2, 950);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(true, 60, false, 0);
        assert!(!needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_heartbeat_exact_time_triggered() {
        let pyth_price = mock_price(100, 10, -2, 960);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(true, 60, false, 0);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_heartbeat_disabled() {
        let pyth_price = mock_price(100, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(false, 60, false, 0);
        assert!(!needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_deviation_triggered_positive_diff() {
        let pyth_price = mock_price(105, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 1000);
        let criteria = mock_criteria(false, 0, true, 100);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_deviation_triggered_negative_diff() {
        let pyth_price = mock_price(95, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 1000);
        let criteria = mock_criteria(false, 0, true, 100);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_deviation_not_triggered_within_threshold() {
        let pyth_price = mock_price(100, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 1000);
        let criteria = mock_criteria(false, 0, true, 100);
        assert!(!needs_update(&pyth_price, Some(&chain_price), &criteria));

        let pyth_price_slight_dev = mock_price(1005, 10, -3, 1000);
        let chain_price_slight_dev = mock_price(1000, 10, -3, 1000);
        let criteria_5_percent = mock_criteria(false, 0, true, 500);
        assert!(!needs_update(
            &pyth_price_slight_dev,
            Some(&chain_price_slight_dev),
            &criteria_5_percent
        ));
    }

    #[test]
    fn test_needs_update_deviation_exact_threshold_not_triggered() {
        let pyth_price = mock_price(101, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 1000);
        let criteria = mock_criteria(false, 0, true, 100);
        assert!(!needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_deviation_disabled() {
        let pyth_price = mock_price(150, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 1000);
        let criteria = mock_criteria(false, 0, false, 100);
        assert!(!needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_deviation_chain_price_zero_pyth_nonzero() {
        let pyth_price = mock_price(10, 10, -2, 1000);
        let chain_price = mock_price(0, 0, -2, 1000);
        let criteria = mock_criteria(false, 0, true, 1000);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_deviation_both_prices_zero() {
        let pyth_price = mock_price(0, 0, -2, 1000);
        let chain_price = mock_price(0, 0, -2, 1000);
        let criteria = mock_criteria(false, 0, true, 100);
        assert!(!needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_heartbeat_and_deviation_triggered() {
        let pyth_price = mock_price(105, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(true, 60, true, 100);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_heartbeat_triggered_deviation_not_due_to_time() {
        let pyth_price = mock_price(100, 10, -2, 1000);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(true, 60, true, 100);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_deviation_triggered_heartbeat_not_due_to_price() {
        let pyth_price = mock_price(105, 10, -2, 950);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(true, 60, true, 100);
        assert!(needs_update(&pyth_price, Some(&chain_price), &criteria));
    }

    #[test]
    fn test_needs_update_neither_triggered() {
        let pyth_price = mock_price(100, 10, -2, 950);
        let chain_price = mock_price(100, 10, -2, 900);
        let criteria = mock_criteria(true, 60, true, 100);
        assert!(!needs_update(&pyth_price, Some(&chain_price), &criteria));
    }
}
