use {
    crate::utils::{interface::pyth_init::constructor, setup::setup_environment},
    fuels::types::{Bits256, Bytes},
    pyth_sdk::{
        constants::{
            DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD, DUMMY_CHAIN_ID,
            GOVERNANCE_DATA_SOURCE, WORMHOLE_GOVERNANCE_DATA_SOURCE,
        },
        pyth_utils::default_data_sources,
    },
    pythnet_sdk::test_utils::{create_vaa_from_payload, dummy_guardians_addresses},
};

mod success {

    use {
        super::*,
        crate::utils::interface::{
            pyth_core::valid_time_period,
            pyth_governance::{execute_governance_instruction, governance_data_source},
            pyth_info::{single_update_fee, valid_data_sources},
        },
        pyth_sdk::{
            constants::MAGIC,
            pyth_utils::{
                create_authorize_governance_data_source_transfer_payload,
                create_governance_instruction_payload,
                create_request_governance_data_source_transfer_payload,
                create_set_data_sources_payload, create_set_fee_payload,
                create_set_valid_period_payload, DataSource, GovernanceAction, GovernanceModule,
                Pyth,
            },
        },
    };

    async fn setup_governance_test_environment() -> (Pyth, Vec<Bits256>) {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();
        let dummy_guardians_addresses: Vec<[u8; 20]> = dummy_guardians_addresses();
        let bits256_guardians: Vec<Bits256> = dummy_guardians_addresses
            .iter()
            .map(|address| {
                let mut full_address = [0u8; 32]; // Create a 32-byte array filled with zeros
                full_address[12..].copy_from_slice(address); // Copy the 20-byte address into the rightmost part
                Bits256(full_address) // Create Bits256 from the 32-byte array
            })
            .collect();

        constructor(
            &deployer.instance,
            default_data_sources(),
            GOVERNANCE_DATA_SOURCE,
            WORMHOLE_GOVERNANCE_DATA_SOURCE,
            DEFAULT_SINGLE_UPDATE_FEE,
            DEFAULT_VALID_TIME_PERIOD,
            bits256_guardians.clone(),
            0,
            DUMMY_CHAIN_ID,
        )
        .await;

        (deployer, bits256_guardians)
    }

    #[tokio::test]
    async fn test_set_fee() {
        let (deployer, _bits256_guardians) = setup_governance_test_environment().await;
        // Test SetFee logic here
        let set_fee_payload = create_set_fee_payload(100, 1);
        let governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::SetFee,
            1,
            set_fee_payload,
        );

        let vaa = create_vaa_from_payload(
            &governance_instruction_payload,
            wormhole_sdk::Address(GOVERNANCE_DATA_SOURCE.emitter_address.0),
            wormhole_sdk::Chain::from(GOVERNANCE_DATA_SOURCE.chain_id),
            1,
        );

        execute_governance_instruction(
            &deployer.instance,
            Bytes(serde_wormhole::to_vec(&vaa).unwrap()),
        )
        .await;

        let fee = single_update_fee(&deployer.instance).await.value;

        assert_eq!(fee, 100);
    }

    #[tokio::test]
    async fn test_set_valid_period() {
        let (deployer, _bits256_guardians) = setup_governance_test_environment().await;
        // Test SetValidPeriod logic here
        let set_valid_period_payload = create_set_valid_period_payload(100);
        let governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::SetValidPeriod,
            1,
            set_valid_period_payload,
        );

        let vaa = create_vaa_from_payload(
            &governance_instruction_payload,
            wormhole_sdk::Address(GOVERNANCE_DATA_SOURCE.emitter_address.0),
            wormhole_sdk::Chain::from(GOVERNANCE_DATA_SOURCE.chain_id),
            2,
        );

        execute_governance_instruction(
            &deployer.instance,
            Bytes(serde_wormhole::to_vec(&vaa).unwrap()),
        )
        .await;

        let valid_period = valid_time_period(&deployer.instance).await.value;

        assert_eq!(valid_period, 100);
    }

    #[tokio::test]
    async fn test_set_data_sources() {
        let (deployer, _bits256_guardians) = setup_governance_test_environment().await;
        // Test SetDataSources
        let test_data_sources = vec![
            DataSource {
                chain_id: 2,
                emitter_address: Bits256([1u8; 32]),
            },
            DataSource {
                chain_id: 27,
                emitter_address: Bits256([2u8; 32]),
            },
        ];
        let set_data_sources_payload = create_set_data_sources_payload(test_data_sources.clone());
        let governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::SetDataSources,
            1,
            set_data_sources_payload,
        );
        let vaa = create_vaa_from_payload(
            &governance_instruction_payload,
            wormhole_sdk::Address(GOVERNANCE_DATA_SOURCE.emitter_address.0),
            wormhole_sdk::Chain::from(GOVERNANCE_DATA_SOURCE.chain_id),
            3,
        );

        execute_governance_instruction(
            &deployer.instance,
            Bytes(serde_wormhole::to_vec(&vaa).unwrap()),
        )
        .await;

        let new_data_sources = valid_data_sources(&deployer.instance).await.value;

        assert_eq!(new_data_sources, test_data_sources);
    }

    #[tokio::test]
    async fn test_authorize_governance_data_source_transfer() {
        let (deployer, _bits256_guardians) = setup_governance_test_environment().await;
        // Test AuthorizeGovernanceDataSourceTransfer
        let new_emitter_address = Bits256([3u8; 32]);
        let new_emitter_chain = 2;

        // Simulate creating a RequestGovernanceDataSourceTransfer VAA
        let request_governance_data_source_transfer_payload =
            create_request_governance_data_source_transfer_payload(1);
        let mut governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::RequestGovernanceDataSourceTransfer,
            1,
            request_governance_data_source_transfer_payload,
        );
        let mut vaa = create_vaa_from_payload(
            &governance_instruction_payload,
            wormhole_sdk::Address(new_emitter_address.0),
            wormhole_sdk::Chain::from(new_emitter_chain),
            4,
        );

        // Authorize the transfer
        let authorize_governance_data_source_transfer_payload =
            create_authorize_governance_data_source_transfer_payload(vaa);
        governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::AuthorizeGovernanceDataSourceTransfer,
            1,
            authorize_governance_data_source_transfer_payload,
        );
        vaa = create_vaa_from_payload(
            &governance_instruction_payload,
            wormhole_sdk::Address(GOVERNANCE_DATA_SOURCE.emitter_address.0),
            wormhole_sdk::Chain::from(GOVERNANCE_DATA_SOURCE.chain_id),
            5,
        );

        let old_governance_data_source = governance_data_source(&deployer.instance).await;
        execute_governance_instruction(
            &deployer.instance,
            Bytes(serde_wormhole::to_vec(&vaa).unwrap()),
        )
        .await;

        let new_governance_data_source = governance_data_source(&deployer.instance).await;
        assert_ne!(
            old_governance_data_source.value.emitter_address,
            new_governance_data_source.value.emitter_address
        );
        assert_ne!(
            old_governance_data_source.value.chain_id,
            new_governance_data_source.value.chain_id
        );
        assert_eq!(
            new_governance_data_source.value.emitter_address,
            new_emitter_address
        );
        assert_eq!(new_governance_data_source.value.chain_id, new_emitter_chain);
    }
}
