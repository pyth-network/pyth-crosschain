use crate::utils::interface::{
    pyth_core::{parse_price_feed_updates, update_fee},
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
    async fn parses_price_feed_batch_updates() {
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

        let max_publish_time = TEST_BATCH_ETH_USD_PRICE_FEED.price.publish_time;
        let price_feeds = parse_price_feed_updates(
            &deployer.instance,
            fee,
            max_publish_time,
            max_publish_time - DEFAULT_VALID_TIME_PERIOD,
            default_price_feed_ids(),
            test_batch_update_data_bytes(),
        )
        .await
        .value;

        assert_eq!(price_feeds[0], TEST_BATCH_ETH_USD_PRICE_FEED);
        assert_eq!(price_feeds[1], TEST_BATCH_USDC_USD_PRICE_FEED);
    }

    #[tokio::test]
    async fn parses_price_feed_accumulator_updates() {
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

        let max_publish_time = TEST_ACCUMULATOR_ETH_USD_PRICE_FEED.price.publish_time;
        let price_feeds = parse_price_feed_updates(
            &deployer.instance,
            fee,
            max_publish_time,
            max_publish_time - DEFAULT_VALID_TIME_PERIOD,
            default_price_feed_ids(),
            test_accumulator_update_data_bytes(),
        )
        .await
        .value;

        assert_eq!(price_feeds[0], TEST_ACCUMULATOR_ETH_USD_PRICE_FEED);
        assert_eq!(price_feeds[1], TEST_ACCUMULATOR_USDC_USD_PRICE_FEED);
    }
}
