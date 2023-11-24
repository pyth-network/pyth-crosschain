pub mod cli;
use {
    anchor_client::anchor_lang::{
        prelude::*,
        solana_program::{
            system_program,
            sysvar::SysvarId,
        },
        AnchorDeserialize,
        InstructionData,
        ToAccountMetas,
    },
    anyhow::Result,
    clap::Parser,
    cli::{
        Action,
        Cli,
    },
    pyth_solana_receiver::{
        state::AnchorVaa,
        GuardianSet,
    },
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot,
        hashers::keccak256_160::Keccak160,
        wire::{
            to_vec,
            v1::{
                AccumulatorUpdateData,
                Proof,
                WormholeMessage,
                WormholePayload,
            },
            Serializer,
        },
    },
    serde::Serialize,
    serde_wormhole::RawMessage,
    solana_client::{
        rpc_client::RpcClient,
        rpc_config::RpcSendTransactionConfig,
    },
    solana_sdk::{
        commitment_config::CommitmentConfig,
        instruction::Instruction,
        signature::{
            read_keypair_file,
            Keypair,
        },
        signer::Signer,
        transaction::Transaction,
    },
    wormhole_anchor_sdk::wormhole::BridgeData,
    wormhole_sdk::{
        vaa::{
            Body,
            Header,
        },
        Vaa,
    },
    wormhole_solana::{
        instructions::verify_signatures_txs,
        Account,
        Config as WormholeConfig,
        GuardianSet as WormholeSolanaGuardianSet,
        VAA as WormholeSolanaVAA,
    },
};

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.action {
        Action::PostAndReceiveVAA {
            vaa: accumulator_update_data_str,
            keypair,
            url,
        } => {
            let wormhole = wormhole_anchor_sdk::wormhole::program::id();
            let rpc_client = RpcClient::new(url);

            println!("[1/5] Decode the AccumulatorUpdateData");
            let accumulator_update_data_bytes: Vec<u8> =
                base64::decode(accumulator_update_data_str)?;
            let accumulator_update_data =
                AccumulatorUpdateData::try_from_slice(accumulator_update_data_bytes.as_slice())?;

            match &accumulator_update_data.proof {
                Proof::WormholeMerkle { vaa, updates } => {
                    let parsed_vaa: Vaa<&RawMessage> =
                        serde_wormhole::from_slice(vaa.as_ref()).unwrap();
                    let (_, body): (Header, Body<&RawMessage>) = parsed_vaa.into();

                    println!("[2/5] Get wormhole guardian set configuration");
                    let wormhole_config = WormholeConfig::key(&wormhole, ());

                    let wormhole_config_data = BridgeData::try_from_slice(
                        &rpc_client.get_account_data(&wormhole_config)?,
                    )?;

                    let guardian_set = Pubkey::find_program_address(
                        &[
                            b"GuardianSet",
                            &wormhole_config_data.guardian_set_index.to_be_bytes(),
                        ],
                        &wormhole,
                    )
                    .0;
                    let guardian_set_data =
                        GuardianSet::try_from_slice(&rpc_client.get_account_data(&guardian_set)?)?;

                    let payer = read_keypair_file(&*shellexpand::tilde(&keypair))
                        .expect("Keypair not found");

                    let vaa_hash = body.digest().unwrap().hash;
                    let vaa_pubkey = WormholeSolanaVAA::key(&wormhole, vaa_hash);
                    let vaa_account = match rpc_client.get_account_data(&vaa_pubkey) {
                        Ok(account_data) => {
                            println!("[3/5] VAA already posted on solana. Skipping verifying signatures step");
                            println!("[4/5] VAA already posted on solana. Skipping posting the VAA data onto a solana account using pyth-solana-receiver::PostAccumulatorUpdateVaa");
                            Some(account_data)
                        }
                        Err(_) => {
                            println!("[3/5] Invoke wormhole on solana to verify the signatures on the VAA");
                            let signature_set_keypair = Keypair::new();
                            println!("signature_set_pubkey: {}", signature_set_keypair.pubkey());

                            let verify_txs = verify_signatures_txs(
                                vaa.as_ref(),
                                WormholeSolanaGuardianSet {
                                    index:           guardian_set_data.index,
                                    keys:            guardian_set_data.keys,
                                    creation_time:   guardian_set_data.creation_time,
                                    expiration_time: guardian_set_data.expiration_time,
                                },
                                wormhole,
                                payer.pubkey(),
                                wormhole_config_data.guardian_set_index,
                                signature_set_keypair.pubkey(),
                            )?;

                            for tx in verify_txs {
                                process_transaction(
                                    &rpc_client,
                                    tx,
                                    &vec![&payer, &signature_set_keypair],
                                )?;
                            }

                            println!("[4/5] Post the VAA data onto a solana account using pyth-solana-receiver::PostAccumulatorUpdateVaa");

                            let mut accumulator_update_data_vaa_only =
                                accumulator_update_data.clone();
                            accumulator_update_data_vaa_only.proof =
                                match accumulator_update_data_vaa_only.proof {
                                    Proof::WormholeMerkle { vaa, updates: _ } => {
                                        Proof::WormholeMerkle {
                                            vaa,
                                            updates: vec![],
                                        }
                                    }
                                };
                            let mut accumulator_update_data_only_vaa_bytes = Vec::new();
                            let mut cursor =
                                std::io::Cursor::new(&mut accumulator_update_data_only_vaa_bytes);
                            let mut serializer: Serializer<_, byteorder::BE> =
                                Serializer::new(&mut cursor);
                            accumulator_update_data_vaa_only
                                .serialize(&mut serializer)
                                .unwrap();

                            let post_acc_update_data_vaa_accounts =
                                pyth_solana_receiver::accounts::PostAccUpdateDataVaa {
                                    guardian_set,
                                    bridge_config: wormhole_config,
                                    signature_set: signature_set_keypair.pubkey(),
                                    vaa: vaa_pubkey,
                                    payer: payer.pubkey(),
                                    rent: Rent::id(),
                                    clock: Clock::id(),
                                    system_program: system_program::ID,
                                    post_vaa_program: wormhole,
                                }
                                .to_account_metas(None);
                            let post_acc_update_data_vaa_ix_data =
                                pyth_solana_receiver::instruction::PostAccumulatorUpdateVaa {
                                    emitter_chain: wormhole::Chain::Pythnet.into(),
                                    data:          accumulator_update_data_only_vaa_bytes,
                                }
                                .data();
                            let post_acc_update_data_vaa_ix = Instruction::new_with_bytes(
                                pyth_solana_receiver::ID,
                                &post_acc_update_data_vaa_ix_data,
                                post_acc_update_data_vaa_accounts,
                            );
                            println!("Sending txn with PostAccumulatorUpdateVaa ix");

                            process_transaction(
                                &rpc_client,
                                vec![post_acc_update_data_vaa_ix],
                                &vec![&payer],
                            )?;

                            rpc_client.get_account_data(&vaa_pubkey).ok()
                        }
                    };

                    println!("Verifying updates using PostedVAA account");

                    let posted_vaa_data =
                        AnchorVaa::try_deserialize(&mut vaa_account.unwrap().as_slice())?;
                    let wormhole_message =
                        WormholeMessage::try_from_bytes(&posted_vaa_data.payload)?;
                    println!("wormhole_message: {wormhole_message:?}");
                    let root: MerkleRoot<Keccak160> =
                        MerkleRoot::new(match wormhole_message.payload {
                            WormholePayload::Merkle(merkle_root) => merkle_root.root,
                        });

                    let mut verify_count = 0;
                    for update in updates {
                        let message_vec = Vec::from(update.message.clone());
                        if !root.check(update.proof.clone(), &message_vec) {
                            println!("[ERR] failed to verify update");
                        } else {
                            verify_count += 1;
                        }
                    }
                    println!("verified {verify_count}/{} updates", updates.len());

                    println!("[5/5] Post updates from AccumulatorUpdateData and use the PostedVAA on solana using pyth-solana-receiver::PostUpdates");
                    // TODO need to figure out max number of updates that can be sent in 1 txn

                    // update_bytes_len: 288 (1 price feed)
                    let update_bytes = updates
                        .iter()
                        .map(|u| to_vec::<_, byteorder::BE>(u).unwrap())
                        .collect::<Vec<_>>();

                    let update_bytes_len: usize = update_bytes
                        .iter()
                        .map(|u| u.len())
                        .collect::<Vec<usize>>()
                        .iter()
                        .sum();

                    println!("update_bytes_len: {}", update_bytes_len);

                    let post_updates_accounts = pyth_solana_receiver::accounts::PostUpdates {
                        payer:            payer.pubkey(),
                        posted_vaa:       vaa_pubkey,
                        post_vaa_program: wormhole,
                    }
                    .to_account_metas(None);
                    let post_updates_ix_data = pyth_solana_receiver::instruction::PostUpdates {
                        vaa_hash,
                        emitter_chain: wormhole::Chain::Pythnet.into(),
                        price_updates: update_bytes,
                    }
                    .data();
                    let post_updates_ix = Instruction::new_with_bytes(
                        pyth_solana_receiver::ID,
                        &post_updates_ix_data,
                        post_updates_accounts,
                    );
                    println!("Sending txn with PostUpdates ix");
                    process_transaction(&rpc_client, vec![post_updates_ix], &vec![&payer])?;
                }
            }
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

    let transaction_signature_res = rpc_client
        .send_and_confirm_transaction_with_spinner_and_config(
            &transaction,
            CommitmentConfig::finalized(),
            RpcSendTransactionConfig {
                skip_preflight: true,
                ..Default::default()
            },
        );
    match transaction_signature_res {
        Ok(signature) => {
            println!("Transaction successful : {signature:?}");
            Ok(())
        }
        Err(err) => {
            println!("transaction err: {err:?}");
            Err(err.into())
        }
    }
}
