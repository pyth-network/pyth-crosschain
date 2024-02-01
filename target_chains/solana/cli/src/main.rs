#![deny(warnings)]

pub mod cli;


use {
    anchor_client::anchor_lang::{
        InstructionData,
        ToAccountMetas,
    },
    anyhow::Result,
    borsh::BorshDeserialize,
    clap::Parser,
    cli::{
        Action,
        Cli,
    },
    pyth_solana_receiver::{
        sdk::{
            deserialize_accumulator_update_data,
            DEFAULT_TREASURY_ID,
        },
        state::config::DataSource,
        PostUpdateAtomicParams,
        PostUpdateParams,
    },
    pythnet_sdk::wire::v1::MerklePriceUpdate,
    serde_wormhole::RawMessage,
    solana_client::{
        rpc_client::RpcClient,
        rpc_config::RpcSendTransactionConfig,
    },
    solana_sdk::{
        commitment_config::CommitmentConfig,
        compute_budget::ComputeBudgetInstruction,
        instruction::Instruction,
        pubkey::Pubkey,
        rent::Rent,
        signature::{
            read_keypair_file,
            Keypair,
        },
        signer::Signer,
        system_instruction,
        transaction::Transaction,
    },
    wormhole_core_bridge_solana::sdk::{
        WriteEncodedVaaArgs,
        VAA_START,
    },
    wormhole_sdk::{
        vaa::{
            Body,
            Header,
        },
        Vaa,
    },
    wormhole_solana::{
        instructions::{
            initialize,
            post_vaa,
            upgrade_guardian_set,
            verify_signatures_txs,
            PostVAAData,
        },
        Account,
        Config as BridgeConfig,
        GuardianSet,
        VAA as LegacyPostedVaa,
    },
};

const INITIAL_GUARDIAN: &str = "58cc3ae5c097b213ce3c81979e1b9f9570746aa5"; // Mainnet intial guardian set so we can use stable price feeds
const UPGRADE_GUARDIAN_SET_VAA_1 : &str = "010000000001007ac31b282c2aeeeb37f3385ee0de5f8e421d30b9e5ae8ba3d4375c1c77a86e77159bb697d9c456d6f8c02d22a94b1279b65b0d6a9957e7d3857423845ac758e300610ac1d2000000030001000000000000000000000000000000000000000000000000000000000000000400000000000005390000000000000000000000000000000000000000000000000000000000436f7265020000000000011358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cdeb5f7389fa26941519f0863349c223b73a6ddee774a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_2 : &str = "01000000010d0012e6b39c6da90c5dfd3c228edbb78c7a4c97c488ff8a346d161a91db067e51d638c17216f368aa9bdf4836b8645a98018ca67d2fec87d769cabfdf2406bf790a0002ef42b288091a670ef3556596f4f47323717882881eaf38e03345078d07a156f312b785b64dae6e9a87e3d32872f59cb1931f728cecf511762981baf48303668f0103cef2616b84c4e511ff03329e0853f1bd7ee9ac5ba71d70a4d76108bddf94f69c2a8a84e4ee94065e8003c334e899184943634e12043d0dda78d93996da073d190104e76d166b9dac98f602107cc4b44ac82868faf00b63df7d24f177aa391e050902413b71046434e67c770b19aecdf7fce1d1435ea0be7262e3e4c18f50ddc8175c0105d9450e8216d741e0206a50f93b750a47e0a258b80eb8fed1314cc300b3d905092de25cd36d366097b7103ae2d184121329ba3aa2d7c6cc53273f11af14798110010687477c8deec89d36a23e7948feb074df95362fc8dcbd8ae910ac556a1dee1e755c56b9db5d710c940938ed79bc1895a3646523a58bc55f475a23435a373ecfdd0107fb06734864f79def4e192497362513171530daea81f07fbb9f698afe7e66c6d44db21323144f2657d4a5386a954bb94eef9f64148c33aef6e477eafa2c5c984c01088769e82216310d1827d9bd48645ec23e90de4ef8a8de99e2d351d1df318608566248d80cdc83bdcac382b3c30c670352be87f9069aab5037d0b747208eae9c650109e9796497ff9106d0d1c62e184d83716282870cef61a1ee13d6fc485b521adcce255c96f7d1bca8d8e7e7d454b65783a830bddc9d94092091a268d311ecd84c26010c468c9fb6d41026841ff9f8d7368fa309d4dbea3ea4bbd2feccf94a92cc8a20a226338a8e2126cd16f70eaf15b4fc9be2c3fa19def14e071956a605e9d1ac4162010e23fcb6bd445b7c25afb722250c1acbc061ed964ba9de1326609ae012acdfb96942b2a102a2de99ab96327859a34a2b49a767dbdb62e0a1fb26af60fe44fd496a00106bb0bac77ac68b347645f2fb1ad789ea9bd76fb9b2324f25ae06f97e65246f142df717f662e73948317182c62ce87d79c73def0dba12e5242dfc038382812cfe00126da03c5e56cb15aeeceadc1e17a45753ab4dc0ec7bf6a75ca03143ed4a294f6f61bc3f478a457833e43084ecd7c985bf2f55a55f168aac0e030fc49e845e497101626e9d9a5d9e343f00010000000000000000000000000000000000000000000000000000000000000004c1759167c43f501c2000000000000000000000000000000000000000000000000000000000436f7265020000000000021358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd66b9590e1c41e0b226937bf9217d1d67fd4e91f574a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";
const UPGRADE_GUARDIAN_SET_VAA_3 : &str = "01000000020d00ce45474d9e1b1e7790a2d210871e195db53a70ffd6f237cfe70e2686a32859ac43c84a332267a8ef66f59719cf91cc8df0101fd7c36aa1878d5139241660edc0010375cc906156ae530786661c0cd9aef444747bc3d8d5aa84cac6a6d2933d4e1a031cffa30383d4af8131e929d9f203f460b07309a647d6cd32ab1cc7724089392c000452305156cfc90343128f97e499311b5cae174f488ff22fbc09591991a0a73d8e6af3afb8a5968441d3ab8437836407481739e9850ad5c95e6acfcc871e951bc30105a7956eefc23e7c945a1966d5ddbe9e4be376c2f54e45e3d5da88c2f8692510c7429b1ea860ae94d929bd97e84923a18187e777aa3db419813a80deb84cc8d22b00061b2a4f3d2666608e0aa96737689e3ba5793810ff3a52ff28ad57d8efb20967735dc5537a2e43ef10f583d144c12a1606542c207f5b79af08c38656d3ac40713301086b62c8e130af3411b3c0d91b5b50dcb01ed5f293963f901fc36e7b0e50114dce203373b32eb45971cef8288e5d928d0ed51cd86e2a3006b0af6a65c396c009080009e93ab4d2c8228901a5f4525934000b2c26d1dc679a05e47fdf0ff3231d98fbc207103159ff4116df2832eea69b38275283434e6cd4a4af04d25fa7a82990b707010aa643f4cf615dfff06ffd65830f7f6cf6512dabc3690d5d9e210fdc712842dc2708b8b2c22e224c99280cd25e5e8bfb40e3d1c55b8c41774e287c1e2c352aecfc010b89c1e85faa20a30601964ccc6a79c0ae53cfd26fb10863db37783428cd91390a163346558239db3cd9d420cfe423a0df84c84399790e2e308011b4b63e6b8015010ca31dcb564ac81a053a268d8090e72097f94f366711d0c5d13815af1ec7d47e662e2d1bde22678113d15963da100b668ba26c0c325970d07114b83c5698f46097010dc9fda39c0d592d9ed92cd22b5425cc6b37430e236f02d0d1f8a2ef45a00bde26223c0a6eb363c8b25fd3bf57234a1d9364976cefb8360e755a267cbbb674b39501108db01e444ab1003dd8b6c96f8eb77958b40ba7a85fefecf32ad00b7a47c0ae7524216262495977e09c0989dd50f280c21453d3756843608eacd17f4fdfe47600001261025228ef5af837cb060bcd986fcfa84ccef75b3fa100468cfd24e7fadf99163938f3b841a33496c2706d0208faab088bd155b2e20fd74c625bb1cc8c43677a0163c53c409e0c5dfa000100000000000000000000000000000000000000000000000000000000000000046c5a054d7833d1e42000000000000000000000000000000000000000000000000000000000436f7265020000000000031358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";

/**
 * The VAA is split at this index when writing the encoded VAA, this allow us to
 * optimize the number of transactions by putting the maximum possible amount of data in the first transaction.
 * This constant is chosen to pack the first transaction maximally.
 */
const VAA_SPLIT_INDEX: usize = 846;

fn main() -> Result<()> {
    let cli = Cli::parse();
    let Cli {
        action,
        keypair,
        url,
        wormhole,
    } = cli;

    match action {
        Action::PostPriceUpdate { payload } => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let payload_bytes: Vec<u8> = base64::decode(payload)?;
            let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(payload_bytes)?;

            process_write_encoded_vaa_and_post_price_update(
                &rpc_client,
                &vaa,
                wormhole,
                &payer,
                &merkle_price_updates[0],
            )?;
        }
        Action::PostPriceUpdateAtomic {
            payload,
            n_signatures,
        } => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let payload_bytes: Vec<u8> = base64::decode(payload)?;
            let (vaa, merkle_price_updates) = deserialize_accumulator_update_data(payload_bytes)?;

            process_post_price_update_atomic(
                &rpc_client,
                &vaa,
                n_signatures,
                &wormhole,
                &payer,
                &merkle_price_updates[0],
            )?;
        }

        Action::InitializeWormholeReceiver {} => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let initialize_instruction = initialize(
                wormhole,
                payer.pubkey(),
                0,
                0,
                &[hex::decode(INITIAL_GUARDIAN).unwrap().try_into().unwrap()],
            )
            .unwrap();
            process_transaction(&rpc_client, vec![initialize_instruction], &vec![&payer])?;

            process_upgrade_guardian_set(
                &rpc_client,
                &hex::decode(UPGRADE_GUARDIAN_SET_VAA_1).unwrap(),
                wormhole,
                &payer,
                true,
            )?;
            process_upgrade_guardian_set(
                &rpc_client,
                &hex::decode(UPGRADE_GUARDIAN_SET_VAA_2).unwrap(),
                wormhole,
                &payer,
                false,
            )?;
            process_upgrade_guardian_set(
                &rpc_client,
                &hex::decode(UPGRADE_GUARDIAN_SET_VAA_3).unwrap(),
                wormhole,
                &payer,
                false,
            )?;
        }

        Action::InitializePythReceiver {
            fee,
            emitter,
            chain,
        } => {
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let initialize_pyth_receiver_accounts =
                pyth_solana_receiver::accounts::Initialize::populate(&payer.pubkey())
                    .to_account_metas(None);
            let initialize_pyth_receiver_instruction = Instruction {
                program_id: pyth_solana_receiver::ID,
                accounts:   initialize_pyth_receiver_accounts,
                data:       pyth_solana_receiver::instruction::Initialize {
                    initial_config: pyth_solana_receiver::state::config::Config {
                        governance_authority: payer.pubkey(),
                        target_governance_authority: None,
                        wormhole,
                        valid_data_sources: vec![DataSource { chain, emitter }],
                        single_update_fee_in_lamports: fee,
                        minimum_signatures: 5,
                    },
                }
                .data(),
            };

            process_transaction(
                &rpc_client,
                vec![initialize_pyth_receiver_instruction],
                &vec![&payer],
            )?;
        }
    }
    Ok(())
}

pub fn process_upgrade_guardian_set(
    rpc_client: &RpcClient,
    vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    legacy_guardian_set: bool,
) -> Result<()> {
    let posted_vaa =
        process_legacy_post_vaa(rpc_client, vaa, wormhole, payer, legacy_guardian_set).unwrap();
    let parsed_vaa: Vaa<&RawMessage> = serde_wormhole::from_slice(vaa).unwrap();
    let (header, body): (Header, Body<&RawMessage>) = parsed_vaa.into();
    let guardian_set_index_old = header.guardian_set_index;
    let emitter = Pubkey::from(body.emitter_address.0);
    let sequence = body.sequence;

    let update_guardian_set_instruction = upgrade_guardian_set(
        wormhole,
        payer.pubkey(),
        posted_vaa,
        guardian_set_index_old,
        emitter,
        sequence,
    )
    .unwrap();

    process_transaction(
        rpc_client,
        vec![update_guardian_set_instruction],
        &vec![payer],
    )?;
    Ok(())
}

pub fn process_post_price_update_atomic(
    rpc_client: &RpcClient,
    vaa: &[u8],
    n_signatures: usize,
    wormhole: &Pubkey,
    payer: &Keypair,
    merkle_price_update: &MerklePriceUpdate,
) -> Result<Pubkey> {
    let price_update_keypair = Keypair::new();

    let (mut header, body): (Header, Body<&RawMessage>) = serde_wormhole::from_slice(vaa).unwrap();
    trim_signatures(&mut header, n_signatures);

    let request_compute_units_instruction: Instruction =
        ComputeBudgetInstruction::set_compute_unit_limit(400_000);


    let post_update_accounts = pyth_solana_receiver::accounts::PostUpdateAtomic::populate(
        payer.pubkey(),
        price_update_keypair.pubkey(),
        *wormhole,
        header.guardian_set_index,
        DEFAULT_TREASURY_ID,
    )
    .to_account_metas(None);

    let post_update_instruction = Instruction {
        program_id: pyth_solana_receiver::id(),
        accounts:   post_update_accounts,
        data:       pyth_solana_receiver::instruction::PostUpdateAtomic {
            params: PostUpdateAtomicParams {
                merkle_price_update: merkle_price_update.clone(),
                vaa:                 serde_wormhole::to_vec(&(header, body)).unwrap(),
                treasury_id:         DEFAULT_TREASURY_ID,
            },
        }
        .data(),
    };

    process_transaction(
        rpc_client,
        vec![request_compute_units_instruction, post_update_instruction],
        &vec![payer, &price_update_keypair],
    )?;
    Ok(price_update_keypair.pubkey())
}

fn trim_signatures(header: &mut Header, n_signatures: usize) {
    header.signatures = header.signatures[..(n_signatures)].to_vec();
}

fn deserialize_guardian_set(buf: &mut &[u8], legacy_guardian_set: bool) -> Result<GuardianSet> {
    if !legacy_guardian_set {
        // Skip anchor discriminator
        *buf = &buf[8..];
    }
    let guardian_set = GuardianSet::deserialize(buf)?;
    Ok(guardian_set)
}

/**
 * This function posts a VAA to Solana using the legacy way, this way is still used for governance messages like guardian set updates
 */
pub fn process_legacy_post_vaa(
    rpc_client: &RpcClient,
    vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    legacy_guardian_set: bool,
) -> Result<Pubkey> {
    let parsed_vaa: Vaa<&RawMessage> = serde_wormhole::from_slice(vaa).unwrap();
    let (header, body): (Header, Body<&RawMessage>) = parsed_vaa.into();

    let wormhole_config = BridgeConfig::key(&wormhole, ());

    let wormhole_config_data =
        BridgeConfig::try_from_slice(&rpc_client.get_account_data(&wormhole_config)?)?;

    let guardian_set = GuardianSet::key(&wormhole, wormhole_config_data.guardian_set_index);

    let guardian_set_data = deserialize_guardian_set(
        &mut &rpc_client.get_account_data(&guardian_set)?[..],
        legacy_guardian_set,
    )?;

    let vaa_hash = body.digest().unwrap().hash;
    let vaa_pubkey = LegacyPostedVaa::key(&wormhole, vaa_hash);

    let signature_set_keypair = Keypair::new();

    let verify_txs = verify_signatures_txs(
        vaa,
        guardian_set_data,
        wormhole,
        payer.pubkey(),
        wormhole_config_data.guardian_set_index,
        signature_set_keypair.pubkey(),
    )?;

    for tx in verify_txs {
        process_transaction(rpc_client, tx, &vec![payer, &signature_set_keypair])?;
    }
    let post_vaa_data = PostVAAData {
        version:            header.version,
        guardian_set_index: header.guardian_set_index,
        timestamp:          body.timestamp,
        nonce:              body.nonce,
        emitter_chain:      body.emitter_chain.into(),
        emitter_address:    body.emitter_address.0,
        sequence:           body.sequence,
        consistency_level:  body.consistency_level,
        payload:            body.payload.to_vec(),
    };

    process_transaction(
        rpc_client,
        vec![post_vaa(
            wormhole,
            payer.pubkey(),
            signature_set_keypair.pubkey(),
            post_vaa_data,
        )?],
        &vec![payer],
    )?;

    rpc_client.get_account_data(&vaa_pubkey).ok();

    Ok(vaa_pubkey)
}

/**
 * This function posts a VAA using the new way of interacting with wormhole and then posts a price update using the VAA
 */
pub fn process_write_encoded_vaa_and_post_price_update(
    rpc_client: &RpcClient,
    vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    merkle_price_update: &MerklePriceUpdate,
) -> Result<Pubkey> {
    let encoded_vaa_keypair = Keypair::new();
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    let create_encoded_vaa = system_instruction::create_account(
        &payer.pubkey(),
        &encoded_vaa_keypair.pubkey(),
        Rent::default().minimum_balance(encoded_vaa_size),
        encoded_vaa_size as u64,
        &wormhole,
    );
    let init_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::InitEncodedVaa {
        write_authority: payer.pubkey(),
        encoded_vaa:     encoded_vaa_keypair.pubkey(),
    }
    .to_account_metas(None);

    let init_encoded_vaa_instruction = Instruction {
        program_id: wormhole,
        accounts:   init_encoded_vaa_accounts,
        data:       wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
    };

    let write_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
        write_authority: payer.pubkey(),
        draft_vaa:       encoded_vaa_keypair.pubkey(),
    }
    .to_account_metas(None);

    let write_encoded_vaa_accounts_instruction = Instruction {
        program_id: wormhole,
        accounts:   write_encoded_vaa_accounts.clone(),
        data:       wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: 0,
                data:  vaa[..VAA_SPLIT_INDEX].to_vec(),
            },
        }
        .data(),
    };


    // 1st transaction
    process_transaction(
        rpc_client,
        vec![
            create_encoded_vaa,
            init_encoded_vaa_instruction,
            write_encoded_vaa_accounts_instruction,
        ],
        &vec![payer, &encoded_vaa_keypair],
    )?;

    let write_encoded_vaa_accounts_instruction_2 = Instruction {
        program_id: wormhole,
        accounts:   write_encoded_vaa_accounts,
        data:       wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: VAA_SPLIT_INDEX.try_into().unwrap(),
                data:  vaa[VAA_SPLIT_INDEX..].to_vec(),
            },
        }
        .data(),
    };

    let (header, _): (Header, Body<&RawMessage>) = serde_wormhole::from_slice(vaa).unwrap();
    let guardian_set = GuardianSet::key(&wormhole, header.guardian_set_index);

    let request_compute_units_instruction: Instruction =
        ComputeBudgetInstruction::set_compute_unit_limit(600_000);

    let verify_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::VerifyEncodedVaaV1 {
        guardian_set,
        write_authority: payer.pubkey(),
        draft_vaa: encoded_vaa_keypair.pubkey(),
    }
    .to_account_metas(None);

    let verify_encoded_vaa_instruction = Instruction {
        program_id: wormhole,
        accounts:   verify_encoded_vaa_accounts,
        data:       wormhole_core_bridge_solana::instruction::VerifyEncodedVaaV1 {}.data(),
    };

    let price_update_keypair = Keypair::new();

    let post_update_accounts = pyth_solana_receiver::accounts::PostUpdate::populate(
        payer.pubkey(),
        encoded_vaa_keypair.pubkey(),
        price_update_keypair.pubkey(),
    )
    .to_account_metas(None);
    let post_update_instructions = Instruction {
        program_id: pyth_solana_receiver::id(),
        accounts:   post_update_accounts,
        data:       pyth_solana_receiver::instruction::PostUpdate {
            params: PostUpdateParams {
                merkle_price_update: merkle_price_update.clone(),
                treasury_id:         DEFAULT_TREASURY_ID,
            },
        }
        .data(),
    };

    // 2nd transaction
    process_transaction(
        rpc_client,
        vec![
            request_compute_units_instruction,
            write_encoded_vaa_accounts_instruction_2,
            verify_encoded_vaa_instruction,
            post_update_instructions,
        ],
        &vec![payer, &price_update_keypair],
    )?;


    Ok(price_update_keypair.pubkey())
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
