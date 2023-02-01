pub mod cli;

use {
    cli::{
        Action,
        Cli,
    },
    clap::Parser,
    anyhow::Result,
    std::str::FromStr,

    solana_sdk::{
        pubkey::Pubkey,
        signature::{
            read_keypair_file,
            Keypair,
        },
        signer::Signer,
        instruction::Instruction,
        transaction::Transaction,
        system_instruction::transfer,
    },

    wormhole::VAA,
    wormhole_solana::{
        Account,
        GuardianSet,
        VAA as PostedVAA,
        Config as WormholeConfig,
        instructions::{
            post_vaa,
            verify_signatures_txs,
            PostVAAData,
        },
    },

    solana_client::rpc_client::RpcClient,
    anchor_client::anchor_lang::AnchorDeserialize,
};

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.action {
        Action::PostPriceVAA { vaa, keypair } => {
            println!("PostPriceVAA is invoked with vaa\"{}\"", vaa);
            // Hard-coded strings
            let rpc_client = RpcClient::new("https://api.devnet.solana.com");
            // Is RpcClient::new_with_commitment necessary?
            let wormhole = Pubkey::from_str("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5").unwrap();

            println!("Decode the VAA");
            let vaa_bytes: Vec<u8> = base64::decode(vaa)?;
            let vaa = VAA::from_bytes(vaa_bytes.clone())?;

            println!("Transfer money to two accounts: signature_set and posted_vaa");
            let signature_set_keypair = Keypair::new();
            let signature_set_size = 4 + 19 + 32 + 4;
            let posted_vaa_size = 3 + 1 + 1 + 4 + 32 + 4 + 4 + 8 + 2 + 32 + 4 + vaa.payload.len();
            let posted_vaa_key = PostedVAA::key(&wormhole, vaa.digest().unwrap().hash);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            process_transaction(
                &rpc_client,
                vec![
                    transfer(
                        &payer.pubkey(),
                        &signature_set_keypair.pubkey(),
                        rpc_client.get_minimum_balance_for_rent_exemption(signature_set_size)?,
                    ),
                    transfer(
                        &payer.pubkey(),
                        &posted_vaa_key,
                        rpc_client.get_minimum_balance_for_rent_exemption(posted_vaa_size)?,
                    ),
                ],
                &vec![&payer],
            )?;

            println!("Get wormhole guardian set configuration");
            let wormhole_config = WormholeConfig::key(&wormhole, ());
            let wormhole_config_data =
                WormholeConfig::try_from_slice(&rpc_client.get_account_data(&wormhole_config)?)?;

            let guardian_set = GuardianSet::key(&wormhole, wormhole_config_data.guardian_set_index);
            let guardian_set_data =
                GuardianSet::try_from_slice(&rpc_client.get_account_data(&guardian_set)?)?;

            println!("Invoke wormhole on solana to verify the VAA");
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

            println!("Upload the VAA data to a solana account");
            let post_vaa_data = PostVAAData {
                version:            vaa.version,
                guardian_set_index: vaa.guardian_set_index,
                timestamp:          vaa.timestamp,
                nonce:              vaa.nonce,
                emitter_chain:      vaa.emitter_chain.into(),
                emitter_address:    vaa.emitter_address,
                sequence:           vaa.sequence,
                consistency_level:  vaa.consistency_level,
                payload:            vaa.payload,
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
        }

        Action::InvokePriceReceiver { keypair } => {
            println!("TBD, keypair={}", keypair);
        }
    }

    Ok(())
}

pub fn process_transaction(
    rpc_client: &RpcClient,
    instructions: Vec<Instruction>,
    signers: &Vec<&Keypair>,
) -> Result<()> {
    let mut transaction =
        Transaction::new_with_payer(instructions.as_slice(), Some(&signers[0].pubkey()));
    transaction.sign(signers, rpc_client.get_latest_blockhash()?);
    let transaction_signature =
        rpc_client.send_and_confirm_transaction_with_spinner(&transaction)?;
    println!("Transaction successful : {transaction_signature:?}");
    Ok(())
}
