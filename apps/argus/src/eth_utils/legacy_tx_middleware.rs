use {
    axum::async_trait,
    ethers::{
        middleware::{Middleware, MiddlewareError},
        prelude::{BlockId, PendingTransaction, TransactionRequest},
        types::transaction::eip2718::TypedTransaction,
    },
    thiserror::Error,
};

/// Middleware that converts a transaction into a legacy transaction if use_legacy_tx is true.
/// We can not use TransformerMiddleware because keeper calls fill_transaction first which bypasses
/// the transformer.
#[derive(Clone, Debug)]
pub struct LegacyTxMiddleware<M> {
    use_legacy_tx: bool,
    inner: M,
}

impl<M> LegacyTxMiddleware<M> {
    pub fn new(use_legacy_tx: bool, inner: M) -> Self {
        Self {
            use_legacy_tx,
            inner,
        }
    }
}

#[derive(Error, Debug)]
pub enum LegacyTxMiddlewareError<M: Middleware> {
    #[error("{0}")]
    MiddlewareError(M::Error),
}

impl<M: Middleware> MiddlewareError for LegacyTxMiddlewareError<M> {
    type Inner = M::Error;

    fn from_err(src: M::Error) -> Self {
        LegacyTxMiddlewareError::MiddlewareError(src)
    }

    fn as_inner(&self) -> Option<&Self::Inner> {
        match self {
            LegacyTxMiddlewareError::MiddlewareError(e) => Some(e),
        }
    }
}

#[async_trait]
impl<M: Middleware> Middleware for LegacyTxMiddleware<M> {
    type Error = LegacyTxMiddlewareError<M>;
    type Provider = M::Provider;
    type Inner = M;
    fn inner(&self) -> &M {
        &self.inner
    }

    async fn send_transaction<T: Into<TypedTransaction> + Send + Sync>(
        &self,
        tx: T,
        block: Option<BlockId>,
    ) -> std::result::Result<PendingTransaction<'_, Self::Provider>, Self::Error> {
        let mut tx = tx.into();
        if self.use_legacy_tx {
            let legacy_request: TransactionRequest = tx.into();
            tx = legacy_request.into();
        }
        self.inner()
            .send_transaction(tx, block)
            .await
            .map_err(MiddlewareError::from_err)
    }

    async fn fill_transaction(
        &self,
        tx: &mut TypedTransaction,
        block: Option<BlockId>,
    ) -> std::result::Result<(), Self::Error> {
        if self.use_legacy_tx {
            let legacy_request: TransactionRequest = (*tx).clone().into();
            *tx = legacy_request.into();
        }
        self.inner()
            .fill_transaction(tx, block)
            .await
            .map_err(MiddlewareError::from_err)
    }
}
