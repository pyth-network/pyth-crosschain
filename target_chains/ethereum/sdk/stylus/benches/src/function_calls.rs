use std::str::FromStr;

use alloy::{
    network::{AnyNetwork, EthereumWallet},
    primitives::{Address, FixedBytes as TypeFixedBytes},
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
        function getUpdateFee() external;
        function getValidTimePeriod() external;
        function updatePriceFeeds() external payable;
        function updatePriceFeedsIfNecessary() external payable;
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
    let alice_wallet = ProviderBuilder::new()
        .network::<AnyNetwork>()
        .with_recommended_fillers()
        .wallet(EthereumWallet::from(alice.signer.clone()))
        .on_http(alice.url().parse()?);
    let contract_addr = deploy(&alice, cache_opt).await?;

    let contract = FunctionCall::new(contract_addr, &alice_wallet);
    let _ = receipt!(contract.getPriceUnsafe())?;
    let _ = receipt!(contract.getEmaPriceUnsafe())?;
    let _ = receipt!(contract.getPriceNoOlderThan())?;
    let _ = receipt!(contract.getEmaPriceNoOlderThan())?;
    let _ = receipt!(contract.getUpdateFee())?;
    let _ = receipt!(contract.getValidTimePeriod())?;
    // let _ = receipt!(contract.updatePriceFeeds())?;
    // let _ = receipt!(contract.updatePriceFeedsIfNecessary())?;

    // IMPORTANT: Order matters!
    use FunctionCall::*;
    #[rustfmt::skip]
    let receipts = vec![
        (getPriceUnsafeCall::SIGNATURE, receipt!(contract.getPriceUnsafe())?),
        (getEmaPriceUnsafeCall::SIGNATURE, receipt!(contract.getEmaPriceUnsafe())?),
        (getPriceNoOlderThanCall::SIGNATURE, receipt!(contract.getPriceNoOlderThan())?),
        (getEmaPriceNoOlderThanCall::SIGNATURE, receipt!(contract.getEmaPriceNoOlderThan())?),
        (getUpdateFeeCall::SIGNATURE, receipt!(contract.getUpdateFee())?),
        (getValidTimePeriodCall::SIGNATURE, receipt!(contract.getValidTimePeriod())?),
        //(updatePriceFeedsCall::SIGNATURE, receipt!(contract.updatePriceFeeds())?),
        //(updatePriceFeedsIfNecessaryCall::SIGNATURE, receipt!(contract.updatePriceFeedsIfNecessary())?)
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
    let id= keccak_const::Keccak256::new().update(b"ETH").finalize().to_vec();
    let price_id = TypeFixedBytes::<32>::from_slice(&id);
    let args = FunctionCallsExample::constructorCall { _pythAddress: address, _priceId: price_id };
    let args = alloy::hex::encode(args.abi_encode());
    crate::deploy(account, "function-calls", Some(args), cache_opt).await
}
