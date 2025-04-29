use {
    crate::actors::types::*,
    anyhow::Result,
    ractor::{call, call_t, Actor, ActorProcessingErr, ActorRef},
    std::{
        collections::{HashMap, HashSet},
        sync::Arc,
        time::Duration,
    },
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
                        while let Ok(ControllerResponse::UpdateLoopStarted) =
                            call_t!(myself_clone, ControllerMessage::StartUpdateLoop).await
                        {
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
                match call_t!(
                    state.subscription_listener,
                    SubscriptionListenerMessage::GetActiveSubscriptions
                )
                .await
                {
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

                            let msg_builder =
                                PythPriceListenerMessage::UpdateFeedIdSet(feed_ids.clone());
                            let _ = state.pyth_price_listener.cast(msg_builder);

                            let _ = call_t!(
                                state.chain_price_listener,
                                ChainPriceListenerMessage::UpdateFeedIdSet(feed_ids)
                            )
                            .await;
                        }

                        for (subscription_id, subscription) in &state.active_subscriptions {
                            if state.should_update_subscription(subscription).await {
                                let push_request = PushRequest {
                                    subscription_id: *subscription_id,
                                    price_ids: subscription.price_ids.clone(),
                                };

                                let _ = state
                                    .price_pusher
                                    .cast(PricePusherMessage::PushPriceUpdates(push_request));
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
}

impl Controller {
    async fn should_update_subscription(&self, subscription: &Subscription) -> bool {
        true
    }
}
