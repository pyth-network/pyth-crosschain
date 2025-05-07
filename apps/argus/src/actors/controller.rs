use {
    crate::{
        actors::types::*,
        adapters::types::{PriceId, Subscription, SubscriptionId},
    },
    anyhow::Result,
    ractor::{Actor, ActorProcessingErr, ActorRef},
    std::{
        collections::{HashMap, HashSet},
        time::Duration,
    },
    tokio::sync::watch,
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

        // Start the update loop
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(update_interval);
            loop {
                interval.tick().await;
                let _ = myself.cast(ControllerMessage::PerformUpdate);
            }
        });

        Ok(state)
    }

    async fn handle(
        &self,
        _myself: ActorRef<Self::Msg>,
        message: Self::Msg,
        _state: &mut Self::State,
    ) -> Result<(), ActorProcessingErr> {
        match message {
            ControllerMessage::PerformUpdate => {
                // Main processing logic. Keep active subscriptions up-to-date, check for price updates, and push them to the chain.
                todo!()
            }
        }
    }
}
