use {
    crate::actors::types::*,
    anyhow::Result,
    ractor::{Actor, ActorProcessingErr, ActorRef, RpcReplyPort, call_t},
    std::{collections::{HashMap, HashSet}, sync::Arc, time::Duration},
    tokio::time,
    tracing,
};

pub struct Controller {
    chain_id: String,
    subscription_listener: ActorRef<SubscriptionListenerMessage>,
    pyth_price_listener: ActorRef<PythPriceListenerMessage>,
    chain_price_listener: ActorRef<ChainPriceListenerMessage>,
    price_pusher: ActorRef<PricePusherMessage>,
    update_interval: Duration,
    update_loop_running: bool,
    active_subscriptions: HashMap<SubscriptionId, Subscription>,
    feed_ids: HashSet<PriceId>,
}

impl Actor for Controller {
    type Msg = ControllerMessage;
    type State = Self;
    type Arguments = (
        String,
        ActorRef<SubscriptionListenerMessage>,
        ActorRef<PythPriceListenerMessage>,
        ActorRef<ChainPriceListenerMessage>,
        ActorRef<PricePusherMessage>,
        Duration,
    );

    async fn pre_start(
        &self,
        myself: ActorRef<Self::Msg>,
        (
            chain_id,
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            update_interval,
        ): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let controller = Controller {
            chain_id,
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            update_interval,
            update_loop_running: false,
            active_subscriptions: HashMap::new(),
            feed_ids: HashSet::new(),
        };

        let _ = myself.cast(ControllerMessage::StartUpdateLoop);

        Ok(controller)
    }

    async fn handle(
        &self,
        myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            ControllerMessage::StartUpdateLoop => {
                if !state.update_loop_running {
                    state.update_loop_running = true;
                    
                    let update_interval = state.update_interval;
                    let myself_clone = myself.clone();
                    tokio::spawn(async move {
                        let mut interval = time::interval(update_interval);
                        while let Ok(ControllerResponse::UpdateLoopStarted) = call_t!(myself_clone, ControllerMessage::StartUpdateLoop).await {
                            interval.tick().await;
                            let _ = myself_clone.cast(ControllerMessage::CheckForUpdates);
                        }
                    });
                    
                    tracing::info!(chain_id = state.chain_id, "Update loop started");
                }
            }
            ControllerMessage::StopUpdateLoop => {
                state.update_loop_running = false;
                tracing::info!(chain_id = state.chain_id, "Update loop stopped");
            }
            ControllerMessage::CheckForUpdates => {
                match call_t!(state.subscription_listener, SubscriptionListenerMessage::GetActiveSubscriptions).await {
                    Ok(SubscriptionListenerResponse::ActiveSubscriptions(subscriptions)) => {
                        state.active_subscriptions = subscriptions;
                        
                        let mut feed_ids = HashSet::new();
                        for subscription in state.active_subscriptions.values() {
                            for price_id in &subscription.price_ids {
                                feed_ids.insert(*price_id);
                            }
                        }
                        
                        if feed_ids != state.feed_ids {
                            state.feed_ids = feed_ids.clone();
                            
                            let _ = call_t!(state.pyth_price_listener, PythPriceListenerMessage::UpdateFeedIdSet(feed_ids.clone())).await;
                            
                            let _ = call_t!(state.chain_price_listener, ChainPriceListenerMessage::UpdateFeedIdSet(feed_ids)).await;
                        }
                        
                        for (subscription_id, subscription) in &state.active_subscriptions {
                            if state.should_update_subscription(subscription).await {
                                let push_request = PushRequest {
                                    subscription_id: *subscription_id,
                                    price_ids: subscription.price_ids.clone(),
                                };
                                
                                let _ = state.price_pusher.cast(PricePusherMessage::PushPriceUpdates(push_request));
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            chain_id = state.chain_id,
                            error = %e,
                            "Failed to get active subscriptions"
                        );
                    }
                    _ => {}
                }
            }
        }
        Ok(())
    }

    async fn handle_rpc(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        state: &mut Self::State,
        reply_port: RpcReplyPort<ControllerResponse>,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            ControllerMessage::StartUpdateLoop => {
                state.update_loop_running = true;
                let _ = reply_port.send(ControllerResponse::UpdateLoopStarted);
            }
            ControllerMessage::StopUpdateLoop => {
                state.update_loop_running = false;
                let _ = reply_port.send(ControllerResponse::UpdateLoopStopped);
            }
            ControllerMessage::CheckForUpdates => {
                let _ = reply_port.send(ControllerResponse::UpdateCheckResult(vec![]));
            }
        }
        Ok(())
    }
}

impl Controller {
    async fn should_update_subscription(&self, subscription: &Subscription) -> bool {
        if subscription.update_criteria.update_on_heartbeat {
            let current_time = chrono::Utc::now().timestamp() as u64;
            let time_since_last_update = current_time.saturating_sub(subscription.last_updated_at);
            
            if time_since_last_update >= subscription.update_criteria.heartbeat_seconds as u64 {
                tracing::info!(
                    chain_id = self.chain_id,
                    subscription_id = subscription.id,
                    time_since_last_update = time_since_last_update,
                    heartbeat_seconds = subscription.update_criteria.heartbeat_seconds,
                    "Subscription needs update due to heartbeat"
                );
                return true;
            }
        }
        
        if subscription.update_criteria.update_on_deviation {
            for price_id in &subscription.price_ids {
                let pyth_price = match call_t!(self.pyth_price_listener, PythPriceListenerMessage::GetLatestPrice(*price_id)).await {
                    Ok(PythPriceListenerResponse::LatestPrice(Some(price))) => price,
                    _ => continue,
                };
                
                let chain_price = match call_t!(self.chain_price_listener, ChainPriceListenerMessage::GetLatestPrice(*price_id)).await {
                    Ok(ChainPriceListenerResponse::LatestPrice(Some(price))) => price,
                    _ => continue,
                };
                
                let deviation = calculate_deviation(pyth_price.price, chain_price.price);
                
                if deviation >= subscription.update_criteria.deviation_threshold_bps as u64 {
                    tracing::info!(
                        chain_id = self.chain_id,
                        subscription_id = subscription.id,
                        price_id = hex::encode(price_id),
                        deviation = deviation,
                        threshold = subscription.update_criteria.deviation_threshold_bps,
                        "Subscription needs update due to price deviation"
                    );
                    return true;
                }
            }
        }
        
        false
    }
}

fn calculate_deviation(price1: i64, price2: i64) -> u64 {
    if price1 == 0 || price2 == 0 {
        return 0;
    }
    
    let price1_abs = price1.abs() as u64;
    let price2_abs = price2.abs() as u64;
    
    let diff = if price1_abs > price2_abs {
        price1_abs - price2_abs
    } else {
        price2_abs - price1_abs
    };
    
    let base = std::cmp::max(price1_abs, price2_abs);
    
    (diff * 10000) / base
}
