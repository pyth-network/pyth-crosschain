#![cfg(feature = "e2e")]

use std::{assert_eq, println};

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
        ctr("ETH", false)
    }
}


fn ctr(key_id: &str, invaid_pyth_address: bool) -> constructorCall {
     let pyth_addr = if invaid_pyth_address {
        "0xdC79c650B6560cBF15391C3F90A833a349735676".to_string()
    } else {
        env("MOCK_PYTH_ADDRESS").unwrap()
    };
    let address_addr = Address::parse_checksummed(&pyth_addr, None).unwrap();
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
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getPriceUnsafeReturn { price } = contract.getPriceUnsafe().call().await?;
    assert!(price > 0);
    Ok(())
}

#[e2e::test]
async fn error_provided_invaild_id(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_constructor(ctr("BALLON",false))
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let result = contract.getPriceUnsafe().call().await;
    assert!(result.is_err());
    Ok(())
}

#[e2e::test]
async fn error_provided_invaild_pyth_address(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_constructor(ctr("BALLON", true))
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let result = contract.getPriceUnsafe().call().await;
    assert!(result.is_err());
    Ok(())
}

#[e2e::test]
async fn can_get_price_unsafe(alice: Account) -> Result<()> {
    // Deploy contract using `alice` account
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()  // Assuming `constructorCall` is the constructor here
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getPriceUnsafeReturn { price } = contract.getPriceUnsafe().call().await?;
    assert!(price > 0);
    Ok(())
}

#[e2e::test]
async fn can_get_ema_price_unsafe(alice: Account) -> Result<()> {
    // Deploy contract using `alice` account
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()  // Assuming `constructorCall` is the constructor here
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getEmaPriceUnsafeReturn { price } = contract.getEmaPriceUnsafe().call().await?;
    assert!(price > 0);
    Ok(())
}


#[e2e::test]
async fn can_get_price_no_older_than(alice: Account) -> Result<()> {
    // Deploy contract using `alice` account
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()  // Assuming `constructorCall` is the constructor here
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getPriceNoOlderThanReturn { price } = contract.getPriceNoOlderThan().call().await?;
    assert!(price > 0);
    Ok(())
}

#[e2e::test]
async fn can_get_ema_price_no_older_than(alice: Account) -> Result<()> {
    // Deploy contract using `alice` account
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()  // Assuming `constructorCall` is the constructor here
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getEmaPriceNoOlderThanReturn { price } = contract.getEmaPriceNoOlderThan().call().await?;
    assert!(price > 0);
    Ok(())
}

#[e2e::test]
async fn can_get_fee(alice: Account) -> Result<()> {
    // Deploy contract using `alice` account
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()  // Assuming `constructorCall` is the constructor here
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getUpdateFeeReturn { fee } = contract.getUpdateFee().call().await?;
    assert_eq!(fee, U256::from(300));
    Ok(())
}

#[e2e::test]
async fn can_get_period(alice: Account) -> Result<()> {
    // Deploy contract using `alice` account
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()  // Assuming `constructorCall` is the constructor here
        .deploy()
        .await?
        .address()?;
    let contract = FunctionCalls::new(contract_addr, &alice.wallet);
    let FunctionCalls::getValidTimePeriodReturn { period } = contract.getValidTimePeriod().call().await?;
    assert_eq!(period, U256::from(100000));
    Ok(())
}
