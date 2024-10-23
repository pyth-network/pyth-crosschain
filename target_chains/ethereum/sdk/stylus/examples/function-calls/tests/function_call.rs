#![cfg(feature = "e2e")]

use std::print;

use abi::Pyth;
use alloy::primitives::{fixed_bytes, uint, Address, Bytes, U256};
use e2e::{receipt, send, watch, Account, EventExt, ReceiptExt, Revert};

fn random_token_id() -> U256 {
    let num: u32 = rand::random();
    U256::from(num)
}

#[e2e::test]
async fn constructs(alice: Account) -> eyre::Result<()> {
    let contract_addr = alice.as_deployer().deploy().await?.address()?;
    print_ln!("Contract address: {}", contract_addr);
    // let contract = Erc721::new(contract_addr, &alice.wallet);

    // let Erc721::pausedReturn { paused } = contract.paused().call().await?;

    // assert_eq!(false, paused);

    Ok(())
}