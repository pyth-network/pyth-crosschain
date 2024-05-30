use fuels::{
    test_helpers::{launch_custom_provider_and_get_wallets, WalletsConfig},
    types::{errors::Error, ContractId},
};
use pyth_sdk::pyth_utils::Pyth;

pub(crate) async fn setup_environment() -> Result<(ContractId, Pyth), Error> {
    // Launch a local network and deploy the contract
    let mut wallets = launch_custom_provider_and_get_wallets(
        WalletsConfig::new(
            Some(1),             /* Single wallet */
            Some(1),             /* Single coin (UTXO) */
            Some(1_000_000_000), /* Amount per coin */
        ),
        None,
        None,
    )
    .await?;

    let deployer_wallet = wallets
        .pop()
        .ok_or_else(|| Error::Other("No deployer wallet found".to_string()))?;

    let pyth = Pyth::deploy(deployer_wallet).await?;

    Ok((pyth.instance.contract_id().into(), pyth))
}
