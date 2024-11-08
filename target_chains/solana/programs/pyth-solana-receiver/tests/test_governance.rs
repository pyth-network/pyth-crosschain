use {
    common_test_utils::{setup_pyth_receiver, ProgramTestFixtures, WrongSetupOption},
    program_simulator::into_transaction_error,
    pyth_solana_receiver::{
        error::ReceiverError,
        instruction::{
            AcceptGovernanceAuthorityTransfer, CancelGovernanceAuthorityTransfer,
            RequestGovernanceAuthorityTransfer, SetDataSources, SetFee, SetMinimumSignatures,
            SetWormholeAddress,
        },
    },
    pyth_solana_receiver_sdk::{
        config::{Config, DataSource},
        pda::get_config_address,
    },
    pythnet_sdk::test_utils::SECONDARY_DATA_SOURCE,
    solana_program::{native_token::LAMPORTS_PER_SOL, pubkey::Pubkey},
    solana_sdk::signer::Signer,
};

#[tokio::test]
async fn test_governance() {
    let ProgramTestFixtures {
        mut program_simulator,
        encoded_vaa_addresses: _,
        governance_authority,
    } = setup_pyth_receiver(vec![], WrongSetupOption::None).await;

    let new_governance_authority = program_simulator.get_funded_keypair().await.unwrap();

    let initial_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();

    let new_config = Config {
        governance_authority: new_governance_authority.pubkey(),
        target_governance_authority: None,
        wormhole: Pubkey::new_unique(),
        valid_data_sources: vec![DataSource {
            chain: SECONDARY_DATA_SOURCE.chain.into(),
            emitter: Pubkey::from(SECONDARY_DATA_SOURCE.address.0),
        }],
        single_update_fee_in_lamports: LAMPORTS_PER_SOL,
        minimum_signatures: 20,
    };

    // this authority is not allowed to do anything
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                SetDataSources::populate(
                    new_governance_authority.pubkey(),
                    new_config.valid_data_sources.clone()
                ),
                &vec![&new_governance_authority],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::GovernanceAuthorityMismatch)
    );

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                SetFee::populate(
                    new_governance_authority.pubkey(),
                    new_config.single_update_fee_in_lamports
                ),
                &vec![&new_governance_authority],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::GovernanceAuthorityMismatch)
    );

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                SetWormholeAddress::populate(
                    new_governance_authority.pubkey(),
                    new_config.wormhole
                ),
                &vec![&new_governance_authority],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::GovernanceAuthorityMismatch)
    );

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                SetMinimumSignatures::populate(
                    new_governance_authority.pubkey(),
                    new_config.minimum_signatures,
                ),
                &vec![&new_governance_authority],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::GovernanceAuthorityMismatch)
    );

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                RequestGovernanceAuthorityTransfer::populate(
                    new_governance_authority.pubkey(),
                    new_config.governance_authority,
                ),
                &vec![&new_governance_authority],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::GovernanceAuthorityMismatch)
    );

    assert_eq!(
        program_simulator
            .get_anchor_account_data::<Config>(get_config_address())
            .await
            .unwrap(),
        initial_config
    );

    // Now start changing for real
    program_simulator
        .process_ix_with_default_compute_limit(
            SetDataSources::populate(
                governance_authority.pubkey(),
                new_config.valid_data_sources.clone(),
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    let mut current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        initial_config.governance_authority
    );
    assert_eq!(current_config.target_governance_authority, None);
    assert_eq!(current_config.wormhole, initial_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(
        current_config.single_update_fee_in_lamports,
        initial_config.single_update_fee_in_lamports
    );
    assert_eq!(
        current_config.minimum_signatures,
        initial_config.minimum_signatures
    );

    program_simulator
        .process_ix_with_default_compute_limit(
            SetFee::populate(
                governance_authority.pubkey(),
                new_config.single_update_fee_in_lamports,
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        initial_config.governance_authority
    );
    assert_eq!(current_config.target_governance_authority, None);
    assert_eq!(current_config.wormhole, initial_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(
        current_config.single_update_fee_in_lamports,
        new_config.single_update_fee_in_lamports
    );
    assert_eq!(
        current_config.minimum_signatures,
        initial_config.minimum_signatures
    );

    program_simulator
        .process_ix_with_default_compute_limit(
            SetWormholeAddress::populate(governance_authority.pubkey(), new_config.wormhole),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        initial_config.governance_authority
    );
    assert_eq!(current_config.target_governance_authority, None);
    assert_eq!(current_config.wormhole, new_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(
        current_config.single_update_fee_in_lamports,
        new_config.single_update_fee_in_lamports
    );
    assert_eq!(
        current_config.minimum_signatures,
        initial_config.minimum_signatures
    );

    // Minimum signatures can't be 0
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                SetMinimumSignatures::populate(governance_authority.pubkey(), 0,),
                &vec![&governance_authority],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::ZeroMinimumSignatures)
    );

    program_simulator
        .process_ix_with_default_compute_limit(
            SetMinimumSignatures::populate(
                governance_authority.pubkey(),
                new_config.minimum_signatures,
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        initial_config.governance_authority
    );
    assert_eq!(current_config.target_governance_authority, None);
    assert_eq!(current_config.wormhole, new_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(
        current_config.single_update_fee_in_lamports,
        new_config.single_update_fee_in_lamports
    );
    assert_eq!(
        current_config.minimum_signatures,
        new_config.minimum_signatures
    );

    // Target is not defined yet
    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                AcceptGovernanceAuthorityTransfer::populate(new_governance_authority.pubkey()),
                &vec![&new_governance_authority],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::NonexistentGovernanceAuthorityTransferRequest)
    );

    // Request transfer
    program_simulator
        .process_ix_with_default_compute_limit(
            RequestGovernanceAuthorityTransfer::populate(
                governance_authority.pubkey(),
                new_governance_authority.pubkey(),
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        initial_config.governance_authority
    );
    assert_eq!(
        current_config.target_governance_authority,
        Some(new_governance_authority.pubkey())
    );
    assert_eq!(current_config.wormhole, new_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(
        current_config.single_update_fee_in_lamports,
        new_config.single_update_fee_in_lamports
    );
    assert_eq!(
        current_config.minimum_signatures,
        new_config.minimum_signatures
    );

    let poster = program_simulator.get_funded_keypair().await.unwrap();
    // Random guy can't accept

    assert_eq!(
        program_simulator
            .process_ix_with_default_compute_limit(
                AcceptGovernanceAuthorityTransfer::populate(poster.pubkey()),
                &vec![&poster],
                None,
            )
            .await
            .unwrap_err()
            .unwrap(),
        into_transaction_error(ReceiverError::TargetGovernanceAuthorityMismatch)
    );

    // Undo the request
    program_simulator
        .process_ix_with_default_compute_limit(
            CancelGovernanceAuthorityTransfer::populate(governance_authority.pubkey()),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        initial_config.governance_authority
    );
    assert_eq!(current_config.target_governance_authority, None);
    assert_eq!(current_config.wormhole, new_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(
        current_config.single_update_fee_in_lamports,
        new_config.single_update_fee_in_lamports
    );
    assert_eq!(
        current_config.minimum_signatures,
        new_config.minimum_signatures
    );

    // Redo the request
    program_simulator
        .process_ix_with_default_compute_limit(
            RequestGovernanceAuthorityTransfer::populate(
                governance_authority.pubkey(),
                new_governance_authority.pubkey(),
            ),
            &vec![&governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        initial_config.governance_authority
    );
    assert_eq!(
        current_config.target_governance_authority,
        Some(new_governance_authority.pubkey())
    );
    assert_eq!(current_config.wormhole, new_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(
        current_config.single_update_fee_in_lamports,
        new_config.single_update_fee_in_lamports
    );
    assert_eq!(
        current_config.minimum_signatures,
        new_config.minimum_signatures
    );

    // New authority can accept
    program_simulator
        .process_ix_with_default_compute_limit(
            AcceptGovernanceAuthorityTransfer::populate(new_governance_authority.pubkey()),
            &vec![&new_governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(current_config, new_config);

    // Now the new authority can do stuff
    program_simulator
        .process_ix_with_default_compute_limit(
            SetFee::populate(new_governance_authority.pubkey(), 9),
            &vec![&new_governance_authority],
            None,
        )
        .await
        .unwrap();

    current_config = program_simulator
        .get_anchor_account_data::<Config>(get_config_address())
        .await
        .unwrap();
    assert_eq!(
        current_config.governance_authority,
        new_config.governance_authority
    );
    assert_eq!(current_config.target_governance_authority, None);
    assert_eq!(current_config.wormhole, new_config.wormhole);
    assert_eq!(
        current_config.valid_data_sources,
        new_config.valid_data_sources
    );
    assert_eq!(current_config.single_update_fee_in_lamports, 9);
    assert_eq!(
        current_config.minimum_signatures,
        new_config.minimum_signatures
    );
}
