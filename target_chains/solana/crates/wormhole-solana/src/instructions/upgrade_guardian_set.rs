use {
    crate::{
        accounts::{Account, Claim, ClaimSeeds},
        instructions::Instruction,
        Config, GuardianSet,
    },
    borsh::BorshSerialize,
    solana_program::{
        instruction::{AccountMeta, Instruction as SolanaInstruction},
        pubkey::Pubkey,
    },
    wormhole_sdk::Chain,
};

pub const CHAIN_ID_GOVERANCE: Chain = Chain::Solana;

#[derive(Debug, Eq, PartialEq, BorshSerialize)]
struct UpgradeGuardianSetData {}

pub fn upgrade_guardian_set(
    wormhole: Pubkey,
    payer: Pubkey,
    posted_vaa: Pubkey,
    guardian_set_index_old: u32,
    emitter: Pubkey,
    sequence: u64,
) -> Result<SolanaInstruction, serde_wormhole::Error> {
    let bridge = Config::key(&wormhole, ());
    let guardian_set_old = GuardianSet::key(&wormhole, guardian_set_index_old);
    let guardian_set_new = GuardianSet::key(&wormhole, guardian_set_index_old.saturating_add(1));
    let claim = Claim::key(
        &wormhole,
        ClaimSeeds {
            emitter,
            chain: CHAIN_ID_GOVERANCE,
            sequence,
        },
    );

    Ok(SolanaInstruction {
        program_id: wormhole,
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(bridge, false),
            AccountMeta::new_readonly(posted_vaa, false),
            AccountMeta::new(claim, false),
            AccountMeta::new(guardian_set_old, false),
            AccountMeta::new(guardian_set_new, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
        data: (Instruction::UpgradeGuardianSet, UpgradeGuardianSetData {}).try_to_vec()?,
    })
}
