use alloy::{
    network::EthereumWallet,
    primitives::{Address, B256},
    providers::{Provider, ProviderBuilder},
    signers::{local::PrivateKeySigner, Signature, Signer},
};
use eyre::Result;
use once_cell::sync::Lazy;
use tokio::sync::{Mutex, MutexGuard};

use crate::{
    deploy::Deployer,
    system::{fund_account, Wallet, RPC_URL_ENV_VAR_NAME},
};

const DEFAULT_FUNDING_ETH: u32 = 100;

/// Type that corresponds to a test account.
#[derive(Clone, Debug)]
pub struct Account {
    /// The account's local private key wrapper.
    pub signer: PrivateKeySigner,
    /// The account's wallet -- an `alloy` provider with a `WalletFiller`.
    pub wallet: Wallet,
}

impl Account {
    /// Create a new account with a default funding of [`DEFAULT_FUNDING_ETH`].
    ///
    /// # Errors
    ///
    /// May fail if funding the newly created account fails.
    pub async fn new() -> Result<Self> {
        AccountFactory::create().await
    }

    /// Get a hex-encoded String representing this account's private key.
    #[must_use]
    pub fn pk(&self) -> String {
        alloy::hex::encode(self.signer.to_bytes())
    }

    /// Retrieve this account's address.
    #[must_use]
    pub fn address(&self) -> Address {
        self.signer.address()
    }

    /// The rpc endpoint this account's provider is connect to.
    #[must_use]
    pub fn url(&self) -> &str {
        self.wallet.client().transport().url()
    }

    /// Sign the given hash.
    ///
    /// # Panics
    ///
    /// May fail when the method is not implemented for `Signer`. Should not
    /// happen.
    pub async fn sign_hash(&self, hash: &B256) -> Signature {
        self.signer.sign_hash(hash).await.expect("should sign a hash")
    }

    /// Sign the given message.
    ///
    /// # Panics
    ///
    /// May fail when the method is not implemented for `Signer`. Should not
    /// happen.
    pub async fn sign_message(&self, message: &[u8]) -> Signature {
        self.signer.sign_message(message).await.expect("should sign a message")
    }

    /// Create a configurable smart contract deployer on behalf of this account.
    pub fn as_deployer(&self) -> Deployer {
        Deployer::new(self.url().to_string(), self.pk())
    }
}

/// A unit struct used as a synchronization mechanism in
/// [`SYNC_ACCOUNT_FACTORY`].
struct AccountFactory;

impl AccountFactory {
    /// Get access to the factory in a synchronized manner.
    async fn lock() -> MutexGuard<'static, Self> {
        /// Since after wallet generation accounts get funded in the nitro test
        /// node from a single "god" wallet, we must synchronize account
        /// creation (otherwise the nonce will be too low).
        static SYNC_ACCOUNT_FACTORY: Lazy<Mutex<AccountFactory>> =
            Lazy::new(|| Mutex::new(AccountFactory));

        SYNC_ACCOUNT_FACTORY.lock().await
    }

    /// Create new account and fund it via nitro test node access.
    ///
    /// # Errors
    ///
    /// May fail if unable to find the path to the node or if funding the newly
    /// created account fails.
    async fn create() -> eyre::Result<Account> {
        let _lock = AccountFactory::lock().await;

        let signer = PrivateKeySigner::random();
        let addr = signer.address();
        fund_account(addr, DEFAULT_FUNDING_ETH)?;

        let rpc_url = std::env::var(RPC_URL_ENV_VAR_NAME)
            .expect("failed to load RPC_URL var from env")
            .parse()
            .expect("failed to parse RPC_URL string into a URL");
        let wallet = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(EthereumWallet::from(signer.clone()))
            .on_http(rpc_url);

        Ok(Account { signer, wallet })
    }
}
