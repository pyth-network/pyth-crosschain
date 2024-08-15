use fuels::{
    accounts::wallet::WalletUnlocked,
    prelude::{Bytes, CallParameters, TxPolicies},
    programs::responses::CallResponse,
    types::Bits256,
};

use pyth_sdk::pyth_utils::{handle_error, Price, PriceFeed, PythOracleContract};

pub(crate) async fn ema_price(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> CallResponse<Price> {
    contract
        .methods()
        .ema_price(price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn ema_price_no_older_than(
    contract: &PythOracleContract<WalletUnlocked>,
    time_period: u64,
    price_feed_id: Bits256,
) -> CallResponse<Price> {
    contract
        .methods()
        .ema_price_no_older_than(time_period, price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn ema_price_unsafe(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> CallResponse<Price> {
    contract
        .methods()
        .ema_price_unsafe(price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn parse_price_feed_updates(
    contract: &PythOracleContract<WalletUnlocked>,
    fee: u64,
    max_publish_time: u64,
    min_publish_time: u64,
    price_feed_ids: Vec<Bits256>,
    update_data: Vec<Bytes>,
) -> CallResponse<Vec<PriceFeed>> {
    contract
        .methods()
        .parse_price_feed_updates(
            max_publish_time,
            min_publish_time,
            price_feed_ids,
            update_data,
        )
        .with_tx_policies(TxPolicies::default())
        .call_params(CallParameters::default().with_amount(fee))
        .unwrap()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn price(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> CallResponse<Price> {
    contract
        .methods()
        .price(price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn price_no_older_than(
    contract: &PythOracleContract<WalletUnlocked>,
    time_period: u64,
    price_feed_id: Bits256,
) -> CallResponse<Price> {
    contract
        .methods()
        .price_no_older_than(time_period, price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn price_unsafe(
    contract: &PythOracleContract<WalletUnlocked>,
    price_feed_id: Bits256,
) -> CallResponse<Price> {
    contract
        .methods()
        .price_unsafe(price_feed_id)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn update_fee(
    contract: &PythOracleContract<WalletUnlocked>,
    update_data: Vec<Bytes>,
) -> CallResponse<u64> {
    contract
        .methods()
        .update_fee(update_data)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn update_price_feeds(
    contract: &PythOracleContract<WalletUnlocked>,
    fee: u64,
    update_data: Vec<Bytes>,
) -> CallResponse<()> {
    contract
        .methods()
        .update_price_feeds(update_data)
        .call_params(CallParameters::default().with_amount(fee))
        .unwrap()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn update_price_feeds_if_necessary(
    contract: &PythOracleContract<WalletUnlocked>,
    fee: u64,
    price_feed_ids: Vec<Bits256>,
    publish_times: Vec<u64>,
    update_data: Vec<Bytes>,
) -> CallResponse<()> {
    contract
        .methods()
        .update_price_feeds_if_necessary(price_feed_ids, publish_times, update_data)
        .call_params(CallParameters::default().with_amount(fee))
        .unwrap()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn valid_time_period(
    contract: &PythOracleContract<WalletUnlocked>,
) -> CallResponse<u64> {
    contract
        .methods()
        .valid_time_period()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}
