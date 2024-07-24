use crate::utils::interface::{
    pyth_core::{update_fee, update_price_feeds},
    pyth_info::price_feed_exists,
    pyth_init::constructor,
};
use crate::utils::setup::setup_environment;

use pyth_sdk::{
    constants::{
        DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD, DUMMY_CHAIN_ID,
        GOVERNANCE_DATA_SOURCE, WORMHOLE_GOVERNANCE_DATA_SOURCE,
    },
    pyth_utils::{
        default_data_sources, default_price_feed_ids, guardian_set_upgrade_3_addresses,
        test_accumulator_update_data_bytes, test_batch_update_data_bytes,
        test_corrupted_proof_accumulator_update_data_bytes,
    },
};

mod success {

    use super::*;

    #[tokio::test]
    async fn updates_price_feeds_for_batch_update() {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();

        constructor(
            &deployer.instance,
            default_data_sources(),
            GOVERNANCE_DATA_SOURCE,
            WORMHOLE_GOVERNANCE_DATA_SOURCE,
            DEFAULT_SINGLE_UPDATE_FEE,
            DEFAULT_VALID_TIME_PERIOD,
            guardian_set_upgrade_3_addresses(),
            3,
            DUMMY_CHAIN_ID,
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

        update_price_feeds(&deployer.instance, fee, test_batch_update_data_bytes()).await;

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
    async fn updates_price_feeds_for_accumulator_update() {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();

        constructor(
            &deployer.instance,
            default_data_sources(),
            GOVERNANCE_DATA_SOURCE,
            WORMHOLE_GOVERNANCE_DATA_SOURCE,
            DEFAULT_SINGLE_UPDATE_FEE,
            DEFAULT_VALID_TIME_PERIOD,
            guardian_set_upgrade_3_addresses(),
            3,
            DUMMY_CHAIN_ID,
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

        update_price_feeds(
            &deployer.instance,
            fee,
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

mod failure {
    use fuels::{
        programs::calls::CallParameters,
        types::errors::{transaction::Reason, Error},
    };

    use super::*;

    #[tokio::test]
    async fn updates_price_feeds_for_accumulator_update_fail_merkle_proof_verification() {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();

        constructor(
            &deployer.instance,
            default_data_sources(),
            GOVERNANCE_DATA_SOURCE,
            WORMHOLE_GOVERNANCE_DATA_SOURCE,
            DEFAULT_SINGLE_UPDATE_FEE,
            DEFAULT_VALID_TIME_PERIOD,
            guardian_set_upgrade_3_addresses(),
            3,
            DUMMY_CHAIN_ID,
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

        // Manually call the function to test the panic
        let result = deployer
            .instance
            .methods()
            .update_price_feeds(test_corrupted_proof_accumulator_update_data_bytes())
            .call_params(CallParameters::default().with_amount(fee))
            .unwrap()
            .call()
            .await;

        let is_error = result.is_err();

        assert!(is_error);

        let error = result.unwrap_err();

        if let Error::Transaction(Reason::Reverted {
            reason,
            revert_id: _,
            receipts: _,
        }) = error
        {
            assert_eq!(
                reason, "InvalidProof",
                "Expected InvalidProof error, got: {}",
                reason
            );
        } else {
            panic!("Expected RevertTransactionError, got another error type.");
        }
    }
}
