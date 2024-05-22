use crate::utils::interface::{
    pyth_core::{update_fee, update_price_feeds},
    pyth_info::price_feed_unsafe,
    pyth_init::constructor,
};
use crate::utils::setup::setup_environment;
use pyth_sdk::{
    constants::{
        DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD, DUMMY_CHAIN_ID,
        GOVERNANCE_DATA_SOURCE, TEST_ACCUMULATOR_ETH_USD_PRICE_FEED,
        TEST_ACCUMULATOR_USDC_USD_PRICE_FEED, TEST_BATCH_ETH_USD_PRICE_FEED,
        TEST_BATCH_USDC_USD_PRICE_FEED, WORMHOLE_GOVERNANCE_DATA_SOURCE,
    },
    pyth_utils::{
        default_data_sources, default_price_feed_ids, guardian_set_upgrade_3_addresses,
        test_accumulator_update_data_bytes, test_batch_update_data_bytes,
    },
};
mod success {

    use super::*;

    #[tokio::test]
    async fn gets_price_feed_from_batch_update() {
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

        update_price_feeds(&deployer.instance, fee, test_batch_update_data_bytes()).await;

        let eth_usd_price_feed = price_feed_unsafe(&deployer.instance, default_price_feed_ids()[0])
            .await
            .value;
        let usdc_usd_price_feed =
            price_feed_unsafe(&deployer.instance, default_price_feed_ids()[1])
                .await
                .value;

        assert_eq!(eth_usd_price_feed, TEST_BATCH_ETH_USD_PRICE_FEED);
        assert_eq!(usdc_usd_price_feed, TEST_BATCH_USDC_USD_PRICE_FEED);
    }

    #[tokio::test]
    async fn gets_price_feed_from_accumulator_update() {
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

        update_price_feeds(
            &deployer.instance,
            fee,
            test_accumulator_update_data_bytes(),
        )
        .await;

        let eth_usd_price_feed = price_feed_unsafe(&deployer.instance, default_price_feed_ids()[0])
            .await
            .value;
        let usdc_usd_price_feed =
            price_feed_unsafe(&deployer.instance, default_price_feed_ids()[1])
                .await
                .value;

        assert_eq!(eth_usd_price_feed, TEST_ACCUMULATOR_ETH_USD_PRICE_FEED);
        assert_eq!(usdc_usd_price_feed, TEST_ACCUMULATOR_USDC_USD_PRICE_FEED);
    }
}
