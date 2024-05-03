use fuels::{
    accounts::wallet::WalletUnlocked, programs::call_response::FuelCallResponse, types::Bytes,
};
use pyth_sdk::pyth_utils::{DataSource, PythOracleContract};

pub(crate) async fn execute_governance_instruction(
    contract: &PythOracleContract<WalletUnlocked>,
    encoded_vm: Bytes,
) -> FuelCallResponse<()> {
    contract
        .methods()
        .execute_governance_instruction(encoded_vm)
        .call()
        .await
        .unwrap()
}

pub(crate) async fn governance_data_source(
    contract: &PythOracleContract<WalletUnlocked>,
) -> FuelCallResponse<DataSource> {
    contract
        .methods()
        .governance_data_source()
        .call()
        .await
        .unwrap()
}
