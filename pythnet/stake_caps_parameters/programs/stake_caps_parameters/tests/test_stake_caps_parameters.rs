use {
    anchor_lang::{
        error::Error, solana_program::native_token::LAMPORTS_PER_SOL, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    litesvm::{types::TransactionResult, LiteSVM},
    solana_sdk::{
        instruction::{Instruction, InstructionError},
        program_error::ProgramError,
        signature::Keypair,
        signer::Signer,
        transaction::{Transaction, TransactionError},
    },
    stake_caps_parameters::{ErrorCode, Parameters, PARAMETERS_ADDRESS},
};

#[test]
fn test_stake_caps_parameters() {
    let mut svm = litesvm::LiteSVM::new();
    let payer_1 = Keypair::new();
    let payer_2 = Keypair::new();

    svm.add_program_from_file(
        stake_caps_parameters::ID,
        "../../target/deploy/stake_caps_parameters.so",
    )
    .unwrap();

    svm.airdrop(&payer_1.pubkey(), LAMPORTS_PER_SOL).unwrap();
    svm.airdrop(&payer_2.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let parameter_1 = Parameters {
        current_authority: payer_1.pubkey(),
        m: 1,
        z: 2,
    };

    assert!(set_parameters(&mut svm, &payer_1, parameter_1).is_ok());
    assert_eq!(fetch_current_parameters(&mut svm), parameter_1);

    let parameter_2 = Parameters {
        current_authority: payer_2.pubkey(),
        m: 3,
        z: 4,
    };

    require_wrong_authority_error(set_parameters(&mut svm, &payer_2, parameter_2));
    assert_eq!(fetch_current_parameters(&mut svm), parameter_1);

    assert!(set_parameters(&mut svm, &payer_1, parameter_2).is_ok());
    assert_eq!(fetch_current_parameters(&mut svm), parameter_2);

    let parameter_3 = Parameters {
        current_authority: payer_1.pubkey(),
        m: 5,
        z: 6,
    };

    require_wrong_authority_error(set_parameters(&mut svm, &payer_1, parameter_3));
    assert!(set_parameters(&mut svm, &payer_2, parameter_3).is_ok());
    assert_eq!(fetch_current_parameters(&mut svm), parameter_3);
}

fn set_parameters(svm: &mut LiteSVM, payer: &Keypair, parameters: Parameters) -> TransactionResult {
    let instruction = Instruction::new_with_bytes(
        stake_caps_parameters::ID,
        &stake_caps_parameters::instruction::SetParameters { parameters }.data(),
        stake_caps_parameters::accounts::SetParameters {
            signer: payer.pubkey(),
            parameters: PARAMETERS_ADDRESS,
            system_program: solana_sdk::system_program::ID,
        }
        .to_account_metas(None),
    );

    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );
    svm.send_transaction(transaction)
}

fn fetch_current_parameters(svm: &mut LiteSVM) -> Parameters {
    let account = svm.get_account(&PARAMETERS_ADDRESS).unwrap();
    Parameters::try_deserialize(&mut account.data.as_ref()).unwrap()
}

fn require_wrong_authority_error(transaction_result: TransactionResult) {
    assert_eq!(
        transaction_result.unwrap_err().err,
        TransactionError::InstructionError(
            0,
            InstructionError::from(u64::from(ProgramError::from(Error::from(
                ErrorCode::WrongAuthority
            ))))
        )
    );
}
