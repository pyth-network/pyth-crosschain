use {
    crate::actors::{
        chain_price_listener::ChainPriceListener,
        price_pusher::PricePusher,
        pyth_price_listener::PythPriceListener,
        subscription_listener::SubscriptionListener,
        types::*,
    },
    anyhow::Result,
    ractor::{cast, spawn_linked, Actor, ActorCell, ActorProcessingErr, ActorRef},
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
        time::Duration,
    },
    tokio::sync::watch,
    tokio::time,
    tracing,
};

pub struct ControllerState {
    chain_id: String,
    subscription_listener: ActorRef<SubscriptionListenerMessage>,
    pyth_price_listener: ActorRef<PythPriceListenerMessage>,
    chain_price_listener: ActorRef<ChainPriceListenerMessage>,
    price_pusher: ActorRef<PricePusherMessage>,
    subscription_contract: Arc<dyn ReadChainSubscriptions + Send + Sync>,
    hermes_client: Arc<dyn StreamPythPrices + Send + Sync>,
    chain_price_contract: Arc<dyn GetChainPrices + Send + Sync>,
    price_pusher_contract: Arc<dyn UpdateChainPrices + Send + Sync>,
    pyth_price_client: Arc<dyn GetPythPrices + Send + Sync>,
    subscription_poll_interval: Duration,
    chain_price_poll_interval: Duration,
    update_interval: Duration,
    backoff_policy: backoff::ExponentialBackoff,
    update_loop_running: bool,
    stop_sender: Option<watch::Sender<bool>>,
    active_subscriptions: HashMap<SubscriptionId, Subscription>,
    feed_ids: HashSet<PriceId>,
}

pub struct Controller;
impl Actor for Controller {
    type Msg = ControllerMessage;
    type State = ControllerState;
    type Arguments = (
        String,
        ActorRef<SubscriptionListenerMessage>,
        ActorRef<PythPriceListenerMessage>,
        ActorRef<ChainPriceListenerMessage>,
        ActorRef<PricePusherMessage>,
        Arc<dyn ReadChainSubscriptions + Send + Sync>,
        Arc<dyn StreamPythPrices + Send + Sync>,
        Arc<dyn GetChainPrices + Send + Sync>,
        Arc<dyn UpdateChainPrices + Send + Sync>,
        Arc<dyn GetPythPrices + Send + Sync>,
        Duration,
        Duration,
        Duration,
        backoff::ExponentialBackoff,
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
            subscription_contract,
            hermes_client,
            chain_price_contract,
            price_pusher_contract,
            pyth_price_client,
            subscription_poll_interval,
            chain_price_poll_interval,
            update_interval,
            backoff_policy,
        ): Self::Arguments,
    ) -> Result<Self::State, ActorProcessingErr> {
        let state = ControllerState {
            chain_id,
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            subscription_contract,
            hermes_client,
            chain_price_contract,
            price_pusher_contract,
            pyth_price_client,
            subscription_poll_interval,
            chain_price_poll_interval,
            update_interval,
            backoff_policy,
            update_loop_running: false,
            stop_sender: None,
            active_subscriptions: HashMap::new(),
            feed_ids: HashSet::new(),
        };

        cast!(myself, ControllerMessage::StartUpdateLoop)?;

        Ok(state)
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
                    let (tx, mut rx) = watch::channel(false);
                    state.stop_sender = Some(tx);

                    let update_interval = state.update_interval;
                    let myself_clone = myself.clone();
                    let chain_id_clone = state.chain_id.clone();

                    tokio::spawn(async move {
                        tracing::info!(chain_id = chain_id_clone, "Update loop task started");
                        let mut interval = time::interval(update_interval);

                        loop {
                            tokio::select! {
                                _ = interval.tick() => {
                                    if let Err(e) = cast!(myself_clone, ControllerMessage::CheckForUpdates) {
                                        tracing::error!(chain_id = chain_id_clone, error = %e, "Failed to check for updates");
                                    }
                                }
                                _ = rx.changed() => {
                                    if *rx.borrow() {
                                        tracing::info!(chain_id = chain_id_clone, "Update loop received stop signal.");
                                        break;
                                    }
                                }
                            }
                        }
                        tracing::info!(chain_id = chain_id_clone, "Update loop task finished");
                    });
                }
            }
            ControllerMessage::StopUpdateLoop => {
                if state.update_loop_running {
                    state.update_loop_running = false;
                    if let Some(sender) = state.stop_sender.take() {
                        let _ = sender.send(true);
                    }
                    tracing::info!(chain_id = state.chain_id, "Stop signal sent to update loop");
                } else {
                    tracing::warn!(
                        chain_id = state.chain_id,
                        "StopUpdateLoop called but loop was not running."
                    );
                }
            }
            ControllerMessage::CheckForUpdates => {
                tracing::debug!(chain_id = state.chain_id, "Received CheckForUpdates");
                
                if let Ok(subscriptions) = cast!(state.subscription_listener, SubscriptionListenerMessage::GetActiveSubscriptions) {
                    state.active_subscriptions = subscriptions;
                    
                    let mut feed_ids = HashSet::new();
                    for subscription in state.active_subscriptions.values() {
                        for price_id in &subscription.price_ids {
                            feed_ids.insert(*price_id);
                        }
                    }
                    
                    if state.feed_ids != feed_ids {
                        state.feed_ids = feed_ids.clone();
                        
                        if let Err(e) = cast!(state.pyth_price_listener, PythPriceListenerMessage::UpdateFeedIdSet(feed_ids.clone())) {
                            tracing::error!(chain_id = state.chain_id, error = %e, "Failed to update feed ID set in PythPriceListener");
                        }
                        
                        if let Err(e) = cast!(state.chain_price_listener, ChainPriceListenerMessage::UpdateFeedIdSet(feed_ids)) {
                            tracing::error!(chain_id = state.chain_id, error = %e, "Failed to update feed ID set in ChainPriceListener");
                        }
                    }
                    
                    let current_time = chrono::Utc::now().timestamp() as u64;
                    for subscription in state.active_subscriptions.values() {
                        if !subscription.is_active {
                            continue;
                        }
                        
                        let mut needs_update = false;
                        
                        if subscription.update_criteria.update_on_heartbeat {
                            let heartbeat_seconds = subscription.update_criteria.heartbeat_seconds as u64;
                            if current_time - subscription.last_updated_at >= heartbeat_seconds {
                                needs_update = true;
                            }
                        }
                        
                        if !needs_update && subscription.update_criteria.update_on_deviation {
                        }
                        
                        if needs_update {
                            let push_request = PushRequest {
                                subscription_id: subscription.id,
                                price_ids: subscription.price_ids.clone(),
                            };
                            
                            if let Err(e) = cast!(state.price_pusher, PricePusherMessage::PushPriceUpdates(push_request)) {
                                tracing::error!(chain_id = state.chain_id, error = %e, "Failed to push price updates");
                            }
                        }
                    }
                } else {
                    tracing::error!(chain_id = state.chain_id, "Failed to get active subscriptions");
                }
            }
            ControllerMessage::SupervisionEvent(event) => {
                match event {
                    SupervisionEvent::ActorStarted(actor_cell) => {
                        tracing::info!(
                            chain_id = state.chain_id,
                            actor_id = %actor_cell.get_id(),
                            "Actor started"
                        );
                    }
                    SupervisionEvent::ActorTerminated(actor_cell, _, reason) => {
                        let actor_id = actor_cell.get_id();
                        tracing::warn!(
                            chain_id = state.chain_id,
                            actor_id = %actor_id,
                            reason = ?reason,
                            "Actor terminated"
                        );
                        
                        if let Some(name) = actor_id.name() {
                            match name.as_str() {
                                "SubscriptionListener" => {
                                    cast!(myself, ControllerMessage::RestartSubscriptionListener)?;
                                }
                                "PythPriceListener" => {
                                    cast!(myself, ControllerMessage::RestartPythPriceListener)?;
                                }
                                "ChainPriceListener" => {
                                    cast!(myself, ControllerMessage::RestartChainPriceListener)?;
                                }
                                "PricePusher" => {
                                    cast!(myself, ControllerMessage::RestartPricePusher)?;
                                }
                                _ => {
                                    tracing::error!(
                                        chain_id = state.chain_id,
                                        actor_name = name,
                                        "Unknown actor terminated"
                                    );
                                }
                            }
                        }
                    }
                    SupervisionEvent::ActorFailed(actor_cell, error) => {
                        let actor_id = actor_cell.get_id();
                        tracing::error!(
                            chain_id = state.chain_id,
                            actor_id = %actor_id,
                            error = ?error,
                            "Actor failed"
                        );
                        
                        if let Some(name) = actor_id.name() {
                            match name.as_str() {
                                "SubscriptionListener" => {
                                    cast!(myself, ControllerMessage::RestartSubscriptionListener)?;
                                }
                                "PythPriceListener" => {
                                    cast!(myself, ControllerMessage::RestartPythPriceListener)?;
                                }
                                "ChainPriceListener" => {
                                    cast!(myself, ControllerMessage::RestartChainPriceListener)?;
                                }
                                "PricePusher" => {
                                    cast!(myself, ControllerMessage::RestartPricePusher)?;
                                }
                                _ => {
                                    tracing::error!(
                                        chain_id = state.chain_id,
                                        actor_name = name,
                                        "Unknown actor failed"
                                    );
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            ControllerMessage::RestartSubscriptionListener => {
                tracing::info!(chain_id = state.chain_id, "Restarting SubscriptionListener");
                let (new_actor, _) = spawn_linked(
                    Some("SubscriptionListener".to_string()),
                    SubscriptionListener,
                    (
                        state.chain_id.clone(),
                        state.subscription_contract.clone(),
                        state.subscription_poll_interval,
                    ),
                    myself.get_cell(),
                )
                .await
                .map_err(|e| {
                    tracing::error!(
                        chain_id = state.chain_id,
                        error = %e,
                        "Failed to restart SubscriptionListener"
                    );
                    ActorProcessingErr::Unhandled(Box::new(e))
                })?;
                
                state.subscription_listener = new_actor;
            }
            ControllerMessage::RestartPythPriceListener => {
                tracing::info!(chain_id = state.chain_id, "Restarting PythPriceListener");
                let (new_actor, _) = spawn_linked(
                    Some("PythPriceListener".to_string()),
                    PythPriceListener,
                    (
                        state.chain_id.clone(),
                        state.hermes_client.clone(),
                    ),
                    myself.get_cell(),
                )
                .await
                .map_err(|e| {
                    tracing::error!(
                        chain_id = state.chain_id,
                        error = %e,
                        "Failed to restart PythPriceListener"
                    );
                    ActorProcessingErr::Unhandled(Box::new(e))
                })?;
                
                state.pyth_price_listener = new_actor;
            }
            ControllerMessage::RestartChainPriceListener => {
                tracing::info!(chain_id = state.chain_id, "Restarting ChainPriceListener");
                let (new_actor, _) = spawn_linked(
                    Some("ChainPriceListener".to_string()),
                    ChainPriceListener,
                    (
                        state.chain_id.clone(),
                        state.chain_price_contract.clone(),
                        state.chain_price_poll_interval,
                    ),
                    myself.get_cell(),
                )
                .await
                .map_err(|e| {
                    tracing::error!(
                        chain_id = state.chain_id,
                        error = %e,
                        "Failed to restart ChainPriceListener"
                    );
                    ActorProcessingErr::Unhandled(Box::new(e))
                })?;
                
                state.chain_price_listener = new_actor;
            }
            ControllerMessage::RestartPricePusher => {
                tracing::info!(chain_id = state.chain_id, "Restarting PricePusher");
                let (new_actor, _) = spawn_linked(
                    Some("PricePusher".to_string()),
                    PricePusher,
                    (
                        state.chain_id.clone(),
                        state.price_pusher_contract.clone(),
                        state.pyth_price_client.clone(),
                        state.backoff_policy.clone(),
                    ),
                    myself.get_cell(),
                )
                .await
                .map_err(|e| {
                    tracing::error!(
                        chain_id = state.chain_id,
                        error = %e,
                        "Failed to restart PricePusher"
                    );
                    ActorProcessingErr::Unhandled(Box::new(e))
                })?;
                
                state.price_pusher = new_actor;
            }
            ControllerMessage::UpdateActorRefs(
                subscription_listener,
                pyth_price_listener,
                chain_price_listener,
                price_pusher,
            ) => {
                tracing::info!(chain_id = state.chain_id, "Updating actor references");
                state.subscription_listener = subscription_listener;
                state.pyth_price_listener = pyth_price_listener;
                state.chain_price_listener = chain_price_listener;
                state.price_pusher = price_pusher;
            }
        }
        Ok(())
    }
}
