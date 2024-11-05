use std::{i64, str::FromStr};

use alloy::{
    network::{AnyNetwork, EthereumWallet}, primitives::{uint, Address, FixedBytes as TypeFixedBytes, Bytes, U256},
    providers::ProviderBuilder, 
    sol, sol_types::{ SolCall, SolConstructor}
};
use e2e::{receipt, Account, env};
use pyth_stylus::pyth::mock::create_price_feed_update_data_list;

use crate::{
     report::{ContractReport, FunctionReport}, CacheOpt
};

sol!(
    #[sol(rpc)]
    contract ProxyCall{
        function getPriceUnsafe(bytes32 id) external;
        function getEmaPriceUnsafe(bytes32 id) external;
        function getPriceNoOlderThan(bytes32 id, uint age) external;
        function getEmaPriceNoOlderThan(bytes32 id, uint age) external;
        function getUpdateFee(bytes[] calldata updateData) external returns (uint256);
        function getValidTimePeriod() external;
        function updatePriceFeeds(bytes[] calldata updateData) external payable;
        function updatePriceFeedsIfNecessary(bytes[] calldata updateData, bytes32[] calldata priceIds, uint64[] calldata publishTimes) external payable;
    }
);

sol!("../examples/proxy-calls/src/constructor.sol");

pub async fn bench() -> eyre::Result<ContractReport> {
    let reports = run_with(CacheOpt::None).await?;
    let report = reports
        .into_iter()
        .try_fold(ContractReport::new("ProxyCalls"), ContractReport::add)?;

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

    let contract = ProxyCall::new(contract_addr, &alice_wallet);
    let id = keccak_const::Keccak256::new().update(b"ETH").finalize().to_vec();
    let id = TypeFixedBytes::<32>::from_slice(&id);
    let time_frame = uint!(10000_U256);
    let age  = uint!(10000_U256);

    let (data, ids)  = create_price_feed_update_data_list();


    let _ = receipt!(contract.getPriceUnsafe(id))?;
    let _ = receipt!(contract.getEmaPriceUnsafe(id))?;
    let _ = receipt!(contract.getPriceNoOlderThan(id,age))?;
    let _ = receipt!(contract.getEmaPriceNoOlderThan(id,age))?;
    let _ = receipt!(contract.getValidTimePeriod())?;
    let _ = receipt!(contract.getUpdateFee(data.clone()))?;
    let _ = receipt!(contract.updatePriceFeeds(data.clone()))?;

    //println!("{data:?} , {ids:?} ");
   // let _ = receipt!(contract.updatePriceFeedsIfNecessary(data.clone(),ids.clone(), vec![i64::MAX,i64::MAX,i64::MAX]))?;

    // IMPORTANT: Order matters!
    use ProxyCall::*;
    #[rustfmt::skip]
    let receipts = vec![
        (getPriceUnsafeCall::SIGNATURE, receipt!(contract.getPriceUnsafe(id))?),
        (getEmaPriceUnsafeCall::SIGNATURE, receipt!(contract.getEmaPriceUnsafe(id))?),
        (getPriceNoOlderThanCall::SIGNATURE, receipt!(contract.getPriceNoOlderThan(id, time_frame))?),
        (getEmaPriceNoOlderThanCall::SIGNATURE, receipt!(contract.getEmaPriceNoOlderThan(id, time_frame))?),
        (getValidTimePeriodCall::SIGNATURE, receipt!(contract.getValidTimePeriod())?),
        (getUpdateFeeCall::SIGNATURE, receipt!(contract.getUpdateFee(data.clone()))?),
        //(updatePriceFeedsCall::SIGNATURE, receipt!(contract.updatePriceFeeds(data.clone()))?),
        //(updatePriceFeedsIfNecessaryCall::SIGNATURE, receipt!(contract.updatePriceFeedsIfNecessary(data.clone(), ids.clone(), vec![0,0,0]))?)
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
    let args = ProxyCallsExample::constructorCall { _pythAddress: address };
    let args = alloy::hex::encode(args.abi_encode());
    crate::deploy(account, "proxy-calls", Some(args), cache_opt).await
}