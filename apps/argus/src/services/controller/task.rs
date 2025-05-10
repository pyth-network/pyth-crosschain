use {
    crate::shared::state::ArgusSharedState,
    anyhow::Result,
    std::{sync::Arc, time::Duration},
    tokio::{sync::watch, time},
    tracing,
};

pub struct TaskController {
    chain_id: String,
    shared_state: Arc<ArgusSharedState>,
    update_interval: Duration,
    stop_sender: watch::Sender<bool>,
    stop_receiver: watch::Receiver<bool>,
}

impl TaskController {
    pub fn new(chain_id: String, shared_state: Arc<ArgusSharedState>, update_interval: Duration) -> Self {
        let (stop_sender, stop_receiver) = watch::channel(false);
        Self {
            chain_id,
            shared_state,
            update_interval,
            stop_sender,
            stop_receiver,
        }
    }

    pub fn stop_token(&self) -> watch::Receiver<bool> {
        self.stop_receiver.clone()
    }

    pub fn shutdown(&self) {
        let _ = self.stop_sender.send(true);
    }

    pub async fn start_update_loop(&self) -> Result<()> {
        let mut interval = time::interval(self.update_interval);
        let mut stop_receiver = self.stop_receiver.clone();

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = self.perform_update().await {
                        tracing::error!(
                            chain_id = self.chain_id,
                            error = %e,
                            "Error performing update"
                        );
                    }
                }
                _ = stop_receiver.changed() => {
                    if *stop_receiver.borrow() {
                        tracing::info!(chain_id = self.chain_id, "Stopping controller update loop");
                        break;
                    }
                }
            }
        }

        Ok(())
    }

    async fn perform_update(&self) -> Result<()> {
        tracing::info!(chain_id = self.chain_id, "Performing update (todo)");
        Ok(())
    }
}
