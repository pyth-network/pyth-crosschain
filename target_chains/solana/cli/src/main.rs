pub mod cli;

use {
    anchor_client::anchor_lang::{InstructionData, ToAccountMetas},
    anyhow::{anyhow, Context, Result},
    borsh::BorshDeserialize,
    clap::Parser,
    cli::{require_wormhole, Action, Cli},
    pyth_solana_receiver::sdk::{
        deserialize_accumulator_update_data, get_random_treasury_id, VAA_SPLIT_INDEX,
    },
    pyth_solana_receiver_sdk::config::DataSource,
    pythnet_sdk::wire::v1::MerklePriceUpdate,
    serde_wormhole::RawMessage,
    solana_client::{rpc_client::RpcClient, rpc_config::RpcSendTransactionConfig},
    solana_commitment_config::CommitmentConfig,
    solana_compute_budget_interface::ComputeBudgetInstruction,
    solana_sdk::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        rent::Rent,
        signature::{read_keypair_file, Keypair},
        signer::Signer,
        transaction::Transaction,
    },
    solana_system_interface::instruction as system_instruction,
    std::{str::FromStr, thread::sleep, time::Duration},
    wormhole_core_bridge_solana::sdk::{WriteEncodedVaaArgs, VAA_START},
    wormhole_sdk::{
        vaa::{Body, Header},
        Vaa,
    },
    wormhole_solana::{
        instructions::{
            initialize, post_vaa, upgrade_guardian_set, verify_signatures_txs, PostVAAData,
        },
        mainnet_guardian_sets::{
            MAINNET_GUARDIAN_SET_TTL_SECONDS, MAINNET_INITIAL_GUARDIAN,
            MAINNET_UPGRADE_GUARDIAN_SET_VAAS,
        },
        Account, Config as BridgeConfig, GuardianSet, VAA as LegacyPostedVaa,
    },
};

/// Configuration for one SVM chain that the `initialize-wormhole-receiver-all-svm`
/// subcommand should target.
///
/// `legacy_guardian_set` should be `true` for chains running the legacy Wormhole
/// bridge program (e.g. Pythnet), where guardian set accounts are stored without
/// the Anchor discriminator for every guardian set index, not just index 0.
#[derive(Copy, Clone)]
struct SvmChain {
    name: &'static str,
    rpc_url: Option<&'static str>,
    /// Wormhole core / receiver program ID on this chain, as a base58 string.
    /// Parsed at runtime since `Pubkey::from_str` is not const.
    wormhole: &'static str,
    legacy_guardian_set: bool,
}

const PYTH_SVM_WORMHOLE_RECEIVER: &str = "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ";
const PYTHNET_WORMHOLE_RECEIVER: &str = "H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU";

const SVM_CHAINS: &[SvmChain] = &[
    SvmChain {
        name: "solana_mainnet",
        rpc_url: Some("https://api.mainnet-beta.solana.com"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    SvmChain {
        name: "solana_devnet",
        rpc_url: Some("https://api.devnet.solana.com"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    SvmChain {
        name: "eclipse_testnet",
        rpc_url: Some("https://testnet.dev2.eclipsenetwork.xyz"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    SvmChain {
        name: "eclipse_mainnet",
        rpc_url: Some("https://mainnetbeta-rpc.eclipse.xyz"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    SvmChain {
        name: "sonic_devnet",
        rpc_url: Some("https://api.testnet.sonic.game"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    SvmChain {
        name: "sonic_testnet",
        rpc_url: Some("https://api.testnet.sonic.game"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    SvmChain {
        name: "sonic_mainnet",
        rpc_url: Some("https://api.mainnet-alpha.sonic.game"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    SvmChain {
        name: "fogo_mainnet",
        rpc_url: Some("https://mainnet.fogo.io"),
        wormhole: PYTH_SVM_WORMHOLE_RECEIVER,
        legacy_guardian_set: false,
    },
    // Fogo testnet uses testnet WH guardians; intentionally omitted here.
    SvmChain {
        name: "pythnet",
        rpc_url: Some("https://pythnet.rpcpool.com"),
        wormhole: PYTHNET_WORMHOLE_RECEIVER,
        legacy_guardian_set: true,
    },
];

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
            let wormhole = require_wormhole(wormhole)?;
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
            let wormhole = require_wormhole(wormhole)?;
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
        Action::PostTwapUpdate {
            start_payload,
            end_payload,
        } => {
            let wormhole = require_wormhole(wormhole)?;
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let start_payload_bytes: Vec<u8> = base64::decode(start_payload)?;
            let end_payload_bytes: Vec<u8> = base64::decode(end_payload)?;

            let (start_vaa, start_merkle_price_updates) =
                deserialize_accumulator_update_data(start_payload_bytes)?;
            let (end_vaa, end_merkle_price_updates) =
                deserialize_accumulator_update_data(end_payload_bytes)?;

            process_write_encoded_vaa_and_post_twap_update(
                &rpc_client,
                &start_vaa,
                &end_vaa,
                wormhole,
                &payer,
                &start_merkle_price_updates[0],
                &end_merkle_price_updates[0],
            )?;
        }
        Action::InitializeWormholeReceiver { legacy } => {
            let wormhole = require_wormhole(wormhole)?;
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            initialize_wormhole_receiver(&rpc_client, wormhole, &payer, legacy)?;
        }
        Action::InitializeWormholeReceiverAllSvm {
            retries,
            retry_delay_seconds,
        } => {
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let retries = retries.max(1);
            let retry_delay = Duration::from_secs(retry_delay_seconds);
            let mut failures: Vec<(String, String)> = vec![];

            for chain_cfg in SVM_CHAINS {
                let SvmChain {
                    name,
                    rpc_url,
                    wormhole,
                    legacy_guardian_set,
                } = *chain_cfg;

                let Some(rpc_url) = rpc_url else {
                    eprintln!("[{name}] skipping: unresolved RPC URL");
                    continue;
                };

                let chain_wormhole = match Pubkey::from_str(wormhole) {
                    Ok(pk) => pk,
                    Err(err) => {
                        eprintln!("[{name}] skipping: invalid wormhole pubkey {wormhole:?}: {err}");
                        failures
                            .push((name.to_string(), format!("invalid wormhole pubkey: {err}")));
                        continue;
                    }
                };

                println!(
                    "\n[{name}] rpc={rpc_url} wormhole={chain_wormhole} legacy={legacy_guardian_set}"
                );

                let mut last_error = String::new();
                let mut succeeded = false;
                for attempt in 1..=retries {
                    println!("[{name}] attempt {attempt}/{retries}");
                    let rpc_client = RpcClient::new(rpc_url.to_owned());
                    match initialize_wormhole_receiver(
                        &rpc_client,
                        chain_wormhole,
                        &payer,
                        legacy_guardian_set,
                    ) {
                        Ok(()) => {
                            println!("[{name}] success");
                            succeeded = true;
                            break;
                        }
                        Err(err) => {
                            last_error = format!("{err:#}");
                            eprintln!("[{name}] attempt {attempt} failed: {last_error}");
                            if attempt < retries {
                                eprintln!("[{name}] retrying in {retry_delay_seconds} seconds...");
                                sleep(retry_delay);
                            }
                        }
                    }
                }

                if !succeeded {
                    failures.push((name.to_string(), last_error));
                }
            }

            if !failures.is_empty() {
                eprintln!("\nInitialization failures:");
                for (chain, error) in &failures {
                    eprintln!(" - {chain}: {error}");
                }
                return Err(anyhow!(
                    "failed to initialize wormhole receiver on {} chain(s)",
                    failures.len()
                ));
            }
        }

        Action::UpdateGuardianSetTtl {} => {
            let wormhole = require_wormhole(wormhole)?;
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");
            let wormhole_config = BridgeConfig::key(&wormhole, ());

            let instruction = Instruction {
                program_id: wormhole,
                accounts: vec![AccountMeta::new(wormhole_config, false)],
                data: vec![9], // UpdateGuardianSetTtl
            };
            process_transaction(&rpc_client, vec![instruction], &vec![&payer])?;
        }

        Action::InitializePythReceiver {
            fee,
            emitter,
            chain,
            governance_authority,
        } => {
            let wormhole = require_wormhole(wormhole)?;
            let rpc_client = RpcClient::new(url);
            let payer =
                read_keypair_file(&*shellexpand::tilde(&keypair)).expect("Keypair not found");

            let initialize_pyth_receiver_instruction =
                pyth_solana_receiver::instruction::Initialize::populate(
                    &payer.pubkey(),
                    pyth_solana_receiver_sdk::config::Config {
                        governance_authority,
                        target_governance_authority: None,
                        wormhole,
                        valid_data_sources: vec![DataSource { chain, emitter }],
                        single_update_fee_in_lamports: fee,
                        minimum_signatures: 3,
                    },
                );

            process_transaction(
                &rpc_client,
                vec![initialize_pyth_receiver_instruction],
                &vec![&payer],
            )?;
        }
    }
    Ok(())
}

// The guardian-set upgrade chain increments `current_guardian_set_index` after every step so adding
// the next upgrade is a mechanical append; the final increment is intentionally never read.
#[allow(unused_assignments)]
fn initialize_wormhole_receiver(
    rpc_client: &RpcClient,
    wormhole: Pubkey,
    payer: &Keypair,
    legacy_guardian_set: bool,
) -> Result<()> {
    // Check whether the wormhole config account exists, if it does not exist, initialize the wormhole receiver
    let wormhole_config = BridgeConfig::key(&wormhole, ());

    let wormhole_account_data = rpc_client.get_account_data(&wormhole_config);

    let mut current_guardian_set_index = match wormhole_account_data {
        Ok(data) => {
            let config = BridgeConfig::try_from_slice(&data)?;
            println!("Wormhole already initialized. config: {config:?}");
            config.guardian_set_index
        }
        Err(_) => {
            println!("Initializing wormhole receiver");
            let initial_guardian = hex::decode(MAINNET_INITIAL_GUARDIAN)
                .context("failed to decode MAINNET_INITIAL_GUARDIAN hex")?;
            let initialize_instruction = initialize(
                wormhole,
                payer.pubkey(),
                0,
                MAINNET_GUARDIAN_SET_TTL_SECONDS,
                &[initial_guardian
                    .try_into()
                    .map_err(|_| anyhow!("invalid MAINNET_INITIAL_GUARDIAN size"))?],
            )
            .context("failed to create initialize instruction")?;
            process_transaction(rpc_client, vec![initialize_instruction], &vec![payer])?;
            0
        }
    };

    if current_guardian_set_index == 0 {
        println!("Upgrading guardian set from 0 to 1");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(MAINNET_UPGRADE_GUARDIAN_SET_VAAS[0])
                .context("failed to decode guardian set VAA 1")?,
            wormhole,
            payer,
            true,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 1 {
        println!("Upgrading guardian set from 1 to 2");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(MAINNET_UPGRADE_GUARDIAN_SET_VAAS[1])
                .context("failed to decode guardian set VAA 2")?,
            wormhole,
            payer,
            legacy_guardian_set,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 2 {
        println!("Upgrading guardian set from 2 to 3");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(MAINNET_UPGRADE_GUARDIAN_SET_VAAS[2])
                .context("failed to decode guardian set VAA 3")?,
            wormhole,
            payer,
            legacy_guardian_set,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 3 {
        println!("Upgrading guardian set from 3 to 4");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(MAINNET_UPGRADE_GUARDIAN_SET_VAAS[3])
                .context("failed to decode guardian set VAA 4")?,
            wormhole,
            payer,
            legacy_guardian_set,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 4 {
        println!("Upgrading guardian set from 4 to 5");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(MAINNET_UPGRADE_GUARDIAN_SET_VAAS[4])
                .context("failed to decode guardian set VAA 5")?,
            wormhole,
            payer,
            legacy_guardian_set,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 5 {
        println!("Upgrading guardian set from 5 to 6");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(MAINNET_UPGRADE_GUARDIAN_SET_VAAS[5])
                .context("failed to decode guardian set VAA 6")?,
            wormhole,
            payer,
            legacy_guardian_set,
        )?;
        current_guardian_set_index += 1;
    }

    if current_guardian_set_index == 6 {
        println!("Upgrading guardian set from 6 to 7");
        process_upgrade_guardian_set(
            rpc_client,
            &hex::decode(MAINNET_UPGRADE_GUARDIAN_SET_VAAS[6])
                .context("failed to decode guardian set VAA 7")?,
            wormhole,
            payer,
            legacy_guardian_set,
        )?;
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
    let posted_vaa = process_legacy_post_vaa(rpc_client, vaa, wormhole, payer, legacy_guardian_set)
        .context("failed to post guardian-set VAA")?;
    let parsed_vaa: Vaa<&RawMessage> =
        serde_wormhole::from_slice(vaa).context("failed to deserialize guardian-set VAA")?;
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
    .context("failed to build upgrade_guardian_set instruction")?;

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

    let post_update_instruction = pyth_solana_receiver::instruction::PostUpdateAtomic::populate(
        payer.pubkey(),
        payer.pubkey(),
        price_update_keypair.pubkey(),
        *wormhole,
        header.guardian_set_index,
        serde_wormhole::to_vec(&(header, body)).unwrap(),
        merkle_price_update.clone(),
        get_random_treasury_id(),
    );

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
    let parsed_vaa: Vaa<&RawMessage> =
        serde_wormhole::from_slice(vaa).context("failed to deserialize posted VAA")?;
    let (header, body): (Header, Body<&RawMessage>) = parsed_vaa.into();

    let wormhole_config = BridgeConfig::key(&wormhole, ());

    let wormhole_config_data =
        BridgeConfig::try_from_slice(&rpc_client.get_account_data(&wormhole_config)?)?;

    let guardian_set = GuardianSet::key(&wormhole, wormhole_config_data.guardian_set_index);

    let guardian_set_data = deserialize_guardian_set(
        &mut &rpc_client.get_account_data(&guardian_set)?[..],
        legacy_guardian_set,
    )?;

    let vaa_hash = body
        .digest()
        .context("failed to hash VAA body digest")?
        .hash;
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

    // Transaction 1: Create and initialize VAA
    let init_instructions = init_encoded_vaa_and_write_initial_data_ixs(
        &payer.pubkey(),
        vaa,
        &wormhole,
        &encoded_vaa_keypair,
    )?;
    process_transaction(
        rpc_client,
        init_instructions,
        &vec![payer, &encoded_vaa_keypair],
    )?;

    // Transaction 2: Write remaining VAA data, verify VAA, and post price update
    let price_update_keypair = Keypair::new();
    let mut update_instructions = vec![ComputeBudgetInstruction::set_compute_unit_limit(600_000)];

    update_instructions.extend(write_remaining_data_and_verify_vaa_ixs(
        &payer.pubkey(),
        vaa,
        &encoded_vaa_keypair.pubkey(),
        wormhole,
    )?);

    update_instructions.push(pyth_solana_receiver::instruction::PostUpdate::populate(
        payer.pubkey(),
        payer.pubkey(),
        encoded_vaa_keypair.pubkey(),
        price_update_keypair.pubkey(),
        merkle_price_update.clone(),
        get_random_treasury_id(),
    ));

    process_transaction(
        rpc_client,
        update_instructions,
        &vec![payer, &price_update_keypair],
    )?;
    println!(
        "Price update posted to account: {}",
        price_update_keypair.pubkey()
    );
    Ok(price_update_keypair.pubkey())
}

/// This function verifies start & end VAAs from Hermes via Wormhole to produce encoded VAAs,
/// and then posts a TWAP update using the encoded VAAs. Returns the TwapUpdate account pubkey.
///
/// The operation is split up into 4 transactions:
/// 1. Creates and initializes the start VAA account and writes its first part
/// 2. Creates and initializes the end VAA account and writes its first part
/// 3. Writes the remaining data for both VAAs and verifies them
/// 4. Posts the TWAP update
pub fn process_write_encoded_vaa_and_post_twap_update(
    rpc_client: &RpcClient,
    start_vaa: &[u8],
    end_vaa: &[u8],
    wormhole: Pubkey,
    payer: &Keypair,
    start_merkle_price_update: &MerklePriceUpdate,
    end_merkle_price_update: &MerklePriceUpdate,
) -> Result<Pubkey> {
    // Create keypairs for both encoded VAAs
    let start_encoded_vaa_keypair = Keypair::new();
    let end_encoded_vaa_keypair = Keypair::new();

    // Transaction 1: Create and initialize start VAA
    let start_init_instructions = init_encoded_vaa_and_write_initial_data_ixs(
        &payer.pubkey(),
        start_vaa,
        &wormhole,
        &start_encoded_vaa_keypair,
    )?;
    process_transaction(
        rpc_client,
        start_init_instructions,
        &vec![payer, &start_encoded_vaa_keypair],
    )?;

    // Transaction 2: Create and initialize end VAA
    let end_init_instructions = init_encoded_vaa_and_write_initial_data_ixs(
        &payer.pubkey(),
        end_vaa,
        &wormhole,
        &end_encoded_vaa_keypair,
    )?;
    process_transaction(
        rpc_client,
        end_init_instructions,
        &vec![payer, &end_encoded_vaa_keypair],
    )?;

    // Transaction 3: Write remaining VAA data and verify both VAAs
    let mut verify_instructions = vec![ComputeBudgetInstruction::set_compute_unit_limit(850_000)];
    verify_instructions.extend(write_remaining_data_and_verify_vaa_ixs(
        &payer.pubkey(),
        start_vaa,
        &start_encoded_vaa_keypair.pubkey(),
        wormhole,
    )?);
    verify_instructions.extend(write_remaining_data_and_verify_vaa_ixs(
        &payer.pubkey(),
        end_vaa,
        &end_encoded_vaa_keypair.pubkey(),
        wormhole,
    )?);
    process_transaction(rpc_client, verify_instructions, &vec![payer])?;

    // Transaction 4: Post TWAP update
    let twap_update_keypair = Keypair::new();
    let post_instructions = vec![
        ComputeBudgetInstruction::set_compute_unit_limit(400_000),
        pyth_solana_receiver::instruction::PostTwapUpdate::populate(
            payer.pubkey(),
            payer.pubkey(),
            start_encoded_vaa_keypair.pubkey(),
            end_encoded_vaa_keypair.pubkey(),
            twap_update_keypair.pubkey(),
            start_merkle_price_update.clone(),
            end_merkle_price_update.clone(),
            get_random_treasury_id(),
        ),
    ];
    process_transaction(
        rpc_client,
        post_instructions,
        &vec![payer, &twap_update_keypair],
    )?;
    println!(
        "TWAP update posted to account: {}",
        twap_update_keypair.pubkey()
    );

    Ok(twap_update_keypair.pubkey())
}

/// Creates instructions to initialize an encoded VAA account and write the first part of the VAA data
pub fn init_encoded_vaa_and_write_initial_data_ixs(
    payer: &Pubkey,
    vaa: &[u8],
    wormhole: &Pubkey,
    encoded_vaa_keypair: &Keypair,
) -> Result<Vec<Instruction>> {
    let encoded_vaa_size: usize = vaa.len() + VAA_START;

    let create_encoded_vaa = system_instruction::create_account(
        payer,
        &encoded_vaa_keypair.pubkey(),
        Rent::default().minimum_balance(encoded_vaa_size),
        encoded_vaa_size as u64,
        wormhole,
    );

    let init_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::InitEncodedVaa {
        write_authority: *payer,
        encoded_vaa: encoded_vaa_keypair.pubkey(),
    }
    .to_account_metas(None);

    let init_encoded_vaa_instruction = Instruction {
        program_id: *wormhole,
        accounts: init_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::InitEncodedVaa.data(),
    };

    let write_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
        write_authority: *payer,
        draft_vaa: encoded_vaa_keypair.pubkey(),
    }
    .to_account_metas(None);

    let write_encoded_vaa_instruction = Instruction {
        program_id: *wormhole,
        accounts: write_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: 0,
                data: vaa[..VAA_SPLIT_INDEX].to_vec(),
            },
        }
        .data(),
    };

    Ok(vec![
        create_encoded_vaa,
        init_encoded_vaa_instruction,
        write_encoded_vaa_instruction,
    ])
}

/// Creates instructions to write remaining VAA data and verify the VAA
pub fn write_remaining_data_and_verify_vaa_ixs(
    payer: &Pubkey,
    vaa: &[u8],
    encoded_vaa_keypair: &Pubkey,
    wormhole: Pubkey,
) -> Result<Vec<Instruction>> {
    let write_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::WriteEncodedVaa {
        write_authority: *payer,
        draft_vaa: *encoded_vaa_keypair,
    }
    .to_account_metas(None);

    let write_encoded_vaa_instruction = Instruction {
        program_id: wormhole,
        accounts: write_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::WriteEncodedVaa {
            args: WriteEncodedVaaArgs {
                index: VAA_SPLIT_INDEX.try_into().unwrap(),
                data: vaa[VAA_SPLIT_INDEX..].to_vec(),
            },
        }
        .data(),
    };

    let (header, _): (Header, Body<&RawMessage>) = serde_wormhole::from_slice(vaa).unwrap();
    let guardian_set = GuardianSet::key(&wormhole, header.guardian_set_index);

    let verify_encoded_vaa_accounts = wormhole_core_bridge_solana::accounts::VerifyEncodedVaaV1 {
        guardian_set,
        write_authority: *payer,
        draft_vaa: *encoded_vaa_keypair,
    }
    .to_account_metas(None);

    let verify_encoded_vaa_instruction = Instruction {
        program_id: wormhole,
        accounts: verify_encoded_vaa_accounts,
        data: wormhole_core_bridge_solana::instruction::VerifyEncodedVaaV1 {}.data(),
    };

    Ok(vec![
        write_encoded_vaa_instruction,
        verify_encoded_vaa_instruction,
    ])
}

pub fn process_transaction(
    rpc_client: &RpcClient,
    instructions: Vec<Instruction>,
    signers: &Vec<&Keypair>,
) -> Result<()> {
    let mut transaction = Transaction::new_with_payer(&instructions, Some(&signers[0].pubkey()));
    transaction.sign(signers, rpc_client.get_latest_blockhash()?);

    let transaction_signature_res = rpc_client
        .send_and_confirm_transaction_with_spinner_and_config(
            &transaction,
            CommitmentConfig::confirmed(),
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
