#![deny(warnings)]

use {
    serde_wormhole::RawMessage,
    wormhole_sdk::vaa::{Body, Header, Vaa},
};
pub mod cli;
use {
    anchor_client::{
        anchor_lang::{
            AccountDeserialize, AnchorDeserialize, AnchorSerialize,
            InstructionData as AnchorInstructionData, Owner, ToAccountMetas,
        },
        solana_sdk::bpf_loader_upgradeable,
    },
    anyhow::Result,
    clap::Parser,
    cli::{Action, Cli},
    remote_executor::{
        accounts::ExecutePostedVaa,
        state::{
            governance_payload::{ExecutorPayload, GovernanceHeader, InstructionData},
            posted_vaa::AnchorVaa,
        },
        EXECUTOR_KEY_SEED, ID,
    },
    solana_client::{rpc_client::RpcClient, rpc_config::RpcSendTransactionConfig},
    solana_sdk::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        signature::{read_keypair_file, Keypair},
        signer::Signer,
        system_instruction::{self},
        transaction::Transaction,
    },
    std::str::FromStr,
    wormhole_solana::{
        instructions::{post_message, post_vaa, verify_signatures_txs, PostVAAData},
        Account, Config, FeeCollector, GuardianSet, VAA as PostedVAA,
    },
};

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.action {
        Action::PostAndExecute { vaa, keypair } => {
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let rpc_client = RpcClient::new_with_commitment(&cli.rpc_url, cli.commitment);

            let vaa_bytes: Vec<u8> = base64::decode(vaa)?;
            let wormhole = AnchorVaa::owner();

            let wormhole_config = Config::key(&wormhole, ());
            let wormhole_config_data =
                Config::try_from_slice(&rpc_client.get_account_data(&wormhole_config)?)?;

            let guardian_set_data_offset = if cli.chain == 26 { 0 } else { 8 }; // Pythnet's guardian set account has no discriminator
            let guardian_set = GuardianSet::key(&wormhole, wormhole_config_data.guardian_set_index);
            let guardian_set_data = GuardianSet::try_from_slice(
                &rpc_client.get_account_data(&guardian_set)?[guardian_set_data_offset..],
            )?;

            let signature_set_keypair = Keypair::new();

            let vaa: Vaa<&RawMessage> = serde_wormhole::from_slice(&vaa_bytes)?;
            let (header, body): (Header, Body<&RawMessage>) = vaa.into();

            let posted_vaa_key = PostedVAA::key(&wormhole, body.digest().unwrap().hash);

            // First verify VAA
            let verify_txs = verify_signatures_txs(
                vaa_bytes.as_slice(),
                guardian_set_data,
                wormhole,
                payer.pubkey(),
                wormhole_config_data.guardian_set_index,
                signature_set_keypair.pubkey(),
            )?;

            for tx in verify_txs {
                process_transaction(&rpc_client, tx, &vec![&payer, &signature_set_keypair])?;
            }

            // Post VAA
            let post_vaa_data = PostVAAData {
                version: header.version,
                guardian_set_index: header.guardian_set_index,
                timestamp: body.timestamp,
                nonce: body.nonce,
                emitter_chain: body.emitter_chain.into(),
                emitter_address: body.emitter_address.0,
                sequence: body.sequence,
                consistency_level: body.consistency_level,
                payload: body.payload.to_vec(),
            };

            process_transaction(
                &rpc_client,
                vec![post_vaa(
                    wormhole,
                    payer.pubkey(),
                    signature_set_keypair.pubkey(),
                    post_vaa_data,
                )?],
                &vec![&payer],
            )?;

            // Now execute
            process_transaction(
                &rpc_client,
                vec![get_execute_instruction(
                    &rpc_client,
                    &posted_vaa_key,
                    &payer.pubkey(),
                )?],
                &vec![&payer],
            )?;

            Ok(())
        }

        Action::SendTestVAA { keypair } => {
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let rpc_client = RpcClient::new_with_commitment(
                "https://api.mainnet-beta.solana.com",
                cli.commitment,
            );

            let message_keypair = Keypair::new();
            let wormhole = Pubkey::from_str("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth")?;

            let fee_collector = FeeCollector::key(&wormhole, ());
            let wormhole_config = Config::key(&wormhole, ());

            let wormhole_config_data =
                Config::try_from_slice(&rpc_client.get_account_data(&wormhole_config)?)?;

            let executor_key = Pubkey::find_program_address(
                &[EXECUTOR_KEY_SEED.as_bytes(), &payer.pubkey().to_bytes()],
                &ID,
            )
            .0;
            let payload = ExecutorPayload {
                header: GovernanceHeader::executor_governance_header(cli.chain),
                instructions: vec![InstructionData::from(&system_instruction::transfer(
                    &executor_key,
                    &payer.pubkey(),
                    1,
                ))],
            }
            .try_to_vec()?;

            let transfer_instruction = system_instruction::transfer(
                &payer.pubkey(),
                &fee_collector,
                wormhole_config_data.params.fee,
            );
            let post_vaa_instruction = post_message(
                wormhole,
                payer.pubkey(),
                payer.pubkey(),
                message_keypair.pubkey(),
                0,
                payload.as_slice(),
                0,
            )?;

            process_transaction(
                &rpc_client,
                vec![transfer_instruction, post_vaa_instruction],
                &vec![&payer, &message_keypair],
            )
        }
        Action::GetTestPayload {} => {
            let payload = ExecutorPayload {
                header: GovernanceHeader::executor_governance_header(cli.chain),
                instructions: vec![],
            }
            .try_to_vec()?;
            println!("Test payload : {:?}", hex::encode(payload));
            Ok(())
        }
        Action::MapKey { pubkey } => {
            let executor_key = Pubkey::find_program_address(
                &[EXECUTOR_KEY_SEED.as_bytes(), &pubkey.to_bytes()],
                &ID,
            )
            .0;
            println!("{pubkey:?} maps to {executor_key:?}");
            Ok(())
        }

        Action::GetSetUpgradeAuthorityPayload {
            current,
            new,
            program_id,
        } => {
            let mut instruction =
                bpf_loader_upgradeable::set_upgrade_authority(&program_id, &current, Some(&new));
            instruction.accounts[2].is_signer = true; // Require signature of new authority for safety
            println!("New authority : {:}", instruction.accounts[2].pubkey);
            let payload = ExecutorPayload {
                header: GovernanceHeader::executor_governance_header(cli.chain),
                instructions: vec![InstructionData::from(&instruction)],
            }
            .try_to_vec()?;
            println!("Set upgrade authority payload : {:?}", hex::encode(payload));
            Ok(())
        }

        Action::GetUpgradeProgramPayload {
            program_id,
            authority,
            new_buffer,
            spill,
        } => {
            let instruction =
                bpf_loader_upgradeable::upgrade(&program_id, &new_buffer, &authority, &spill);
            println!("New buffer : {:}", instruction.accounts[2].pubkey);
            println!(
                "Extra PGAS will be sent to : {:}",
                instruction.accounts[3].pubkey
            );
            let payload = ExecutorPayload {
                header: GovernanceHeader::executor_governance_header(cli.chain),
                instructions: vec![InstructionData::from(&instruction)],
            }
            .try_to_vec()?;
            println!("Upgrade program payload : {:?}", hex::encode(payload));
            Ok(())
        }
    }
}

pub fn process_transaction(
    rpc_client: &RpcClient,
    instructions: Vec<Instruction>,
    signers: &Vec<&Keypair>,
) -> Result<()> {
    let mut transaction =
        Transaction::new_with_payer(instructions.as_slice(), Some(&signers[0].pubkey()));
    let recent_blockhash = rpc_client.get_latest_blockhash()?;
    transaction.sign(signers, recent_blockhash);

    // Simulate the transaction
    let simulation_result = rpc_client.simulate_transaction(&transaction)?;

    // Check if simulation was successful
    if let Some(err) = simulation_result.value.err {
        println!("Transaction simulation failed: {:?}", err);
        if let Some(logs) = simulation_result.value.logs {
            println!("Simulation logs:");
            for (i, log) in logs.iter().enumerate() {
                println!("  {}: {}", i, log);
            }
        }
        return Err(anyhow::anyhow!("Transaction simulation failed"));
    }

    // If simulation was successful, send the actual transaction
    let config = RpcSendTransactionConfig {
        skip_preflight: true,
        ..RpcSendTransactionConfig::default()
    };
    let transaction_signature = rpc_client.send_transaction_with_config(&transaction, config)?;
    println!("Transaction sent: {transaction_signature:?}");

    // Wait for confirmation
    rpc_client.confirm_transaction_with_spinner(
        &transaction_signature,
        &recent_blockhash,
        rpc_client.commitment(),
    )?;

    println!("Transaction confirmed: {transaction_signature:?}");
    Ok(())
}

pub fn get_execute_instruction(
    rpc_client: &RpcClient,
    posted_vaa_key: &Pubkey,
    payer_pubkey: &Pubkey,
) -> Result<Instruction> {
    let anchor_vaa =
        AnchorVaa::try_deserialize(&mut rpc_client.get_account_data(posted_vaa_key)?.as_slice())?;
    let emitter = Pubkey::from(anchor_vaa.emitter_address);

    // First accounts from the anchor context
    let mut account_metas = ExecutePostedVaa::populate(&ID, payer_pubkey, &emitter, posted_vaa_key)
        .to_account_metas(None);

    // Look at the payload
    let executor_payload: ExecutorPayload =
        AnchorDeserialize::try_from_slice(anchor_vaa.payload.as_slice()).unwrap();

    // We need to add `executor_key` to the list of accounts
    let executor_key = Pubkey::find_program_address(
        &[EXECUTOR_KEY_SEED.as_bytes(), &anchor_vaa.emitter_address],
        &ID,
    )
    .0;

    account_metas.push(AccountMeta {
        pubkey: executor_key,
        is_signer: false,
        is_writable: true,
    });

    // Add the rest of `remaining_accounts` from the payload
    for instruction in executor_payload.instructions {
        // Push program_id
        account_metas.push(AccountMeta {
            pubkey: instruction.program_id,
            is_signer: false,
            is_writable: false,
        });
        // Push other accounts
        for account_meta in Instruction::from(&instruction).accounts {
            if account_meta.pubkey != executor_key {
                account_metas.push(account_meta.clone());
            }
        }
    }

    Ok(Instruction {
        program_id: ID,
        accounts: account_metas,
        data: remote_executor::instruction::ExecutePostedVaa.data(),
    })
}
