use crate::{
    error::ExecutorError,
    EXECUTOR_KEY_SEED,
};

use super::executor_simulator::{
    ExecutorAttack,
    ExecutorBench,
    VaaValidity,
};
use anchor_lang::{
    prelude::{
        AnchorError,
        ErrorCode,
        ProgramError,
        Pubkey,
        Rent,
    },
    solana_program::{
        system_instruction::create_account,
        system_program,
    },
};
use solana_sdk::{
    instruction::InstructionError,
    native_token::LAMPORTS_PER_SOL,
    signature::Keypair,
    signer::Signer,
    system_instruction::transfer,
    transaction::TransactionError,
};

#[tokio::test]
async fn test_adversarial() {
    let mut bench = ExecutorBench::new();
    let emitter = Pubkey::new_unique();
    let emitter_2 = Pubkey::new_unique();
    let executor_key = bench.get_executor_key(&emitter);
    let claim_record_2 = bench.get_claim_record_key(&emitter_2);

    let receiver = Pubkey::new_unique();

    let vaa_account_valid = bench.add_vaa_account(
        &emitter,
        &vec![transfer(
            &executor_key,
            &&receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaValidity::Valid,
    );
    let vaa_account_wrong_data = bench.add_vaa_account(
        &emitter,
        &vec![transfer(
            &executor_key,
            &&receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaValidity::WrongData,
    );
    let vaa_account_wrong_owner = bench.add_vaa_account(
        &emitter,
        &vec![transfer(
            &executor_key,
            &&receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaValidity::WrongOwner,
    );
    let vaa_account_wrong_emitter_chain = bench.add_vaa_account(
        &emitter,
        &vec![transfer(
            &executor_key,
            &&receiver,
            Rent::default().minimum_balance(0),
        )],
        VaaValidity::WrongEmitterChain,
    );

    let vaa_account_valid_2 = bench.add_vaa_account(&emitter_2, &vec![], VaaValidity::Valid);

    let mut sim = bench.start().await;
    sim.airdrop(&executor_key, LAMPORTS_PER_SOL).await.unwrap();

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
    assert_eq!(
        sim.execute_posted_vaa(&vaa_account_wrong_owner, &vec![], ExecutorAttack::None)
            .await
            .unwrap_err()
            .unwrap(),
        ErrorCode::AccountOwnedByWrongProgram.into_transation_error()
    );
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

    // Next error is privilege scalation because anchor tries to create the account at wrong address but signing with the right seeds
    assert_eq!(
        sim.execute_posted_vaa(
            &vaa_account_valid,
            &vec![],
            ExecutorAttack::WrongEmptyClaimAddress
        )
        .await
        .unwrap_err()
        .unwrap(),
        InstructionError::PrivilegeEscalation.into_transation_error()
    );

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
