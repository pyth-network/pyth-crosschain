use std::str::FromStr;

use alloy::{
    network::{AnyNetwork, EthereumWallet},
    primitives::{Address, FixedBytes as TypeFixedBytes, fixed_bytes},
    providers::ProviderBuilder,
    sol,
    sol_types::{SolCall, SolConstructor},
};
use e2e::{receipt, Account};

use crate::{
    env, report::{ContractReport, FunctionReport}, CacheOpt
};

sol!(
    #[sol(rpc)]
    contract FunctionCall{
        function getPriceUnsafe() external ;
        function getEmaPriceUnsafe() external ;
        function getPriceNoOlderThan() external ;
        function getEmaPriceNoOlderThan() external;
    }
);

sol!("../examples/function-calls/src/constructor.sol");

pub async fn bench() -> eyre::Result<ContractReport> {
    let reports = run_with(CacheOpt::None).await?;
    let report = reports
        .into_iter()
        .try_fold(ContractReport::new("FunctionCalls"), ContractReport::add)?;

    let cached_reports = run_with(CacheOpt::Bid(0)).await?;
    let report = cached_reports
        .into_iter()
        .try_fold(report, ContractReport::add_cached)?;

    Ok(report)
}

pub async fn run_with(
    cache_opt: CacheOpt,
) -> eyre::Result<Vec<FunctionReport>> {
    let alice = Account::new().await?;
    let alice_addr = alice.address();
    let alice_wallet = ProviderBuilder::new()
        .network::<AnyNetwork>()
        .with_recommended_fillers()
        .wallet(EthereumWallet::from(alice.signer.clone()))
        .on_http(alice.url().parse()?);

    let bob = Account::new().await?;
    let bob_addr = bob.address();

    let contract_addr = deploy(&alice, cache_opt).await?;

    let contract = FunctionCall::new(contract_addr, &alice_wallet);
    println!("contract address: {contract_addr:?}");
    // let token_1 = uint!(1_U256);
    // let token_2 = uint!(2_U256);
    // let token_3 = uint!(3_U256);
    // let token_4 = uint!(4_U256);
    
    println!("contract: {contract:?}");
    let _ = receipt!(contract.getPriceUnsafe())?;
    let _ = receipt!(contract.getEmaPriceUnsafe())?;
    // let _ = receipt!(contract.mint(alice_addr, token_4))?;

    // IMPORTANT: Order matters!
    use FunctionCall::*;
    //#[rustfmt::skip]
    let receipts = vec![
        (getPriceUnsafeCall::SIGNATURE, receipt!(contract.getPriceUnsafe())?),
        (getEmaPriceUnsafeCall::SIGNATURE, receipt!(contract.getEmaPriceUnsafe())?),
        (getPriceNoOlderThanCall::SIGNATURE, receipt!(contract.getPriceNoOlderThan())?),
        (getEmaPriceNoOlderThanCall::SIGNATURE, receipt!(contract.getEmaPriceNoOlderThan())?),
    ];

    receipts
        .into_iter()
        .map(FunctionReport::new)
        .collect::<eyre::Result<Vec<_>>>()
}

async fn deploy(
    account: &Account,
    cache_opt: CacheOpt,
) -> eyre::Result<Address> {
    let pyth_addr = env("MOCK_PYTH_ADDRESS")?;
    let address = Address::from_str(&pyth_addr)?;
    let id= "ETH";
    let mut bytes = [0u8; 32];
    bytes[..id.len().min(32)].copy_from_slice(&id.as_bytes()[..id.len().min(32)]);
    let price_id :TypeFixedBytes<32>  = TypeFixedBytes::from(bytes);
    println!("pyth address: {address:?} price_id: {price_id:?}"); 
    let args = FunctionCallsExample::constructorCall { _pythAddress: address, _priceId: price_id };
    let args = alloy::hex::encode(args.abi_encode());
    crate::deploy(account, "function-calls", Some(args), cache_opt).await
}
