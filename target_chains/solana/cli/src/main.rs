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
        instruction::Instruction,
        pubkey::Pubkey,
        signature::{
            read_keypair_file,
            Keypair,
        },
        signer::Signer,
        transaction::Transaction,
    },

    wormhole::VAA,
    wormhole_solana::{
        Account,
        GuardianSet,
        Config as WormholeConfig,
        instructions::{
            post_vaa,
            verify_signatures_txs,
            PostVAAData,
        },
        VAA as WormholeSolanaVAA,
    },

    pyth_solana_receiver::{
        ID,
        accounts::DecodePostedVaa,
    },

    anchor_client::anchor_lang::{
        ToAccountMetas,
        InstructionData,
        AnchorDeserialize,
    },

    solana_client::rpc_client::RpcClient,
};

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.action {
        Action::PostAndReceiveVAA { vaa, keypair } => {
            println!("PostPriceVAA is invoked with vaa\"{}\"", vaa);
            let rpc_client = RpcClient::new("https://api.devnet.solana.com");
            let wormhole = Pubkey::from_str("3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5").unwrap();

            println!("Decode the VAA");
            let vaa_bytes: Vec<u8> = base64::decode(vaa)?;
            let vaa = VAA::from_bytes(vaa_bytes.clone())?;
            let posted_vaa_key = WormholeSolanaVAA::key(&wormhole, vaa.digest().unwrap().hash);

            println!("Get wormhole guardian set configuration");
            let wormhole_config = WormholeConfig::key(&wormhole, ());
            let wormhole_config_data =
                WormholeConfig::try_from_slice(&rpc_client.get_account_data(&wormhole_config)?)?;

            let guardian_set = GuardianSet::key(&wormhole, wormhole_config_data.guardian_set_index);
            let guardian_set_data =
                GuardianSet::try_from_slice(&rpc_client.get_account_data(&guardian_set)?)?;

            println!("Invoke wormhole on solana to verify the VAA");
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let signature_set_keypair = Keypair::new();
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

            println!("Receive and deserialize the VAA on solana");
            let account_metas = DecodePostedVaa::populate(&payer.pubkey(), &posted_vaa_key)
                .to_account_metas(None);

            let invoke_receiver_instruction = Instruction {
                program_id: ID,
                accounts:   account_metas,
                data:       pyth_solana_receiver::instruction::DecodePostedVaa.data(),
            };

            process_transaction(
                &rpc_client,
                vec![invoke_receiver_instruction],
                &vec![&payer],
            )?;
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
