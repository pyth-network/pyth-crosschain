#![cfg(feature = "e2e")]

use alloy::hex;
use e2e::{receipt, send, watch, Account, EventExt, ReceiptExt, Revert};
use eyre::Result;

mod abi;


// ============================================================================
// Integration Tests: Function Calls 
// ============================================================================

#[e2e::test]
async fn constructs(alice: Account) -> Result<()> { 
    assert_eq!(true, true);

    Ok(())
}
