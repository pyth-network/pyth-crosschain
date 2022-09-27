

pub mod cli;

use std::convert::TryFrom;
use std::rc::Rc;
use std::str::FromStr;

use anchor_client::anchor_lang::{Owner, AnchorSerialize, AnchorDeserialize};
use cli::{Cli, Action};
use clap::Parser;

use anchor_client::{Client, Cluster};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{read_keypair_file, Keypair};
use anyhow::Result;
use solana_sdk::signer::Signer;
use solana_sdk::transaction::Transaction;
use solana_sdk::{system_program, system_instruction, message};
use solana_client::rpc_client::RpcClient;
use wormhole_solana::{Account, Config};
use wormhole_solana::instruction::post_message_unreliable;
use wormhole_solana::FeeCollector;
use remote_executor::state::governance_payload::{ExecutorPayload, GovernanceHeader};
use remote_executor::state::posted_vaa::AnchorVaa;


// #[cfg(not(feature = "pythtest"))]
// pub const PYTHNET_URL : &str = "https://pythnet.rpcpool.com/";

// #[cfg(feature = "pythtest")]
// fn owner() -> Pubkey {
//     Pubkey::from_str("EUrRARh92Cdc54xrDn6qzaqjA77NRrCcfbr8kPwoTL4z").unwrap()
// }


fn main() -> Result<()>{
    let cli = Cli::parse();

    let payer = read_keypair_file(&*shellexpand::tilde(&cli.keypair)).expect("Keypair not found");

    match cli.action {
        Action::PostAndExecute{vaa } => {
            let RPC_URL : Cluster = Cluster::Custom(
                "https://pythnet.rpcpool.com/".to_string(),
                "ws://pythnet.rpcpool.com/".to_string(),
            );
            
            let rpc_client = Client::new_with_options(RPC_URL, Rc::new(payer), cli.commitment);

            let program = rpc_client.program(remote_executor::id());

            program.request();
            Ok(())

            
        },
        Action::SendTestVAA{} => {
            let rpc_client = RpcClient::new_with_commitment("https://api.mainnet-beta.solana.com", cli.commitment);

            let message_keypair = Keypair::new();

            let wormhole_bridge_key = Pubkey::from_str("worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth")?;
            let fee_collector_key = FeeCollector::key(&wormhole_bridge_key, ());
            let wormhole_config_key = Config::key(&wormhole_bridge_key, ());


            let wormhole_config  = Config::try_from_slice(&rpc_client.get_account_data(&wormhole_config_key)?)?;

            let payload = ExecutorPayload{ header : GovernanceHeader::executor_governance_header(), instructions: vec![] }.try_to_vec()?;

            let transfer_instruction = system_instruction::transfer(&payer.pubkey(), &fee_collector_key, wormhole_config.params.fee);
            let post_vaa_instruction = post_message_unreliable(wormhole_bridge_key,
             payer.pubkey(), 
             payer.pubkey(), message_keypair.pubkey(), 0,payload.as_slice(), 0)?;
            
            let mut transaction =
            Transaction::new_with_payer(&[transfer_instruction, post_vaa_instruction], Some(&payer.pubkey()));

            transaction.sign(&[&message_keypair, &payer], rpc_client.get_latest_blockhash()?);
            
            rpc_client.send_and_confirm_transaction_with_spinner(&transaction)?;
            Ok(())
        },

    }
    
    
    
}
