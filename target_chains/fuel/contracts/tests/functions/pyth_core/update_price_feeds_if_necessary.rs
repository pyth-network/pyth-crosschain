use crate::utils::interface::{
    pyth_core::{update_fee, update_price_feeds_if_necessary},
    pyth_info::price_feed_exists,
    pyth_init::constructor,
};
use crate::utils::setup::setup_environment;
use pyth_sdk::{
    constants::{DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD},
    pyth_utils::{
        default_data_sources, default_price_feed_ids, guardian_set_upgrade_3_vaa,
        test_accumulator_update_data_bytes, test_batch_update_data_bytes,
    },
};
mod success {

    use super::*;

    #[tokio::test]
    async fn updates_price_feeds_if_necessary_for_batch_update() {
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

        // Initial values
        assert_eq!(
            (
                price_feed_exists(&deployer.instance, default_price_feed_ids()[0])
                    .await
                    .value,
                price_feed_exists(&deployer.instance, default_price_feed_ids()[1])
                    .await
                    .value
            ),
            (false, false)
        );

        update_price_feeds_if_necessary(
            &deployer.instance,
            fee,
            vec![default_price_feed_ids()[0]],
            vec![1],
            test_batch_update_data_bytes(),
        )
        .await;

        // Final values
        assert_eq!(
            (
                price_feed_exists(&deployer.instance, default_price_feed_ids()[0])
                    .await
                    .value,
                price_feed_exists(&deployer.instance, default_price_feed_ids()[1])
                    .await
                    .value
            ),
            (true, true)
        );
    }

    #[tokio::test]
    async fn updates_price_feeds_if_necessary_for_accumulator_update() {
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

        // Initial values
        assert_eq!(
            (
                price_feed_exists(&deployer.instance, default_price_feed_ids()[0])
                    .await
                    .value,
                price_feed_exists(&deployer.instance, default_price_feed_ids()[1])
                    .await
                    .value
            ),
            (false, false)
        );

        update_price_feeds_if_necessary(
            &deployer.instance,
            fee,
            vec![default_price_feed_ids()[0]],
            vec![1],
            test_accumulator_update_data_bytes(),
        )
        .await;

        // Final values
        assert_eq!(
            (
                price_feed_exists(&deployer.instance, default_price_feed_ids()[0])
                    .await
                    .value,
                price_feed_exists(&deployer.instance, default_price_feed_ids()[1])
                    .await
                    .value
            ),
            (true, true)
        );
    }
}
