#![cfg(feature = "e2e")]

use abi::FunctionCalls;
use alloy::{
    primitives::{uint, Address, U256},
    sol,
};
use e2e::{
    receipt, send, watch, Account, EventExt, Panic, PanicCode, ReceiptExt,
    Revert,
};
use eyre::Result;

// use crate::FunctionCallsExample::constructorCall;

mod abi;

sol!("src/constructor.sol");

// // ============================================================================
// // Integration Tests: Function Calls 
// // ============================================================================

//  #[e2e::test]
// async fn constructs(alice: Account) -> Result<()> { 
//    let contract_addr = alice
//         .as_deployer()
//         .with_default_constructor::<constructorCall>()
//         .deploy()
//         .await?
//         .address()?;
// // //   assert_eq!(true, true);
 
//    Ok(())
//  }
