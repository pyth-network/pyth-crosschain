use crate::utils::interface::{
    pyth_core::valid_time_period,
    pyth_info::{is_valid_data_source, owner, single_update_fee, valid_data_sources},
    pyth_init::constructor,
    wormhole_guardians::{
        current_guardian_set_index, current_wormhole_provider, governance_action_is_consumed,
    },
};
use pyth_sdk::{
    constants::{
        DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD, DUMMY_CHAIN_ID,
        GOVERNANCE_DATA_SOURCE, UPGRADE_3_VAA_GOVERNANCE_ACTION_HASH,
        WORMHOLE_GOVERNANCE_DATA_SOURCE,
    },
    pyth_utils::{
        default_data_sources, guardian_set_upgrade_3_addresses, ConstructedEvent, DataSource, State,
    },
};

use fuels::types::Bits256;

mod success {

    use crate::utils::setup::setup_environment;

    use super::*;

    #[tokio::test]
    async fn constructs() {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();

        // Initial values
        assert!(
            !is_valid_data_source(&deployer.instance, &default_data_sources()[0])
                .await
                .value
        );
        assert_eq!(valid_data_sources(&deployer.instance).await.value.len(), 0);
        assert_eq!(valid_time_period(&deployer.instance).await.value, 0);
        assert_eq!(single_update_fee(&deployer.instance).await.value, 0);
        assert!(
            !governance_action_is_consumed(
                &deployer.instance,
                UPGRADE_3_VAA_GOVERNANCE_ACTION_HASH
            )
            .await
            .value
        );
        assert_eq!(
            current_guardian_set_index(&deployer.instance,).await.value,
            0
        );
        assert_eq!(
            current_wormhole_provider(&deployer.instance,).await.value,
            DataSource {
                chain_id: 0,
                emitter_address: Bits256::zeroed(),
            }
        );
        assert_eq!(owner(&deployer.instance,).await.value, State::Uninitialized);

        let response = constructor(
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

        let log = response
            .decode_logs_with_type::<ConstructedEvent>()
            .unwrap();
        let event = log.first().unwrap();
        assert_eq!(
            *event,
            ConstructedEvent {
                guardian_set_index: 3,
            }
        );

        // Final values
        assert!(
            is_valid_data_source(&deployer.instance, &default_data_sources()[0])
                .await
                .value
        );
        assert_eq!(
            &valid_data_sources(&deployer.instance).await.value.len(),
            &default_data_sources().len()
        );
        assert_eq!(
            valid_time_period(&deployer.instance).await.value,
            DEFAULT_VALID_TIME_PERIOD
        );
        assert_eq!(
            single_update_fee(&deployer.instance).await.value,
            DEFAULT_SINGLE_UPDATE_FEE
        );
        assert_eq!(
            current_guardian_set_index(&deployer.instance,).await.value,
            3
        );
        assert_eq!(
            current_wormhole_provider(&deployer.instance,).await.value,
            DataSource {
                chain_id: 1,
                emitter_address: Bits256([
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                    0, 0, 0, 0, 0, 4
                ])
            }
        );
        assert_eq!(owner(&deployer.instance).await.value, State::Revoked);
    }
}
