use {
    anyhow::Result,
    axum::async_trait,
    ethers::{
        middleware::{Middleware, MiddlewareError},
        prelude::{BlockId, PendingTransaction},
        providers::JsonRpcClient,
        types::{transaction::eip2718::TypedTransaction, BlockNumber, Filter, Log, U256},
    },
    thiserror::Error,
    tracing,
};

#[derive(Clone, Debug)]
pub struct FailoverMiddleware<M> {
    middlewares: Vec<M>,
    current_idx: usize,
}

impl<M> FailoverMiddleware<M> {
    pub fn new(middlewares: Vec<M>) -> Self {
        if middlewares.is_empty() {
            panic!("FailoverMiddleware requires at least one middleware");
        }
        
        Self {
            middlewares,
            current_idx: 0,
        }
    }
    
    fn current(&self) -> &M {
        &self.middlewares[self.current_idx]
    }
    
    async fn with_failover<F, Fut, R>(&self, operation: F) -> Result<R, FailoverMiddlewareError<M>>
    where
        F: Fn(&M) -> Fut + Clone,
        Fut: std::future::Future<Output = Result<R, <M as Middleware>::Error>>,
        M: Middleware,
    {
        let mut last_error = None;
        
        for (idx, middleware) in self.middlewares.iter().enumerate() {
            match operation(middleware).await {
                Ok(result) => {
                    if idx > self.current_idx {
                        tracing::info!(
                            "Successfully used fallback RPC endpoint {} after primary endpoint failure",
                            idx
                        );
                    }
                    return Ok(result);
                }
                Err(err) => {
                    tracing::warn!(
                        "RPC endpoint {} failed with error: {:?}. Trying next endpoint if available.",
                        idx,
                        err
                    );
                    last_error = Some(FailoverMiddlewareError::MiddlewareError(err));
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| {
            FailoverMiddlewareError::NoMiddlewares
        }))
    }
}

#[derive(Error, Debug)]
pub enum FailoverMiddlewareError<M: Middleware> {
    #[error("{0}")]
    MiddlewareError(M::Error),
    
    #[error("No middlewares available")]
    NoMiddlewares,
}

impl<M: Middleware> MiddlewareError for FailoverMiddlewareError<M> {
    type Inner = M::Error;

    fn from_err(src: M::Error) -> Self {
        FailoverMiddlewareError::MiddlewareError(src)
    }

    fn as_inner(&self) -> Option<&Self::Inner> {
        match self {
            FailoverMiddlewareError::MiddlewareError(e) => Some(e),
            _ => None,
        }
    }
}

#[async_trait]
impl<M: Middleware> Middleware for FailoverMiddleware<M> {
    type Error = FailoverMiddlewareError<M>;
    type Provider = M::Provider;
    type Inner = M;
    
    fn inner(&self) -> &M {
        self.current()
    }
    
    
    async fn send_transaction<T: Into<TypedTransaction> + Send + Sync>(
        &self,
        tx: T,
        block: Option<BlockId>,
    ) -> Result<PendingTransaction<'_, Self::Provider>, Self::Error> {
        let tx = tx.into();
        self.with_failover(|middleware| middleware.send_transaction(tx.clone(), block))
            .await
    }
    
    async fn get_block_number(&self) -> Result<U256, Self::Error> {
        self.with_failover(|middleware| middleware.get_block_number()).await
    }
    
    async fn get_logs(&self, filter: &Filter) -> Result<Vec<Log>, Self::Error> {
        self.with_failover(|middleware| middleware.get_logs(filter)).await
    }
    
    async fn fill_transaction(
        &self,
        tx: &mut TypedTransaction,
        block: Option<BlockId>,
    ) -> Result<(), Self::Error> {
        self.with_failover(|middleware| middleware.fill_transaction(tx, block)).await
    }
}
