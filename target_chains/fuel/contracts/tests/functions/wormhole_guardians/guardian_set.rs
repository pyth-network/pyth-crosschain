use crate::utils::interface::{
    pyth_init::constructor,
    wormhole_guardians::{current_guardian_set_index, guardian_set, submit_new_guardian_set},
};
use crate::utils::setup::setup_environment;

use fuels::types::Bytes;
use pyth_sdk::{
    constants::{
        DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD, DUMMY_CHAIN_ID,
        GOVERNANCE_DATA_SOURCE, GUARDIAN_SET_UPGRADE_4_VAA, WORMHOLE_GOVERNANCE_DATA_SOURCE,
    },
    pyth_utils::{
        default_data_sources, guardian_set_upgrade_3_addresses, guardian_set_upgrade_4_addresses,
    },
};

mod success {

    use super::*;

    #[tokio::test]
    async fn upgrade_guardian_set() {
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

        let mut guardian_set_index = current_guardian_set_index(&deployer.instance).await.value;
        assert_eq!(guardian_set_index, 3);

        let mut current_guardian_set = guardian_set(&deployer.instance, guardian_set_index)
            .await
            .value;
        let mut expected_keys = guardian_set_upgrade_3_addresses();
        assert_eq!(
            current_guardian_set.keys, expected_keys,
            "Guardian set keys do not match expected values."
        );

        submit_new_guardian_set(
            &deployer.instance,
            Bytes::from_hex_str(GUARDIAN_SET_UPGRADE_4_VAA)
                .expect("Failed to convert VAA to bytes"),
        )
        .await;

        guardian_set_index = current_guardian_set_index(&deployer.instance).await.value;
        assert_eq!(guardian_set_index, 4);

        current_guardian_set = guardian_set(&deployer.instance, guardian_set_index)
            .await
            .value;
        expected_keys = guardian_set_upgrade_4_addresses();
        assert_eq!(
            current_guardian_set.keys, expected_keys,
            "Guardian set keys do not match expected values."
        );
    }
}
