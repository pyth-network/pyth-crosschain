use {
    crate::adapters::types::{PriceId, SubscriptionId},
    anyhow::Result,
    std::sync::Arc,
    tokio::sync::Mutex,
};

#[derive(Debug, Clone)]
pub struct PushRequest {
    pub subscription_id: SubscriptionId,
    pub price_ids: Vec<PriceId>,
}

pub struct PushQueue {
    requests: Mutex<Vec<PushRequest>>,
}

impl PushQueue {
    pub fn new() -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
        }
    }


    pub async fn get_all_requests(&self) -> Vec<PushRequest> {
        self.requests.lock().await.clone()
    }

    pub async fn is_empty(&self) -> bool {
        self.requests.lock().await.is_empty()
    }

    pub async fn len(&self) -> usize {
        self.requests.lock().await.len()
    }

    pub async fn peek(&self) -> Option<PushRequest> {
        let requests = self.requests.lock().await;
        requests.first().cloned()
    }


    pub async fn push(&self, request: PushRequest) -> Result<()> {
        let mut requests = self.requests.lock().await;
        requests.push(request);
        Ok(())
    }

    pub async fn pop(&self) -> Option<PushRequest> {
        let mut requests = self.requests.lock().await;
        if requests.is_empty() {
            None
        } else {
            Some(requests.remove(0))
        }
    }

    pub async fn clear(&self) -> Result<()> {
        let mut requests = self.requests.lock().await;
        requests.clear();
        Ok(())
    }

    pub async fn remove_for_subscription(&self, subscription_id: &SubscriptionId) -> Result<()> {
        let mut requests = self.requests.lock().await;
        requests.retain(|req| &req.subscription_id != subscription_id);
        Ok(())
    }
}
