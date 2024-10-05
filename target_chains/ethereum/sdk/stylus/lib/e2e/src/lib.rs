#![doc = include_str!("../README.md")]
mod account;
mod deploy;
mod environment;
mod error;
mod event;
mod project;
mod receipt;
mod system;

pub use account::Account;
pub use e2e_proc::test;
pub use error::{Panic, PanicCode, Revert};
pub use event::EventExt;
pub use receipt::ReceiptExt;
pub use system::{fund_account, provider, Provider, Wallet};

/// This macro provides a shorthand for broadcasting the transaction to the
/// network.
///
/// See: <https://alloy-rs.github.io/alloy/alloy_contract/struct.CallBuilder.html>
///
/// # Examples
///
/// ```rust,ignore
/// #[e2e::test]
/// async fn foo(alice: Account) -> eyre::Result<()> {
///     let contract_addr = alice.as_deployer().deploy().await?.address()?;
///     let contract = Erc721::new(contract_addr, &alice.wallet);
///
///     let alice_addr = alice.address();
///     let token_id = random_token_id();
///     let pending_tx = send!(contract.mint(alice_addr, token_id))?;
///     // ...
/// }
#[macro_export]
macro_rules! send {
    ($e:expr) => {
        $e.send().await
    };
}

/// This macro provides a shorthand for broadcasting the transaction
/// to the network, and then waiting for the given number of confirmations.
///
/// See: <https://alloy-rs.github.io/alloy/alloy_provider/heart/struct.PendingTransactionBuilder.html>
///
/// # Examples
///
/// ```rust,ignore
/// #[e2e::test]
/// async fn foo(alice: Account) -> eyre::Result<()> {
///     let contract_addr = alice.as_deployer().deploy().await?.address()?;
///     let contract = Erc721::new(contract_addr, &alice.wallet);
///
///     let alice_addr = alice.address();
///     let token_id = random_token_id();
///     let result = watch!(contract.mint(alice_addr, token_id))?;
///     // ...
/// }
#[macro_export]
macro_rules! watch {
    ($e:expr) => {
        $crate::send!($e)?.watch().await
    };
}

/// This macro provides a shorthand for broadcasting the transaction
/// to the network, waiting for the given number of confirmations, and then
/// fetching the transaction receipt.
///
/// See: <https://alloy-rs.github.io/alloy/alloy_provider/heart/struct.PendingTransactionBuilder.html>
///
/// # Examples
///
/// ```rust,ignore
/// #[e2e::test]
/// async fn foo(alice: Account) -> eyre::Result<()> {
///     let contract_addr = alice.as_deployer().deploy().await?.address()?;
///     let contract = Erc721::new(contract_addr, &alice.wallet);
///
///     let alice_addr = alice.address();
///     let token_id = random_token_id();
///     let receipt = receipt!(contract.mint(alice_addr, token_id))?;
///     // ...
/// }
#[macro_export]
macro_rules! receipt {
    ($e:expr) => {
        $crate::send!($e)?.get_receipt().await
    };
}
