pub mod traits;

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock, Mutex};
use anyhow::Result;
use tokio::sync::watch;

use crate::adapters::types::{Price, PriceId, SubscriptionId};
use self::traits::*;

#[derive(Clone)]
pub struct SubscriptionParams {
    pub price_feed_ids: Vec<PriceId>,
    pub heartbeat_seconds: u32,
    pub deviation_threshold_bps: u32,
}

#[derive(Clone)]
pub struct ArgusState {
    pub chain_id: String,
    subscription_state: Arc<SubscriptionState>,
    pyth_price_state: Arc<PythPriceState>,
    chain_price_state: Arc<ChainPriceState>,
    pub stop_sender: Arc<Mutex<Option<watch::Sender<bool>>>>,
}

impl ArgusState {
    pub fn new(chain_id: String) -> Self {
        Self {
            chain_id,
            subscription_state: Arc::new(SubscriptionState::new()),
            pyth_price_state: Arc::new(PythPriceState::new()),
            chain_price_state: Arc::new(ChainPriceState::new()),
            stop_sender: Arc::new(Mutex::new(None)),
        }
    }
    
    
    pub fn subscription_reader(&self) -> Arc<dyn ReadSubscriptionState> {
        self.subscription_state.clone()
    }
    
    pub fn subscription_writer(&self) -> Arc<dyn WriteSubscriptionState> {
        self.subscription_state.clone()
    }
    
    pub fn pyth_price_reader(&self) -> Arc<dyn ReadPythPriceState> {
        self.pyth_price_state.clone()
    }
    
    pub fn pyth_price_writer(&self) -> Arc<dyn WritePythPriceState> {
        self.pyth_price_state.clone()
    }
    
    pub fn chain_price_reader(&self) -> Arc<dyn ReadChainPriceState> {
        self.chain_price_state.clone()
    }
    
    pub fn chain_price_writer(&self) -> Arc<dyn WriteChainPriceState> {
        self.chain_price_state.clone()
    }
    
    pub fn system_control(&self) -> Arc<dyn SystemControl> {
        Arc::new(SystemController {
            stop_sender: self.stop_sender.clone(),
        })
    }
    
    pub fn setup_stop_channel(&self) -> watch::Receiver<bool> {
        let (tx, rx) = watch::channel(false);
        let mut stop_sender = self.stop_sender.lock().expect("Mutex poisoned");
        *stop_sender = Some(tx);
        rx
    }
}

pub struct SubscriptionState {
    subscriptions: RwLock<HashMap<SubscriptionId, SubscriptionParams>>,
}

impl SubscriptionState {
    pub fn new() -> Self {
        Self {
            subscriptions: RwLock::new(HashMap::new()),
        }
    }
}

impl ReadSubscriptionState for SubscriptionState {
    fn get_subscriptions(&self) -> HashMap<SubscriptionId, SubscriptionParams> {
        self.subscriptions.read().expect("RwLock poisoned").clone()
    }

    fn get_subscription(&self, id: &SubscriptionId) -> Option<SubscriptionParams> {
        self.subscriptions
            .read()
            .expect("RwLock poisoned")
            .get(id)
            .cloned()
    }

    fn get_feed_ids(&self) -> HashSet<PriceId> {
        let subscriptions = self.subscriptions.read().expect("RwLock poisoned");
        let mut feed_ids = HashSet::new();
        
        for (_, params) in subscriptions.iter() {
            for feed_id in &params.price_feed_ids {
                feed_ids.insert(*feed_id);
            }
        }
        
        feed_ids
    }
}

impl WriteSubscriptionState for SubscriptionState {
    fn update_subscriptions(
        &self,
        subscriptions: HashMap<SubscriptionId, SubscriptionParams>,
    ) {
        let mut lock = self.subscriptions.write().expect("RwLock poisoned");
        *lock = subscriptions;
    }
}

pub struct PythPriceState {
    prices: RwLock<HashMap<PriceId, Price>>,
    feed_ids: RwLock<HashSet<PriceId>>,
}

impl PythPriceState {
    pub fn new() -> Self {
        Self {
            prices: RwLock::new(HashMap::new()),
            feed_ids: RwLock::new(HashSet::new()),
        }
    }
}

impl ReadPythPriceState for PythPriceState {
    fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        self.prices
            .read()
            .expect("RwLock poisoned")
            .get(feed_id)
            .cloned()
    }

    fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.feed_ids.read().expect("RwLock poisoned").clone()
    }
}

impl WritePythPriceState for PythPriceState {
    fn update_price(&self, feed_id: PriceId, price: Price) {
        let mut prices = self.prices.write().expect("RwLock poisoned");
        prices.insert(feed_id, price);
    }

    fn update_prices(&self, prices: HashMap<PriceId, Price>) {
        let mut lock = self.prices.write().expect("RwLock poisoned");
        lock.extend(prices);
    }

    fn update_feed_ids(&self, feed_ids: HashSet<PriceId>) {
        let mut lock = self.feed_ids.write().expect("RwLock poisoned");
        *lock = feed_ids;
    }
}

pub struct ChainPriceState {
    prices: RwLock<HashMap<PriceId, Price>>,
    feed_ids: RwLock<HashSet<PriceId>>,
}

impl ChainPriceState {
    pub fn new() -> Self {
        Self {
            prices: RwLock::new(HashMap::new()),
            feed_ids: RwLock::new(HashSet::new()),
        }
    }
}

impl ReadChainPriceState for ChainPriceState {
    fn get_price(&self, feed_id: &PriceId) -> Option<Price> {
        self.prices
            .read()
            .expect("RwLock poisoned")
            .get(feed_id)
            .cloned()
    }

    fn get_feed_ids(&self) -> HashSet<PriceId> {
        self.feed_ids.read().expect("RwLock poisoned").clone()
    }
}

impl WriteChainPriceState for ChainPriceState {
    fn update_price(&self, feed_id: PriceId, price: Price) {
        let mut prices = self.prices.write().expect("RwLock poisoned");
        prices.insert(feed_id, price);
    }

    fn update_prices(&self, prices: HashMap<PriceId, Price>) {
        let mut lock = self.prices.write().expect("RwLock poisoned");
        lock.extend(prices);
    }

    fn update_feed_ids(&self, feed_ids: HashSet<PriceId>) {
        let mut lock = self.feed_ids.write().expect("RwLock poisoned");
        *lock = feed_ids;
    }
}

struct SystemController {
    pub stop_sender: Arc<Mutex<Option<watch::Sender<bool>>>>,
}

impl SystemControl for SystemController {
    fn signal_shutdown(&self) -> Result<()> {
        let sender = self.stop_sender.lock().expect("Mutex poisoned");
        if let Some(sender) = &*sender {
            sender.send(true)?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Stop sender not initialized"))
        }
    }
}
