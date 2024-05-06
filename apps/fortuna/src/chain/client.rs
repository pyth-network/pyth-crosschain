use std::future::Future;
use std::pin::Pin;
use axum::async_trait;
use ethabi::ethereum_types::H256;
use ethers::middleware::MiddlewareError;
use ethers::prelude::{Block, BlockId, Middleware, TxHash};
use thiserror::Error;
use ethers::core::types::U64;

#[derive(Debug)]
pub struct MyMiddleware<M>(pub M);

#[derive(Error, Debug)]
pub enum MyError<M: Middleware> {
    #[error("{0}")]
    MiddlewareError(M::Error),
}

impl<M: Middleware> MiddlewareError for MyError<M> {
    type Inner = M::Error;

    fn from_err(src: M::Error) -> Self {
        MyError::MiddlewareError(src)
    }

    fn as_inner(&self) -> Option<&Self::Inner> {
        match self {
            MyError::MiddlewareError(e) => Some(e),
        }
    }
}

#[async_trait]
impl<M> Middleware for MyMiddleware<M>
where
    M: Middleware,
{
    type Error = MyError<M>;
    type Provider = M::Provider;
    type Inner = M;

    fn inner(&self) -> &M {
        &self.0
    }

    /// Gets the block at `block_hash_or_number` (transaction hashes only)
    async fn get_block<T: Into<BlockId> + Send + Sync>(
        &self,
        block_hash_or_number: T,
    ) -> Result<Option<Block<TxHash>>, Self::Error> {
        tracing::debug!("called");
        self.inner().get_block(block_hash_or_number).await.map_err(MiddlewareError::from_err)
    }
}
