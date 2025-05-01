use {
    crate::actors::types::*,
    anyhow::Result,
    ractor::{cast, Actor, ActorProcessingErr, ActorRef},
    std::{
        collections::{HashMap, HashSet},
        time::Duration,
    },
    tokio::sync::watch,
    tokio::time,
    tracing,
};

#[allow(dead_code)]
pub struct ControllerState {
    chain_id: String,
    subscription_listener: ActorRef<SubscriptionListenerMessage>,
    pyth_price_listener: ActorRef<PythPriceListenerMessage>,
    chain_price_listener: ActorRef<ChainPriceListenerMessage>,
    price_pusher: ActorRef<PricePusherMessage>,
    update_interval: Duration,
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
        let state = ControllerState {
            chain_id,
            subscription_listener,
            pyth_price_listener,
            chain_price_listener,
            price_pusher,
            update_interval,
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
                todo!()
            }
        }
        Ok(())
    }
}
