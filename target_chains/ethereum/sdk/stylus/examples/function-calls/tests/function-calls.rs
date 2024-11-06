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


impl Default for constructorCall {
    fn default() -> Self {
        ctr("ETH")
    }
}


fn ctr(key_id: &str) -> constructorCall {
    let pyth_addr = env("MOCK_PYTH_ADDRESS").unwrap();
    let address_addr = Address::parse_checksummed(&pyth_addr, None).unwrap();
    let id = keccak_const::Keccak256::new().update(key_id.as_bytes()).finalize().to_vec();
    let price_id = FixedBytes::<32>::from_slice(&id);
    println!("MOCK_PYTH_ADDRESS: {:?} {:?} {:?}", pyth_addr, address_addr, price_id);
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
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getPriceUnsafeReturn { price } = contract.getPriceUnsafe().call().await?;
    println!("Price: {}", price);
    Ok(())
}
