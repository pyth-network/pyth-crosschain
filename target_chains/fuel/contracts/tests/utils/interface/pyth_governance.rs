use fuels::{accounts::wallet::WalletUnlocked, programs::responses::CallResponse, types::Bytes};
use pyth_sdk::pyth_utils::{handle_error, DataSource, PythOracleContract};

pub(crate) async fn execute_governance_instruction(
    contract: &PythOracleContract<WalletUnlocked>,
    encoded_vm: Bytes,
) -> CallResponse<()> {
    contract
        .methods()
        .execute_governance_instruction(encoded_vm)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn governance_data_source(
    contract: &PythOracleContract<WalletUnlocked>,
) -> CallResponse<DataSource> {
    contract
        .methods()
        .governance_data_source()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}
