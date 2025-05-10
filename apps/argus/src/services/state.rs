use {
    crate::services::{
        chain_price::ChainPriceState,
        price_pusher::{PushQueue, PushRequest},
        pyth_price::PythPriceState,
        subscription::SubscriptionState,
    },
    std::sync::Arc,
};

pub struct ArgusState {
    subscription_state: SubscriptionState,
    pyth_price_state: PythPriceState,
    chain_price_state: ChainPriceState,
    push_queue: PushQueue,
}

impl ArgusState {
    pub fn new() -> Self {
        Self {
            subscription_state: SubscriptionState::new(),
            pyth_price_state: PythPriceState::new(),
            chain_price_state: ChainPriceState::new(),
            push_queue: PushQueue::new(),
        }
    }

    pub fn subscription_state(&self) -> &SubscriptionState {
        &self.subscription_state
    }

    pub fn pyth_price_state(&self) -> &PythPriceState {
        &self.pyth_price_state
    }

    pub fn chain_price_state(&self) -> &ChainPriceState {
        &self.chain_price_state
    }

    pub fn push_queue(&self) -> &PushQueue {
        &self.push_queue
    }
}
