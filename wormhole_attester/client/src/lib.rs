pub mod attestation_cfg;
pub mod batch_state;
pub mod healthcheck;
pub mod message;
pub mod util;

pub use {
    attestation_cfg::{
        AttestationConditions,
        AttestationConfig,
        P2WSymbol,
    },
    batch_state::BatchState,
    healthcheck::{
        HealthCheckState,
        HEALTHCHECK_STATE,
    },
    message::P2WMessageQueue,
    pyth_wormhole_attester::Pyth2WormholeConfig,
    util::{
        start_metrics_server,
        RLMutex,
        RLMutexGuard,
    },
};
use {
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    bridge::{
        accounts::{
            Bridge,
            FeeCollector,
            Sequence,
            SequenceDerivationData,
        },
        types::ConsistencyLevel,
    },
    log::{
        debug,
        trace,
        warn,
    },
    pyth_sdk_solana::state::{
        load_mapping_account,
        load_price_account,
        load_product_account,
    },
    pyth_wormhole_attester::{
        attestation_state::AttestationStatePDA,
        config::{
            OldP2WConfigAccount,
            P2WConfigAccount,
        },
        message::{
            P2WMessage,
            P2WMessageDrvData,
        },
        AttestData,
    },
    pyth_wormhole_attester_sdk::P2WEmitter,
    solana_client::nonblocking::rpc_client::RpcClient,
    solana_program::{
        hash::Hash,
        instruction::{
            AccountMeta,
            Instruction,
        },
        pubkey::Pubkey,
        system_program,
        sysvar::{
            clock,
            rent,
        },
    },
    solana_sdk::{
        signer::{
            keypair::Keypair,
            Signer,
        },
        transaction::Transaction,
    },
    solitaire::{
        processors::seeded::Seeded,
        AccountState,
        ErrBox,
    },
};

/// Future-friendly version of solitaire::ErrBox
pub type ErrBoxSend = Box<dyn std::error::Error + Send + Sync>;

pub fn gen_init_tx(
    payer: Keypair,
    p2w_addr: Pubkey,
    config: Pyth2WormholeConfig,
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBox> {
    let payer_pubkey = payer.pubkey();
    let acc_metas = vec![
        // new_config
        AccountMeta::new(
            P2WConfigAccount::<{ AccountState::Uninitialized }>::key(None, &p2w_addr),
            false,
        ),
        // payer
        AccountMeta::new(payer.pubkey(), true),
        // system_program
        AccountMeta::new(system_program::id(), false),
    ];

    let ix_data = (
        pyth_wormhole_attester::instruction::Instruction::Initialize,
        config,
    );

    let ix = Instruction::new_with_bytes(p2w_addr, ix_data.try_to_vec()?.as_slice(), acc_metas);

    let signers = vec![&payer];

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer_pubkey),
        &signers,
        latest_blockhash,
    );
    Ok(tx_signed)
}

pub fn get_set_config_ix(
    p2w_addr: &Pubkey,
    owner_pubkey: &Pubkey,
    payer_pubkey: &Pubkey,
    new_config: Pyth2WormholeConfig,
) -> Result<Instruction, ErrBox> {
    let acc_metas = vec![
        // config
        AccountMeta::new(
            P2WConfigAccount::<{ AccountState::Initialized }>::key(None, p2w_addr),
            false,
        ),
        // current_owner
        AccountMeta::new(*owner_pubkey, true),
        // payer
        AccountMeta::new(*payer_pubkey, true),
        // system_program
        AccountMeta::new(system_program::id(), false),
    ];
    let ix_data = (
        pyth_wormhole_attester::instruction::Instruction::SetConfig,
        new_config,
    );
    Ok(Instruction::new_with_bytes(
        *p2w_addr,
        ix_data.try_to_vec()?.as_slice(),
        acc_metas,
    ))
}

pub fn gen_set_config_tx(
    payer: Keypair,
    p2w_addr: Pubkey,
    owner: Keypair,
    new_config: Pyth2WormholeConfig,
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBox> {
    let ix = get_set_config_ix(&p2w_addr, &owner.pubkey(), &payer.pubkey(), new_config)?;

    let signers = vec![&owner, &payer];
    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer.pubkey()),
        &signers,
        latest_blockhash,
    );
    Ok(tx_signed)
}

pub fn get_set_is_active_ix(
    p2w_addr: &Pubkey,
    ops_owner_pubkey: &Pubkey,
    payer_pubkey: &Pubkey,
    new_is_active: bool,
) -> Result<Instruction, ErrBox> {
    let acc_metas = vec![
        // config
        AccountMeta::new(
            P2WConfigAccount::<{ AccountState::Initialized }>::key(None, p2w_addr),
            false,
        ),
        // ops_owner
        AccountMeta::new(*ops_owner_pubkey, true),
        // payer
        AccountMeta::new(*payer_pubkey, true),
    ];

    let ix_data = (
        pyth_wormhole_attester::instruction::Instruction::SetIsActive,
        new_is_active,
    );
    Ok(Instruction::new_with_bytes(
        *p2w_addr,
        ix_data.try_to_vec()?.as_slice(),
        acc_metas,
    ))
}

pub fn gen_set_is_active_tx(
    payer: Keypair,
    p2w_addr: Pubkey,
    ops_owner: Keypair,
    new_is_active: bool,
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBox> {
    let ix = get_set_is_active_ix(
        &p2w_addr,
        &ops_owner.pubkey(),
        &payer.pubkey(),
        new_is_active,
    )?;

    let signers = vec![&ops_owner, &payer];
    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer.pubkey()),
        &signers,
        latest_blockhash,
    );
    Ok(tx_signed)
}

pub fn gen_migrate_tx(
    payer: Keypair,
    p2w_addr: Pubkey,
    owner: Keypair,
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBox> {
    let payer_pubkey = payer.pubkey();

    let acc_metas = vec![
        // new_config
        AccountMeta::new(
            P2WConfigAccount::<{ AccountState::Uninitialized }>::key(None, &p2w_addr),
            false,
        ),
        // old_config
        AccountMeta::new(OldP2WConfigAccount::key(None, &p2w_addr), false),
        // owner
        AccountMeta::new(owner.pubkey(), true),
        // payer
        AccountMeta::new(payer.pubkey(), true),
        // system_program
        AccountMeta::new(system_program::id(), false),
    ];

    let ix_data = (
        pyth_wormhole_attester::instruction::Instruction::Migrate,
        (),
    );

    let ix = Instruction::new_with_bytes(p2w_addr, ix_data.try_to_vec()?.as_slice(), acc_metas);

    let signers = vec![&owner, &payer];

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer_pubkey),
        &signers,
        latest_blockhash,
    );
    Ok(tx_signed)
}

/// Get the current config account data for given p2w program address
pub async fn get_config_account(
    rpc_client: &RpcClient,
    p2w_addr: &Pubkey,
) -> Result<Pyth2WormholeConfig, ErrBox> {
    let p2w_config_addr = P2WConfigAccount::<{ AccountState::Initialized }>::key(None, p2w_addr);

    let config = Pyth2WormholeConfig::try_from_slice(
        rpc_client
            .get_account_data(&p2w_config_addr)
            .await?
            .as_slice(),
    )?;

    Ok(config)
}

/// Generate an Instruction for making the attest() contract
/// call.
pub fn gen_attest_tx(
    p2w_addr: Pubkey,
    p2w_config: &Pyth2WormholeConfig, // Must be fresh, not retrieved inside to keep side effects away
    payer: &Keypair,
    wh_msg_id: u64,
    symbols: &[P2WSymbol],
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBoxSend> {
    let emitter_addr = P2WEmitter::key(None, &p2w_addr);

    let seq_addr = Sequence::key(
        &SequenceDerivationData {
            emitter_key: &emitter_addr,
        },
        &p2w_config.wh_prog,
    );

    let p2w_config_addr = P2WConfigAccount::<{ AccountState::Initialized }>::key(None, &p2w_addr);
    if symbols.len() > p2w_config.max_batch_size as usize {
        return Err((format!(
            "Expected up to {} symbols for batch, {} were found",
            p2w_config.max_batch_size,
            symbols.len()
        ))
        .into());
    }
    // Initial attest() accounts
    let mut acc_metas = vec![
        // payer
        AccountMeta::new(payer.pubkey(), true),
        // system_program
        AccountMeta::new_readonly(system_program::id(), false),
        // config
        AccountMeta::new_readonly(p2w_config_addr, false),
    ];

    // Batch contents and padding if applicable
    let mut padded_symbols = {
        let mut not_padded: Vec<_> = symbols
            .iter()
            .flat_map(|s| {
                let state_address = AttestationStatePDA::key(&s.price_addr, &p2w_addr);
                vec![
                    AccountMeta::new(state_address, false),
                    AccountMeta::new_readonly(s.price_addr, false),
                ]
            })
            .collect();

        // Align to max batch size with null accounts
        let mut padding_accounts =
            vec![
                AccountMeta::new_readonly(Pubkey::new_from_array([0u8; 32]), false);
                2 * (p2w_config.max_batch_size as usize - symbols.len())
            ];
        not_padded.append(&mut padding_accounts);

        not_padded
    };

    acc_metas.append(&mut padded_symbols);

    // Continue with other pyth_wormhole_attester accounts
    let mut acc_metas_remainder = vec![
        // clock
        AccountMeta::new_readonly(clock::id(), false),
        // wh_prog
        AccountMeta::new_readonly(p2w_config.wh_prog, false),
        // wh_bridge
        AccountMeta::new(
            Bridge::<{ AccountState::Initialized }>::key(None, &p2w_config.wh_prog),
            false,
        ),
        // wh_message
        AccountMeta::new(
            P2WMessage::key(
                &P2WMessageDrvData {
                    id:            wh_msg_id,
                    batch_size:    symbols.len() as u16,
                    message_owner: payer.pubkey(),
                },
                &p2w_addr,
            ),
            false,
        ),
        // wh_emitter
        AccountMeta::new_readonly(emitter_addr, false),
        // wh_sequence
        AccountMeta::new(seq_addr, false),
        // wh_fee_collector
        AccountMeta::new(FeeCollector::<'_>::key(None, &p2w_config.wh_prog), false),
        AccountMeta::new_readonly(rent::id(), false),
    ];

    acc_metas.append(&mut acc_metas_remainder);

    let ix_data = (
        pyth_wormhole_attester::instruction::Instruction::Attest,
        AttestData {
            consistency_level:  ConsistencyLevel::Confirmed,
            message_account_id: wh_msg_id,
        },
    );

    let ix = Instruction::new_with_bytes(p2w_addr, ix_data.try_to_vec()?.as_slice(), acc_metas);

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer.pubkey()),
        &vec![payer],
        latest_blockhash,
    );
    Ok(tx_signed)
}

/// Enumerates all products and their prices in a Pyth mapping.
/// Returns map of: product address => [price addresses]
pub async fn crawl_pyth_mapping(
    rpc_client: &RpcClient,
    first_mapping_addr: &Pubkey,
) -> Result<Vec<P2WProductAccount>, ErrBox> {
    let mut ret: Vec<P2WProductAccount> = vec![];

    let mut n_mappings = 1; // We assume the first one must be valid
    let mut n_products_total = 0; // Grand total products in all mapping accounts
    let mut n_prices_total = 0; // Grand total prices in all product accounts in all mapping accounts

    let mut mapping_addr = *first_mapping_addr;

    // loop until the last non-zero MappingAccount.next account
    loop {
        let mapping_bytes = rpc_client.get_account_data(&mapping_addr).await?;
        let mapping = match load_mapping_account(&mapping_bytes) {
            Ok(p) => p,
            Err(e) => {
                warn!(
                    "Mapping: Could not parse account {} as a Pyth mapping, crawling terminated. Error: {:?}",
                    mapping_addr, e
                );
                break;
            }
        };

        // Products in this mapping account
        let mut n_mapping_products = 0;

        // loop through all products in this mapping; filter out zeroed-out empty product slots
        for prod_addr in mapping.products.iter().filter(|p| *p != &Pubkey::default()) {
            let prod_bytes = rpc_client.get_account_data(prod_addr).await?;
            let prod = match load_product_account(&prod_bytes) {
                Ok(p) => p,
                Err(e) => {
                    warn!("Mapping {}: Could not parse account {} as a Pyth product, skipping to next product. Error: {:?}", mapping_addr, prod_addr, e);
                    continue;
                }
            };

            let mut prod_name = None;
            for (key, val) in prod.iter() {
                if key.eq_ignore_ascii_case("symbol") {
                    prod_name = Some(val.to_owned());
                }
            }

            let mut price_addr = prod.px_acc;
            let mut n_prod_prices = 0;

            // the product might have no price, can happen in tilt due to race-condition, failed tx to add price, ...
            if price_addr == Pubkey::default() {
                debug!(
                    "Found product with addr {} that has no prices. \
                    This should not happen in a production enviornment.",
                    prod_addr
                );

                continue;
            }

            // loop until the last non-zero PriceAccount.next account
            let mut price_accounts: Vec<Pubkey> = vec![];
            loop {
                let price_bytes = rpc_client.get_account_data(&price_addr).await?;
                let price = match load_price_account(&price_bytes) {
                    Ok(p) => p,
                    Err(e) => {
                        warn!("Product {}: Could not parse account {} as a Pyth price, skipping to next product. Error: {:?}", prod_addr, price_addr, e);
                        break;
                    }
                };

                price_accounts.push(price_addr);
                n_prod_prices += 1;

                if price.next == Pubkey::default() {
                    trace!(
                        "Product {}: processed {} price(s)",
                        prod_addr,
                        n_prod_prices
                    );
                    break;
                }

                price_addr = price.next;
            }
            ret.push(P2WProductAccount {
                key:                *prod_addr,
                name:               prod_name.clone(),
                price_account_keys: price_accounts,
            });

            n_prices_total += n_prod_prices;
        }
        n_mapping_products += 1;
        n_products_total += n_mapping_products;

        // Traverse other mapping accounts if applicable
        if mapping.next == Pubkey::default() {
            trace!(
                "Mapping {}: processed {} products",
                mapping_addr,
                n_mapping_products
            );

            break;
        }
        mapping_addr = mapping.next;
        n_mappings += 1;
    }
    debug!(
        "Processed {} price(s) in {} product account(s), in {} mapping account(s)",
        n_prices_total, n_products_total, n_mappings
    );

    Ok(ret)
}

#[derive(Clone, Debug)]
pub struct P2WProductAccount {
    pub key:                Pubkey,
    pub name:               Option<String>,
    pub price_account_keys: Vec<Pubkey>,
}
