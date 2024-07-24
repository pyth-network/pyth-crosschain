use fuels::{accounts::wallet::WalletUnlocked, programs::responses::CallResponse, types::Bits256};

use pyth_sdk::pyth_utils::{handle_error, DataSource, PythOracleContract};

pub(crate) async fn constructor(
    contract: &PythOracleContract<WalletUnlocked>,
    data_sources: Vec<DataSource>,
    governance_data_source: DataSource,
    wormhole_governance_data_source: DataSource,
    single_update_fee: u64,
    valid_time_period_seconds: u64,
    wormhole_guardian_set_addresses: Vec<Bits256>,
    wormhole_guardian_set_index: u32,
    chain_id: u16,
) -> CallResponse<()> {
    contract
        .methods()
        .constructor(
            data_sources,
            governance_data_source,
            wormhole_governance_data_source,
            single_update_fee,
            valid_time_period_seconds,
            wormhole_guardian_set_addresses,
            wormhole_guardian_set_index,
            chain_id,
        )
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}
