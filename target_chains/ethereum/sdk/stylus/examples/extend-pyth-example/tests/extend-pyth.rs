#![cfg(feature = "e2e")]

use std::assert_eq;

use abi::ExtendPyth;
use alloy::{primitives::U256, sol};
use alloy_sol_types::SolValue;
use e2e::{env, Account, ReceiptExt};
use stylus_sdk::alloy_primitives::{Address, FixedBytes};

use crate::ExtendPythExample::constructorCall;
use eyre::Result;
use pyth_stylus::pyth::{mock::create_price_feed_update_data_list, types::Price};

mod abi;

sol!("src/constructor.sol");
// // ============================================================================
// // Integration Tests: Proxy Calls
// // ============================================================================

impl Default for constructorCall {
    fn default() -> Self {
        ctr(false)
    }
}

fn generate_pyth_id_from_str(key_id: &str) -> FixedBytes<32> {
    let id = keccak_const::Keccak256::new()
        .update(key_id.as_bytes())
        .finalize()
        .to_vec();
    let price_id = FixedBytes::<32>::from_slice(&id);
    price_id
}

fn ctr(invaid_pyth_address: bool) -> constructorCall {
    let pyth_addr = if invaid_pyth_address {
        "0xdC79c650B6560cBF15391C3F90A833a349735676".to_string()
    } else {
        env("MOCK_PYTH_ADDRESS").unwrap()
    };
    let address_addr = Address::parse_checksummed(&pyth_addr, None).unwrap();
    constructorCall {
        _pythAddress: address_addr,
    }
}

#[e2e::test]
async fn constructs(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;

    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("ETH");
    contract.getPriceUnsafe(id).call().await?;
    Ok(())
}

#[e2e::test]
async fn can_get_price_unsafe(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("ETH");
    let ExtendPyth::getPriceUnsafeReturn { price } = contract.getPriceUnsafe(id).call().await?;
    let decoded_price = Price::abi_decode(&price, false).expect("Failed to decode price");
    assert!(decoded_price.price > 0_i64);
    assert!(decoded_price.conf > 0_u64);
    assert!(decoded_price.expo > 0_i32);
    assert!(decoded_price.publish_time > U256::from(0));
    Ok(())
}

#[e2e::test]
async fn error_provided_invaild_id_get_price_unsafe(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("BALLON");
    let price_result = contract.getPriceUnsafe(id).call().await;
    assert!(price_result.is_err());
    Ok(())
}

#[e2e::test]
async fn can_get_ema_price_unsafe(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("ETH");
    let ExtendPyth::getEmaPriceUnsafeReturn { price } =
        contract.getEmaPriceUnsafe(id).call().await?;
    let decoded_price = Price::abi_decode(&price, false).expect("Failed to decode price");
    assert!(decoded_price.price > 0_i64);
    assert!(decoded_price.conf > 0_u64);
    assert!(decoded_price.expo > 0_i32);
    assert!(decoded_price.publish_time > U256::from(0));
    Ok(())
}

#[e2e::test]
async fn error_provided_invaild_id_get_ema_price_unsafe(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("BALLON");
    let price_result = contract.getEmaPriceUnsafe(id).call().await;
    assert!(price_result.is_err());
    Ok(())
}

#[e2e::test]
async fn can_get_price_no_older_than(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("ETH");
    let ExtendPyth::getPriceNoOlderThanReturn { price } = contract
        .getPriceNoOlderThan(id, U256::from(1000))
        .call()
        .await?;
    let decoded_price = Price::abi_decode(&price, false).expect("Failed to decode price");
    assert!(decoded_price.price > 0_i64);
    assert!(decoded_price.conf > 0_u64);
    assert!(decoded_price.expo > 0_i32);
    assert!(decoded_price.publish_time > U256::from(0));
    Ok(())
}

#[e2e::test]
async fn error_provided_invaild_id_get_price_no_older_than(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("BALLON");
    let price_result = contract
        .getPriceNoOlderThan(id, U256::from(1000))
        .call()
        .await;
    assert!(price_result.is_err());
    Ok(())
}

#[e2e::test]
async fn error_provided_invaild_period_get_price_no_older_than(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let id = generate_pyth_id_from_str("SOL");
    let price_result = contract.getPriceNoOlderThan(id, U256::from(1)).call().await;
    assert!(price_result.is_err());
    Ok(())
}

#[e2e::test]
async fn can_get_fee(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let (data, _id) = create_price_feed_update_data_list();
    let ExtendPyth::getUpdateFeeReturn { fee } = contract.getUpdateFee(data).call().await?;
    assert_eq!(fee, U256::from(300));
    Ok(())
}

#[e2e::test]
async fn can_get_valid_time_peroid(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let ExtendPyth::getValidTimePeriodReturn { period } =
        contract.getValidTimePeriod().call().await?;
    assert_eq!(period, U256::from(100000));
    Ok(())
}

#[e2e::test]
async fn can_get_data(alice: Account) -> Result<()> {
    let contract_addr = alice
        .as_deployer()
        .with_default_constructor::<constructorCall>()
        .deploy()
        .await?
        .address()?;
    let contract = ExtendPyth::new(contract_addr, &alice.wallet);
    let ExtendPyth::getDataReturn { data } = contract.getData().call().await?;
    assert!(data.len() > 0);
    Ok(())
}
