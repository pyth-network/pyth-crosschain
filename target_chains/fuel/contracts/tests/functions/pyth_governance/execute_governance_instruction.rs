use pyth_sdk::pyth_utils::PythError;
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
            pyth_info::single_update_fee,
            wormhole_guardians::current_wormhole_provider,
        },
        pyth_sdk::{
            constants::MAGIC,
            pyth_utils::{
                create_authorize_governance_data_source_transfer_payload,
                create_governance_instruction_payload,
                create_request_governance_data_source_transfer_payload, create_set_fee_payload,
                create_set_valid_period_payload, create_set_wormhole_address_payload,
                GovernanceAction, GovernanceModule,
            },
        },
    };

    #[tokio::test]
    async fn executes_governance_instruction() {
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
            bits256_guardians,
            0,
            DUMMY_CHAIN_ID,
        )
        .await;

        // Test SetFee
        let set_fee_payload = create_set_fee_payload(100, 1);
        let mut governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::SetFee,
            1,
            set_fee_payload,
        );

        let mut vaa = create_vaa_from_payload(
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

        // Test SetValidPeriod
        let set_valid_period_payload = create_set_valid_period_payload(100);
        governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::SetValidPeriod,
            1,
            set_valid_period_payload,
        );

        vaa = create_vaa_from_payload(
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

        // let mut current_wormhole_address = current_wormhole_provider(&deployer.instance)
        //     .await
        //     .value
        //     .emitter_address;

        // // Test SetWormholeAddress
        // assert_eq!(
        //     current_wormhole_address,
        //     WORMHOLE_GOVERNANCE_DATA_SOURCE.emitter_address
        // );

        // let set_wormhole_address_payload = create_set_wormhole_address_payload([1u8; 32]);
        // governance_instruction_payload = create_governance_instruction_payload(
        //     MAGIC,
        //     GovernanceModule::Target,
        //     GovernanceAction::SetWormholeAddress,
        //     1,
        //     set_wormhole_address_payload,
        // );

        // vaa = create_vaa_from_payload(
        //     &governance_instruction_payload,
        //     wormhole_sdk::Address(GOVERNANCE_DATA_SOURCE.emitter_address.0),
        //     wormhole_sdk::Chain::from(GOVERNANCE_DATA_SOURCE.chain_id),
        //     3,
        // );

        // execute_governance_instruction(
        //     &deployer.instance,
        //     Bytes(serde_wormhole::to_vec(&vaa).unwrap()),
        // )
        // .await;

        // current_wormhole_address = current_wormhole_provider(&deployer.instance)
        //     .await
        //     .value
        //     .emitter_address;

        // assert_eq!(current_wormhole_address, Bits256([1u8; 32]));

        // Test AuthorizeGovernanceDataSourceTransfer
        let new_emitter_address = Bits256([3u8; 32]);
        let new_emitter_chain = 2;

        // Simulate creating a RequestGovernanceDataSourceTransfer VAA
        let request_governance_data_source_transfer_payload =
            create_request_governance_data_source_transfer_payload(1);
        governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::RequestGovernanceDataSourceTransfer,
            1,
            request_governance_data_source_transfer_payload,
        );
        vaa = create_vaa_from_payload(
            &governance_instruction_payload,
            wormhole_sdk::Address(new_emitter_address.0),
            wormhole_sdk::Chain::from(new_emitter_chain),
            3,
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
            4,
        );

        let old_governance_data_source = governance_data_source(&deployer.instance).await;
        let receipt = execute_governance_instruction(
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
