use {
    super::executor_simulator::{ExecutorAttack, ExecutorBench, VaaAttack},
    crate::error::ExecutorError,
    anchor_lang::prelude::{ErrorCode, ProgramError, Pubkey, Rent},
    solana_sdk::{
        instruction::InstructionError, native_token::LAMPORTS_PER_SOL,
        system_instruction::transfer, transaction::TransactionError,
    },
};

#[tokio::test]
/// This test file tests that the executor fails (and checks the errors to make sure it fails for the right reason) when :
/// - The VAA has a bad format
/// - The VAA is not owned by the bridge
/// - The VAA was not emitted by Solana
/// - Another account is passed in place of the system program
/// - A claim_record account not seeded by the emitter of the VAA is passed

async fn test_adversarial() {
    let mut bench = ExecutorBench::new();
    let emitter = Pubkey::new_unique();
    let emitter_2 = Pubkey::new_unique();
    let executor_key = bench.get_executor_key(&emitter);
    let claim_record_2 = bench.get_claim_record_key(&emitter_2);

    let receiver = Pubkey::new_unique();

    // Setup VAAs
    let vaa_account_valid = bench.add_vaa_account(
        &emitter,
        &[transfer(
            &executor_key,
            &receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaAttack::None,
    );
    let vaa_account_wrong_data = bench.add_vaa_account(
        &emitter,
        &[transfer(
            &executor_key,
            &receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaAttack::WrongData,
    );
    let vaa_account_wrong_owner = bench.add_vaa_account(
        &emitter,
        &[transfer(
            &executor_key,
            &receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaAttack::WrongOwner,
    );
    let vaa_account_wrong_emitter_chain = bench.add_vaa_account(
        &emitter,
        &[transfer(
            &executor_key,
            &receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaAttack::WrongEmitterChain,
    );

    let vaa_account_wrong_vaa_magic = bench.add_vaa_account(
        &emitter,
        &[transfer(
            &executor_key,
            &receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaAttack::WrongVaaMagic,
    );

    // The goal of this account is creating a claim_record that the attacker is going to try to use to impersonate
    // the right claim_record
    let vaa_account_valid_2 = bench.add_vaa_account(&emitter_2, &[], VaaAttack::None);

    let mut sim = bench.start().await;
    sim.airdrop(&executor_key, LAMPORTS_PER_SOL).await.unwrap();

    // VAA with random bytes
    assert_eq!(
        sim.execute_posted_vaa(
            &vaa_account_valid,
            &vec![],
            ExecutorAttack::WrongVaaAddress(vaa_account_wrong_data)
        )
        .await
        .unwrap_err()
        .unwrap(),
        ErrorCode::AccountDidNotDeserialize.into_transation_error()
    );

    // VAA not owned by the wormhole bridge
    assert_eq!(
        sim.execute_posted_vaa(&vaa_account_wrong_owner, &vec![], ExecutorAttack::None)
            .await
            .unwrap_err()
            .unwrap(),
        ErrorCode::AccountOwnedByWrongProgram.into_transation_error()
    );

    // VAA not emitted by a soruce in Solana
    assert_eq!(
        sim.execute_posted_vaa(
            &vaa_account_wrong_emitter_chain,
            &vec![],
            ExecutorAttack::None
        )
        .await
        .unwrap_err()
        .unwrap(),
        ExecutorError::EmitterChainNotSolana.into()
    );

    // VAA has wrong magic number
    assert_eq!(
        sim.execute_posted_vaa(&vaa_account_wrong_vaa_magic, &vec![], ExecutorAttack::None)
            .await
            .unwrap_err()
            .unwrap(),
        ExecutorError::PostedVaaHeaderWrongMagicNumber.into()
    );

    // Claim record does not correspond to the emitter's claim record
    assert_eq!(
        sim.execute_posted_vaa(
            &vaa_account_valid,
            &vec![],
            ExecutorAttack::WrongEmptyClaimAddress
        )
        .await
        .unwrap_err()
        .unwrap(),
        ErrorCode::ConstraintSeeds.into_transation_error()
    );

    // Claim record does not correspond to the emitter's claim record, but this time it is initialized
    sim.execute_posted_vaa(&vaa_account_valid_2, &vec![], ExecutorAttack::None)
        .await
        .unwrap();
    assert_eq!(
        sim.execute_posted_vaa(
            &vaa_account_valid,
            &vec![],
            ExecutorAttack::WrongClaimAddress(claim_record_2)
        )
        .await
        .unwrap_err()
        .unwrap(),
        ErrorCode::ConstraintSeeds.into_transation_error()
    );

    // System program impersonation
    assert_eq!(
        sim.execute_posted_vaa(
            &vaa_account_valid,
            &vec![],
            ExecutorAttack::WrongSystemProgram
        )
        .await
        .unwrap_err()
        .unwrap(),
        ErrorCode::InvalidProgramId.into_transation_error()
    );

    //Success!
    sim.execute_posted_vaa(&vaa_account_valid, &vec![], ExecutorAttack::None)
        .await
        .unwrap()
}

pub trait IntoTransactionError {
    fn into_transation_error(self) -> TransactionError;
}

impl IntoTransactionError for ErrorCode {
    fn into_transation_error(self) -> TransactionError {
        TransactionError::InstructionError(
            0,
            InstructionError::try_from(u64::from(ProgramError::from(
                anchor_lang::prelude::Error::from(self),
            )))
            .unwrap(),
        )
    }
}
impl IntoTransactionError for InstructionError {
    fn into_transation_error(self) -> TransactionError {
        TransactionError::InstructionError(0, self)
    }
}
