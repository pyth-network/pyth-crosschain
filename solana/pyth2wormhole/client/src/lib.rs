pub mod attestation_cfg;
pub mod batch_state;
pub mod util;

use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_program::{
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
};
use solana_sdk::transaction::Transaction;
use solitaire::{
    processors::seeded::Seeded,
    AccountState,
    ErrBox,
};
use solitaire_client::{
    AccEntry,
    Keypair,
    SolSigner,
    ToInstruction,
};

use bridge::{
    accounts::{
        Bridge,
        FeeCollector,
        Sequence,
        SequenceDerivationData,
    },
    types::ConsistencyLevel,
};

use p2w_sdk::P2WEmitter;

use pyth2wormhole::{
    attest::P2W_MAX_BATCH_SIZE,
    config::P2WConfigAccount,
    initialize::InitializeAccounts,
    migrate::MigrateAccounts,
    set_config::SetConfigAccounts,
    AttestData,
};

pub use pyth2wormhole::Pyth2WormholeConfig;

pub use attestation_cfg::{
    AttestationConditions,
    AttestationConfig,
    P2WSymbol,
};
pub use batch_state::BatchState;
pub use util::{
    RLMutex,
    RLMutexGuard,
};

/// Future-friendly version of solitaire::ErrBox
pub type ErrBoxSend = Box<dyn std::error::Error + Send + Sync>;

pub fn gen_init_tx(
    payer: Keypair,
    p2w_addr: Pubkey,
    config: Pyth2WormholeConfig,
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBox> {
    use AccEntry::*;

    let payer_pubkey = payer.pubkey();

    let accs = InitializeAccounts {
        payer: Signer(payer),
        new_config: Derived(p2w_addr),
    };

    let ix_data = (pyth2wormhole::instruction::Instruction::Initialize, config);

    let (ix, signers) = accs.to_ix(p2w_addr, ix_data.try_to_vec()?.as_slice())?;

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer_pubkey),
        signers.iter().collect::<Vec<_>>().as_ref(),
        latest_blockhash,
    );
    Ok(tx_signed)
}

pub fn gen_set_config_tx(
    payer: Keypair,
    p2w_addr: Pubkey,
    owner: Keypair,
    new_config: Pyth2WormholeConfig,
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBox> {
    use AccEntry::*;

    let payer_pubkey = payer.pubkey();

    let accs = SetConfigAccounts {
        payer: Signer(payer),
        current_owner: Signer(owner),
        config: Derived(p2w_addr),
    };

    let ix_data = (
        pyth2wormhole::instruction::Instruction::SetConfig,
        new_config,
    );

    let (ix, signers) = accs.to_ix(p2w_addr, ix_data.try_to_vec()?.as_slice())?;

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer_pubkey),
        signers.iter().collect::<Vec<_>>().as_ref(),
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
    use AccEntry::*;

    let payer_pubkey = payer.pubkey();

    let accs = MigrateAccounts {
        new_config: Derived(p2w_addr),
        old_config: Derived(p2w_addr),
        current_owner: Signer(owner),
        payer: Signer(payer),
    };

    let ix_data = (
        pyth2wormhole::instruction::Instruction::Migrate,
        (),
    );

    let (ix, signers) = accs.to_ix(p2w_addr, ix_data.try_to_vec()?.as_slice())?;

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer_pubkey),
        signers.iter().collect::<Vec<_>>().as_ref(),
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
    symbols: &[P2WSymbol],
    wh_msg: &Keypair,
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
            .map(|s| {
                vec![
                    AccountMeta::new_readonly(s.product_addr, false),
                    AccountMeta::new_readonly(s.price_addr, false),
                ]
            })
            .flatten()
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

    // Continue with other pyth2wormhole accounts
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
        AccountMeta::new(wh_msg.pubkey(), true),
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
        pyth2wormhole::instruction::Instruction::Attest,
        AttestData {
            consistency_level: ConsistencyLevel::Confirmed,
        },
    );

    let ix = Instruction::new_with_bytes(
        p2w_addr,
        ix_data
            .try_to_vec()
            .map_err(|e| -> ErrBoxSend { Box::new(e) })?
            .as_slice(),
        acc_metas,
    );

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer.pubkey()),
        &vec![&payer, &wh_msg],
        latest_blockhash,
    );
    Ok(tx_signed)
}
