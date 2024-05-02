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
            pyth_governance::execute_governance_instruction, pyth_info::single_update_fee,
        },
        pyth_sdk::{
            constants::MAGIC,
            pyth_utils::{
                create_governance_instruction_payload, create_set_fee_payload, GovernanceAction,
                GovernanceModule,
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

        let set_fee_payload = create_set_fee_payload(100, 1);
        let governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::SetFee,
            1,
            set_fee_payload,
        );
        println!("{:?}", governance_instruction_payload);

        let vaa = create_vaa_from_payload(
            &governance_instruction_payload,
            wormhole_sdk::Address(GOVERNANCE_DATA_SOURCE.emitter_address.0),
            wormhole_sdk::Chain::from(GOVERNANCE_DATA_SOURCE.chain_id),
            DUMMY_CHAIN_ID.into(),
        );

        execute_governance_instruction(
            &deployer.instance,
            Bytes(serde_wormhole::to_vec(&vaa).unwrap()),
        )
        .await;

        let fee = single_update_fee(&deployer.instance).await.value;

        assert_eq!(fee, 100);
    }
}
