// This is a copy of the NonceManagerMiddleware from ethers-rs, with an additional reset method.
// Copied from: https://github.com/gakonst/ethers-rs/blob/34ed9e372e66235aed7074bc3f5c14922b139242/ethers-middleware/src/nonce_manager.rs

use {
    super::legacy_tx_middleware::LegacyTxMiddleware,
    axum::async_trait,
    ethers::{
        middleware::gas_oracle::GasOracleMiddleware,
        prelude::GasOracle,
        providers::{Middleware, MiddlewareError, PendingTransaction},
        types::{transaction::eip2718::TypedTransaction, *},
    },
    std::sync::atomic::{AtomicBool, AtomicU64, Ordering},
    thiserror::Error,
};

#[derive(Debug)]
/// Middleware used for calculating nonces locally, useful for signing multiple
/// consecutive transactions without waiting for them to hit the mempool
pub struct NonceManagerMiddleware<M> {
    inner: M,
    init_guard: futures_locks::Mutex<()>,
    initialized: AtomicBool,
    nonce: AtomicU64,
    address: Address,
}

impl<M> NonceManagerMiddleware<M>
where
    M: Middleware,
{
    /// Instantiates the nonce manager with a 0 nonce. The `address` should be the
    /// address which you'll be sending transactions from
    pub fn new(inner: M, address: Address) -> Self {
        Self {
            inner,
            init_guard: Default::default(),
            initialized: Default::default(),
            nonce: Default::default(),
            address,
        }
    }

    /// Returns the next nonce to be used
    pub fn next(&self) -> U256 {
        let nonce = self.nonce.fetch_add(1, Ordering::SeqCst);
        nonce.into()
    }

    pub async fn initialize_nonce(
        &self,
        block: Option<BlockId>,
    ) -> Result<U256, NonceManagerError<M>> {
        if self.initialized.load(Ordering::SeqCst) {
            // return current nonce
            return Ok(self.nonce.load(Ordering::SeqCst).into());
        }

        let _guard = self.init_guard.lock().await;

        // do this again in case multiple tasks enter this codepath
        if self.initialized.load(Ordering::SeqCst) {
            // return current nonce
            return Ok(self.nonce.load(Ordering::SeqCst).into());
        }

        // initialize the nonce the first time the manager is called
        let nonce = self
            .inner
            .get_transaction_count(self.address, block)
            .await
            .map_err(MiddlewareError::from_err)?;
        self.nonce.store(nonce.as_u64(), Ordering::SeqCst);
        self.initialized.store(true, Ordering::SeqCst);
        Ok(nonce)
    } // guard dropped here

    async fn get_transaction_count_with_manager(
        &self,
        block: Option<BlockId>,
    ) -> Result<U256, NonceManagerError<M>> {
        // initialize the nonce the first time the manager is called
        if !self.initialized.load(Ordering::SeqCst) {
            let nonce = self
                .inner
                .get_transaction_count(self.address, block)
                .await
                .map_err(MiddlewareError::from_err)?;
            self.nonce.store(nonce.as_u64(), Ordering::SeqCst);
            self.initialized.store(true, Ordering::SeqCst);
        }

        Ok(self.next())
    }
}

pub trait NonceManaged {
    fn reset(&self);
}

impl<M: Middleware> NonceManaged for NonceManagerMiddleware<M> {
    /// Resets the initialized flag so the next usage of the manager will reinitialize the nonce
    /// based on the chain state.
    /// This is useful when the RPC does not return an error if the transaction is submitted with
    /// an incorrect nonce.
    /// This is the only new method compared to the original NonceManagerMiddleware.
    fn reset(&self) {
        self.initialized.store(false, Ordering::SeqCst);
    }
}

impl<M: NonceManaged + Middleware, G: GasOracle> NonceManaged for GasOracleMiddleware<M, G> {
    fn reset(&self) {
        self.inner().reset();
    }
}

impl<T: NonceManaged + Middleware> NonceManaged for LegacyTxMiddleware<T> {
    fn reset(&self) {
        self.inner().reset();
    }
}

#[derive(Error, Debug)]
/// Thrown when an error happens at the Nonce Manager
pub enum NonceManagerError<M: Middleware> {
    /// Thrown when the internal middleware errors
    #[error("{0}")]
    MiddlewareError(M::Error),
}

impl<M: Middleware> MiddlewareError for NonceManagerError<M> {
    type Inner = M::Error;

    fn from_err(src: M::Error) -> Self {
        NonceManagerError::MiddlewareError(src)
    }

    fn as_inner(&self) -> Option<&Self::Inner> {
        match self {
            NonceManagerError::MiddlewareError(e) => Some(e),
        }
    }
}

#[async_trait]
impl<M> Middleware for NonceManagerMiddleware<M>
where
    M: Middleware,
{
    type Error = NonceManagerError<M>;
    type Provider = M::Provider;
    type Inner = M;

    fn inner(&self) -> &M {
        &self.inner
    }

    async fn fill_transaction(
        &self,
        tx: &mut TypedTransaction,
        block: Option<BlockId>,
    ) -> Result<(), Self::Error> {
        if tx.nonce().is_none() {
            tx.set_nonce(self.get_transaction_count_with_manager(block).await?);
        }

        Ok(self
            .inner()
            .fill_transaction(tx, block)
            .await
            .map_err(MiddlewareError::from_err)?)
    }

    /// Signs and broadcasts the transaction. The optional parameter `block` can be passed so that
    /// gas cost and nonce calculations take it into account. For simple transactions this can be
    /// left to `None`.
    async fn send_transaction<T: Into<TypedTransaction> + Send + Sync>(
        &self,
        tx: T,
        block: Option<BlockId>,
    ) -> Result<PendingTransaction<'_, Self::Provider>, Self::Error> {
        let mut tx = tx.into();

        if tx.nonce().is_none() {
            tx.set_nonce(self.get_transaction_count_with_manager(block).await?);
        }

        match self.inner.send_transaction(tx.clone(), block).await {
            Ok(tx_hash) => Ok(tx_hash),
            Err(err) => {
                let nonce = self.get_transaction_count(self.address, block).await?;
                if nonce != self.nonce.load(Ordering::SeqCst).into() {
                    // try re-submitting the transaction with the correct nonce if there
                    // was a nonce mismatch
                    self.nonce.store(nonce.as_u64(), Ordering::SeqCst);
                    tx.set_nonce(nonce);
                    self.inner
                        .send_transaction(tx, block)
                        .await
                        .map_err(MiddlewareError::from_err)
                } else {
                    // propagate the error otherwise
                    Err(MiddlewareError::from_err(err))
                }
            }
        }
    }
}
