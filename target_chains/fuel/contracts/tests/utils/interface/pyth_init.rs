use fuels::{
    accounts::wallet::WalletUnlocked, prelude::Bytes, programs::call_response::FuelCallResponse,
};

use pyth_sdk::pyth_utils::{DataSource, PythOracleContract};

pub(crate) async fn constructor(
    contract: &PythOracleContract<WalletUnlocked>,
    data_sources: Vec<DataSource>,
    single_update_fee: u64,
    valid_time_period_seconds: u64,
    wormhole_guardian_set_upgrade: Bytes,
) -> FuelCallResponse<()> {
    contract
        .methods()
        .constructor(
            data_sources,
            single_update_fee,
            valid_time_period_seconds,
            wormhole_guardian_set_upgrade,
        )
        .call()
        .await
        .unwrap()
}
