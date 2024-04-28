use crate::utils::interface::pyth_init::constructor;
use crate::utils::setup::setup_environment;
use fuels::types::Bytes;
use pyth_sdk::{
    constants::{DEFAULT_SINGLE_UPDATE_FEE, DEFAULT_VALID_TIME_PERIOD},
    pyth_utils::{default_data_sources, guardian_set_upgrade_3_vaa},
};
use pythnet_sdk::test_utils::create_vaa_from_payload;

mod success {

    use pyth_sdk::{
        constants::MAGIC,
        pyth_utils::{
            create_governance_instruction_payload, create_set_fee_payload,
            create_wormhole_vm_payload, GovernanceAction, GovernanceModule,
        },
    };

    use crate::utils::interface::{
        pyth_governance::execute_governance_instruction, pyth_info::single_update_fee,
    };

    use super::*;

    #[tokio::test]
    async fn executes_governance_instruction() {
        let (_oracle_contract_id, deployer) = setup_environment().await.unwrap();

        constructor(
            &deployer.instance,
            default_data_sources(),
            DEFAULT_SINGLE_UPDATE_FEE,
            DEFAULT_VALID_TIME_PERIOD,
            guardian_set_upgrade_3_vaa(),
        )
        .await;

        let set_fee_payload = create_set_fee_payload(128, 8);
        let governance_instruction_payload = create_governance_instruction_payload(
            MAGIC,
            GovernanceModule::Target,
            GovernanceAction::SetFee,
            0,
            set_fee_payload,
        );
        let wormhole_vm_payload = create_wormhole_vm_payload(
            1,
            0,
            0,
            0,
            0,
            [0; 32],
            1,
            0,
            governance_instruction_payload,
        );
        let vaa = create_vaa_from_payload(
            wormhole_vm_payload.as_slice(),
            wormhole_sdk::Address([1u8; 32]),
            wormhole_sdk::Chain::Any,
            1,
        );
        let vaa_hex = hex::encode(serde_wormhole::to_vec(&vaa).unwrap());

        execute_governance_instruction(&deployer.instance, Bytes(vaa_hex.into())).await;

        let fee = single_update_fee(&deployer.instance).await.value;

        assert_eq!(fee, 128);
    }
}
