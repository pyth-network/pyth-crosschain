#![cfg(feature = "e2e")]

use alloy::{hex, sol};
use e2e::{receipt,ReceiptExt,Account};
use eyre::Result;

mod abi;

sol!("src/constructor.sol");
// // ============================================================================
// // Integration Tests: Proxy Calls 
// // ============================================================================

// #[e2e::test]
//  async fn constructs(alice: Account) -> Result<()> { 
// //   // let contract_addr = alice.as_deployer().deploy().await?.address()?; 
// // // //   assert_eq!(true, true);
 
//  Ok(())
// }
