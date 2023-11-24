use {
    crate::program_test::ProgramSimulator,
    anchor_lang::{
        prelude::*,
        InstructionData,
        ToAccountMetas,
    },
    pyth_solana_receiver::{
        accounts as receiver_accounts,
        instruction as receiver_instruction,
    },
    rand::rngs::OsRng,
    solana_program::instruction::Instruction,
    solana_sdk::{
        keccak,
        signature::Signer,
    },
};

#[tokio::test]
async fn test_update_price() {
    let mut sim = ProgramSimulator::new().await;

    let message = b"hello world";
    let message_hash = {
        let mut hasher = keccak::Hasher::default();
        hasher.hash(message);
        hasher.result()
    };

    let secp256k1_secret_key = libsecp256k1::SecretKey::random(&mut OsRng);
    let secp_message = libsecp256k1::Message::parse(&message_hash.0);
    let (signature, recovery_id) = libsecp256k1::sign(&secp_message, &secp256k1_secret_key);

    let accounts = receiver_accounts::Update {
        payer: sim.genesis_keypair.pubkey(),
    }
    .to_account_metas(None);
    let instruction_data = receiver_instruction::Update {
        data:        message.to_vec(),
        recovery_id: recovery_id.serialize(),
        signature:   signature.serialize(),
    }
    .data();

    let inst = Instruction::new_with_bytes(sim.program_id, &instruction_data, accounts);

    sim.process_ix(inst, &vec![], &sim.genesis_keypair.insecure_clone())
        .await
        .unwrap();
}
