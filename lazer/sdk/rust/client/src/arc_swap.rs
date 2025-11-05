use {
    anyhow::Context as _,
    arc_swap::ArcSwap,
    futures::Stream,
    futures_util::StreamExt as _,
    std::sync::Arc,
    tracing::{info, Instrument as _},
};

#[async_trait::async_trait]
pub trait StreamIntoAutoUpdatedHandle: Stream + Unpin + Sized + 'static
where
    Self::Item: Send + Sync,
{
    /// Create an `ArcSwap` that provides access to the most recent value produced by the stream.
    async fn into_auto_updated_handle(mut self) -> anyhow::Result<Arc<ArcSwap<Self::Item>>> {
        let first_value = self
            .next()
            .await
            .context("cannot create auto updated handle from empty stream")?;
        let handle = Arc::new(ArcSwap::new(Arc::new(first_value)));
        let weak_handle = Arc::downgrade(&handle);
        tokio::spawn(
            async move {
                while let Some(value) = self.next().await {
                    let Some(handle) = weak_handle.upgrade() else {
                        info!("handle dropped, stopping auto handle update task");
                        return;
                    };
                    handle.store(Arc::new(value));
                }
            }
            .in_current_span(),
        );
        Ok(handle)
    }
}

impl<T: Stream + Unpin + 'static> StreamIntoAutoUpdatedHandle for T where T::Item: Send + Sync {}
