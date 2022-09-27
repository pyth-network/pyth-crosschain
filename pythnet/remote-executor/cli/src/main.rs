

pub mod cli;

use std::convert::TryFrom;
use std::rc::Rc;
use std::str::FromStr;

use anchor_client::anchor_lang::{Owner, AnchorSerialize, AnchorDeserialize, AccountDeserialize};
use cli::{Cli, Action};
use clap::Parser;

use anchor_client::{Client, Cluster};
use remote_executor::remote_executor::execute_posted_vaa;
use solana_client::rpc_config::RpcSendTransactionConfig;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{read_keypair_file, Keypair};
use anyhow::Result;
use solana_sdk::signer::Signer;
use solana_sdk::system_instruction::transfer;
use solana_sdk::transaction::Transaction;
use solana_sdk::{system_program, system_instruction, message, commitment_config};
use solana_client::rpc_client::RpcClient;
use wormhole_solana::{Account, Config, GuardianSet, VAA as PostedVAA};
use wormhole_solana::instructions::{post_message, post_vaa, verify_signatures_txs, PostVAAData};
use wormhole_solana::FeeCollector;

use wormhole::VAA;
use remote_executor::state::governance_payload::{ExecutorPayload, GovernanceHeader};
use remote_executor::state::posted_vaa::AnchorVaa;

fn main() -> Result<()>{
    let cli = Cli::parse();

    match cli.action {
        Action::PostAndExecute{vaa, keypair } => {
            let payer = read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let rpc_client = RpcClient::new_with_commitment("https://pythnet.rpcpool.com/", cli.commitment);
            
            let vaa_bytes : Vec<u8> = base64::decode(vaa)?;
            let wormhole_bridge_key = AnchorVaa::owner();
            let wormhole_config_key = Config::key(&wormhole_bridge_key, ());
            let wormhole_config  = Config::try_from_slice(&rpc_client.get_account_data(&wormhole_config_key)?)?;

            let guardian_set_key =  GuardianSet::key(&wormhole_bridge_key, wormhole_config.guardian_set_index);
            let guardian_set_data = GuardianSet::try_from_slice(&rpc_client.get_account_data(&guardian_set_key)?)?;

            let signature_set_keypair = Keypair::new();

            let vaa = VAA::from_bytes(vaa_bytes.clone())?;

            // RENT HACK STARTS HERE
            // let signature_set_size = 4 + 19 + 32 + 4;
            // let posted_vaa_size = 3 + 1 + 1 + 4 + 32 + 4 + 4 + 8 + 2 + 32 + 4 + vaa.payload.len();
            let posted_vaa_key = PostedVAA::key(&wormhole_bridge_key, vaa.digest().unwrap().hash);

            // let mut  transaction =
            // Transaction::new_with_payer(&[transfer(&payer.pubkey(), &signature_set_keypair.pubkey(), rpc_client.get_minimum_balance_for_rent_exemption(signature_set_size)?),
            //  transfer(&payer.pubkey(), &posted_vaa_key, rpc_client.get_minimum_balance_for_rent_exemption(posted_vaa_size)?)], Some(&payer.pubkey()));
            //  transaction.sign(&[&payer], rpc_client.get_latest_blockhash()?);
            //  let transaction_signature = rpc_client.send_and_confirm_transaction_with_spinner(&transaction)?;
            // println!("Transaction successful : {:?}", transaction_signature);
            // // RENT HACK ENDS HERE

            // // First verify VAA
            // let verify_txs = verify_signatures_txs(vaa_bytes.as_slice(), guardian_set_data, wormhole_bridge_key, payer.pubkey(), wormhole_config.guardian_set_index, signature_set_keypair.pubkey())?;
 
            // for tx in verify_txs {
            //     let mut transaction =
            //     Transaction::new_with_payer(&tx, Some(&payer.pubkey()));

            //     transaction.sign(&[&signature_set_keypair, &payer], rpc_client.get_latest_blockhash()?);

            //     let transaction_signature = rpc_client.send_and_confirm_transaction_with_spinner(&transaction)?;
            //     println!("Transaction successful : {:?}", transaction_signature);
            // }

            // Post VAA 
            // let post_vaa_data = PostVAAData {
            //     version: vaa.version,
            //     guardian_set_index: vaa.guardian_set_index,
            //     timestamp: vaa.timestamp,
            //     nonce: vaa.nonce,
            //     emitter_chain: vaa.emitter_chain.into(),
            //     emitter_address: vaa.emitter_address,
            //     sequence: vaa.sequence,
            //     consistency_level: vaa.consistency_level,
            //     payload: vaa.payload,
            // };
            // let mut transaction = Transaction::new_with_payer(&[post_vaa(wormhole_bridge_key, payer.pubkey(), signature_set_keypair.pubkey(), post_vaa_data)?], Some(&payer.pubkey()));
            // transaction.sign(&[&payer], rpc_client.get_latest_blockhash()?);

            // let transaction_signature = rpc_client.send_and_confirm_transaction_with_spinner(&transaction)?;
            // println!("Transaction successful : {:?}", transaction_signature);

            // Now execute 
            let anchor_vaa  = AnchorVaa::try_deserialize(&mut rpc_client.get_account_data(&posted_vaa_key)?.as_slice())?;

            println!("Posted vaa {:?}", anchor_vaa.vaa);

            Ok(())


        },
        Action::SendTestVAA{keypair} => {
            let payer = read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let rpc_client = RpcClient::new_with_commitment("https://api.mainnet-beta.solana.com", cli.commitment);

            let message_keypair = Keypair::new();

            let wormhole_bridge_key = Pubkey::from_str("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth")?;
            let fee_collector_key = FeeCollector::key(&wormhole_bridge_key, ());
            let wormhole_config_key = Config::key(&wormhole_bridge_key, ());


            let wormhole_config  = Config::try_from_slice(&rpc_client.get_account_data(&wormhole_config_key)?)?;

            let payload = ExecutorPayload{ header : GovernanceHeader::executor_governance_header(), instructions: vec![] }.try_to_vec()?;

            let transfer_instruction = system_instruction::transfer(&payer.pubkey(), &fee_collector_key, wormhole_config.params.fee);
            let post_vaa_instruction = post_message(wormhole_bridge_key,
             payer.pubkey(),
             payer.pubkey(), message_keypair.pubkey(), 0,payload.as_slice(), 0)?;

            let mut transaction =
            Transaction::new_with_payer(&[transfer_instruction, post_vaa_instruction], Some(&payer.pubkey()));

            transaction.sign(&[&message_keypair, &payer], rpc_client.get_latest_blockhash()?);

            let transaction_signature = rpc_client.send_and_confirm_transaction_with_spinner(&transaction)?;
            println!("Transaction successful : {:?}", transaction_signature);
            Ok(())
        },

    }



}
