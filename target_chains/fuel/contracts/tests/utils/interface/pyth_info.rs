use fuels::{
    accounts::wallet::WalletUnlocked, programs::call_response::FuelCallResponse, types::Bits256,
};

use pyth_sdk::pyth_utils::{DataSource, PriceFeed, PythOracleContract, State};

pub(crate) async fn owner(
    contract: &PythOracleContract<WalletUnlocked>,
) -> FuelCallResponse<State> {
    contract.methods().owner().call().await.unwrap()
}

pub(crate) async fn price_feed_exists(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> FuelCallResponse<bool> {
    contract
        .methods()
        .price_feed_exists(price_feed_id)
        .call()
        .await
        .unwrap()
}

pub(crate) async fn price_feed_unsafe(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> FuelCallResponse<PriceFeed> {
    contract
        .methods()
        .price_feed_unsafe(price_feed_id)
        .call()
        .await
        .unwrap()
}

pub(crate) async fn single_update_fee(
    contract: &PythOracleContract<WalletUnlocked>,
) -> FuelCallResponse<u64> {
    contract.methods().single_update_fee().call().await.unwrap()
}

pub(crate) async fn valid_data_source(
    contract: &PythOracleContract<WalletUnlocked>,
    data_source: &DataSource,
) -> FuelCallResponse<bool> {
    contract
        .methods()
        .valid_data_source(data_source.clone())
        .call()
        .await
        .unwrap()
}

pub(crate) async fn valid_data_sources(
    contract: &PythOracleContract<WalletUnlocked>,
) -> FuelCallResponse<Vec<DataSource>> {
    contract
        .methods()
        .valid_data_sources()
        .call()
        .await
        .unwrap()
}
