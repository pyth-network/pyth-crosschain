pub mod attestation_cfg;
pub mod batch_state;
pub mod message;
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
use solana_sdk::{
    signer::{
        keypair::Keypair,
        Signer,
    },
    transaction::Transaction,
};
use solitaire::{
    processors::seeded::Seeded,
    AccountState,
    ErrBox,
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
    config::{
        OldP2WConfigAccount,
        P2WConfigAccount,
    },
    message::{
        P2WMessage,
        P2WMessageDrvData,
    },
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

pub use message::P2WMessageQueue;

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

    let ix_data = (pyth2wormhole::instruction::Instruction::Initialize, config);

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

pub fn gen_set_config_tx(
    payer: Keypair,
    p2w_addr: Pubkey,
    owner: Keypair,
    new_config: Pyth2WormholeConfig,
    latest_blockhash: Hash,
) -> Result<Transaction, ErrBox> {
    let payer_pubkey = payer.pubkey();

    let acc_metas = vec![
        // config
        AccountMeta::new(
            P2WConfigAccount::<{ AccountState::Initialized }>::key(None, &p2w_addr),
            false,
        ),
        // current_owner
        AccountMeta::new(owner.pubkey(), true),
        // payer
        AccountMeta::new(payer.pubkey(), true),
    ];

    let ix_data = (
        pyth2wormhole::instruction::Instruction::SetConfig,
        new_config,
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

    let ix_data = (pyth2wormhole::instruction::Instruction::Migrate, ());

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
        AccountMeta::new(
            P2WMessage::key(
                &P2WMessageDrvData {
                    id: wh_msg_id,
                    batch_size: symbols.len() as u64,
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
        pyth2wormhole::instruction::Instruction::Attest,
        AttestData {
            consistency_level: ConsistencyLevel::Confirmed,
            message_account_id: wh_msg_id,
        },
    );

    let ix = Instruction::new_with_bytes(p2w_addr, ix_data.try_to_vec()?.as_slice(), acc_metas);

    let tx_signed = Transaction::new_signed_with_payer::<Vec<&Keypair>>(
        &[ix],
        Some(&payer.pubkey()),
        &vec![&payer],
        latest_blockhash,
    );
    Ok(tx_signed)
}
