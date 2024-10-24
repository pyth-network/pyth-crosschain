use alloy::{
    network::ReceiptResponse, primitives::Address,
    rpc::types::TransactionReceipt,
};
use eyre::ContextCompat;

/// Extension trait to recover address of the contract that was deployed.
pub trait ReceiptExt {
    /// Returns the address of the contract from the [`TransactionReceipt`].
    fn address(&self) -> eyre::Result<Address>;
}

impl ReceiptExt for TransactionReceipt {
    fn address(&self) -> eyre::Result<Address> {
        self.contract_address().context("should contain contract address")
    }
}
