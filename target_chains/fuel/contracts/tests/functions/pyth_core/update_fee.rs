use crate::utils::interface::{pyth_core::update_fee, pyth_init::constructor};
use crate::utils::setup::setup_environment;
use pyth_sdk::{
    constants::{DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD},
    pyth_utils::{
        default_data_sources, guardian_set_upgrade_3_vaa, test_accumulator_update_data_bytes,
        test_batch_update_data_bytes,
    },
};
mod success {

    use super::*;

    #[tokio::test]
    async fn gets_update_fee_for_batch_update() {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();

        constructor(
            &deployer.instance,
            default_data_sources(),
            DEFAULT_SINGLE_UPDATE_FEE,
            DEFAULT_VALID_TIME_PERIOD,
            guardian_set_upgrade_3_vaa(),
        )
        .await;

        let fee = update_fee(&deployer.instance, test_batch_update_data_bytes())
            .await
            .value;

        assert_eq!(fee, test_batch_update_data_bytes().len() as u64);
    }

    #[tokio::test]
    async fn gets_update_fee_for_accumulator_update() {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();

        constructor(
            &deployer.instance,
            default_data_sources(),
            DEFAULT_SINGLE_UPDATE_FEE,
            DEFAULT_VALID_TIME_PERIOD,
            guardian_set_upgrade_3_vaa(),
        )
        .await;

        let fee = update_fee(&deployer.instance, test_accumulator_update_data_bytes())
            .await
            .value;

        assert_eq!(fee, 2);
    }
}
