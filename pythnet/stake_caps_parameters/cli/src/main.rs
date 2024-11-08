pub mod cli;
use {
    anchor_lang::{InstructionData, ToAccountMetas},
    clap::Parser,
    cli::Cli,
    solana_client::rpc_client::RpcClient,
    solana_sdk::{
        commitment_config::CommitmentConfig, instruction::Instruction, signer::Signer,
        transaction::Transaction,
    },
    stake_caps_parameters::{Parameters, PARAMETERS_ADDRESS},
};

fn main() {
    let Cli {
        keypair,
        rpc_url,
        m,
        z,
        authority,
    } = Cli::parse();
    let accs = stake_caps_parameters::accounts::SetParameters {
        signer: keypair.pubkey(),
        parameters: PARAMETERS_ADDRESS,
        system_program: solana_sdk::system_program::id(),
    };
    let rpc_client = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed());

    let instruction = Instruction {
        program_id: stake_caps_parameters::id(),
        accounts: accs.to_account_metas(None),
        data: stake_caps_parameters::instruction::SetParameters {
            parameters: Parameters {
                m,
                z,
                current_authority: authority,
            },
        }
        .data(),
    };

    let mut transaction = Transaction::new_with_payer(&[instruction], Some(&keypair.pubkey()));
    transaction.sign(&[&keypair], rpc_client.get_latest_blockhash().unwrap());
    let transaction_signature = rpc_client
        .send_and_confirm_transaction_with_spinner(&transaction)
        .unwrap();
    println!("Transaction successful : {transaction_signature:?}");
}
