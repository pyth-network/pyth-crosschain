use fuels::{accounts::wallet::WalletUnlocked, programs::responses::CallResponse, types::Bits256};

use pyth_sdk::pyth_utils::{handle_error, DataSource, PriceFeed, PythOracleContract, State};

pub(crate) async fn owner(contract: &PythOracleContract<WalletUnlocked>) -> CallResponse<State> {
    contract.methods().owner().call().await.unwrap()
}

pub(crate) async fn price_feed_exists(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> CallResponse<bool> {
    contract
        .methods()
        .price_feed_exists(price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn price_feed_unsafe(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> CallResponse<PriceFeed> {
    contract
        .methods()
        .price_feed_unsafe(price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn single_update_fee(
    contract: &PythOracleContract<WalletUnlocked>,
) -> CallResponse<u64> {
    contract
        .methods()
        .single_update_fee()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn is_valid_data_source(
    contract: &PythOracleContract<WalletUnlocked>,
    data_source: &DataSource,
) -> CallResponse<bool> {
    contract
        .methods()
        .is_valid_data_source(data_source.clone())
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn valid_data_sources(
    contract: &PythOracleContract<WalletUnlocked>,
) -> CallResponse<Vec<DataSource>> {
    contract
        .methods()
        .valid_data_sources()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}
