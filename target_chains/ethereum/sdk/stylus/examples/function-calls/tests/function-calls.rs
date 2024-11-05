#![cfg(feature = "e2e")]

use std::println;

use abi::FunctionCalls;
use alloy::{
    primitives::{uint, U256},
    sol,
};
use alloy_primitives::{address, Address, FixedBytes};
use e2e::{
    receipt, send, watch, Account, EventExt, Panic, PanicCode, ReceiptExt,
    Revert,env
};

use eyre::Result;
use crate::FunctionCallsExample::constructorCall;

mod abi;

sol!("src/constructor.sol");

fn str_to_address(input: &str) -> Address {
    let mut address_bytes = [0u8; 20]; // Initialize a 20-byte array with zeros

    // Convert the input string to bytes and copy into the 20-byte array
    let input_bytes = input.as_bytes();
    let len = input_bytes.len().min(20); // Take up to 20 bytes if input is longer

    address_bytes[..len].copy_from_slice(&input_bytes[..len]);

    Address::new(address_bytes) // Create an Address from the byte array
}

impl Default for constructorCall {
    fn default() -> Self {
        ctr("ETH")
    }
}


fn ctr(key_id: &str) -> constructorCall {
    let pyth_addr = env("MOCK_PYTH_ADDRESS").unwrap();
    let address_addr = str_to_address(&pyth_addr);
    println!("MOCK_PYTH_ADDRESS: {:?}", pyth_addr);
    let id = keccak_const::Keccak256::new().update(key_id.as_bytes()).finalize().to_vec();
    let price_id = FixedBytes::<32>::from_slice(&id);
    constructorCall {
      _pythAddress: address_addr,
      _priceId: price_id 
    }
}

#[e2e::test]
async fn constructs(alice: Account) -> Result<()> {
    // Deploy contract using `alice` account
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()  // Assuming `constructorCall` is the constructor here
        .deploy()
        .await?
        .address()?;

    // Instantiate the contract instance
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);

    // Perform basic checks to ensure the contract is correctly initialized
    // Calling a sample function to validate deployment (e.g., `getPriceUnsafe` as a placeholder)
    let price_result = contract.getPriceUnsafe().call().await;
    
    // Verify that the contract was deployed successfully and the function call does not revert
    price_result.expect("The contract deployment or function call failed");
    //assert!(price_result.is_ok(), "The contract deployment or function call failed");

    Ok(())
}
