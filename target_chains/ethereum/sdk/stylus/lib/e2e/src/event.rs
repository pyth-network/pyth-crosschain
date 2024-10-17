use alloy::{rpc::types::eth::TransactionReceipt, sol_types::SolEvent};

/// Extension trait for asserting an event gets emitted.
pub trait EventExt<E> {
    /// Asserts the contract emitted the `expected` event.
    fn emits(&self, expected: E) -> bool;
}

impl<E> EventExt<E> for TransactionReceipt
where
    E: SolEvent,
    E: PartialEq,
{
    fn emits(&self, expected: E) -> bool {
        // Extract all events that are the expected type.
        self.inner
            .logs()
            .iter()
            .filter_map(|log| log.log_decode().ok())
            .map(|log| log.inner.data)
            .any(|event| expected == event)
    }
}
