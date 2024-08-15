use fuels::{
    accounts::wallet::WalletUnlocked,
    programs::responses::CallResponse,
    types::{Bits256, Bytes},
};
use pyth_sdk::pyth_utils::{handle_error, DataSource, GuardianSet, PythOracleContract};

pub(crate) async fn current_guardian_set_index(
    contract: &PythOracleContract<WalletUnlocked>,
) -> CallResponse<u32> {
    contract
        .methods()
        .current_guardian_set_index()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn current_wormhole_provider(
    contract: &PythOracleContract<WalletUnlocked>,
) -> CallResponse<DataSource> {
    contract
        .methods()
        .current_wormhole_provider()
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn governance_action_is_consumed(
    contract: &PythOracleContract<WalletUnlocked>,
    governance_action_hash: Bits256,
) -> CallResponse<bool> {
    contract
        .methods()
        .governance_action_is_consumed(governance_action_hash)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn guardian_set(
    contract: &PythOracleContract<WalletUnlocked>,
    index: u32,
) -> CallResponse<GuardianSet> {
    contract
        .methods()
        .guardian_set(index)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}

pub(crate) async fn submit_new_guardian_set(
    contract: &PythOracleContract<WalletUnlocked>,
    encoded_vm: Bytes,
) -> CallResponse<()> {
    contract
        .methods()
        .submit_new_guardian_set(encoded_vm)
        .call()
        .await
        .map_err(handle_error)
        .unwrap()
}
