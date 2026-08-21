use crate::{
    error::CoreBridgeError,
    legacy::{instruction::InitializeArgs, utils::LegacyAnchorized},
    state::{Config, GuardianSet},
};
use anchor_lang::prelude::*;

const _PYTH_INITIAL_MULTISIG_SET_STAGING: [[u8; 20]; 3] = [
    [
        0xdc, 0xd3, 0x7a, 0x16, 0xf4, 0x2a, 0x7d, 0xdd, 0x37, 0x70, 0x46, 0xc3, 0xd6, 0x07, 0xe7,
        0x22, 0x7c, 0x1e, 0xf4, 0x59,
    ],
    [
        0x10, 0x98, 0xb2, 0x2a, 0x55, 0x20, 0x25, 0x94, 0x34, 0x10, 0x52, 0x60, 0x52, 0x28, 0xe3,
        0xd8, 0x96, 0x13, 0x2f, 0x6a,
    ],
    [
        0xff, 0x3b, 0x3a, 0xb7, 0xe0, 0x73, 0x14, 0x35, 0x9b, 0xd2, 0x46, 0x9c, 0x2b, 0x15, 0x91,
        0x47, 0x8e, 0x39, 0x81, 0x24,
    ],
];

const _PYTH_INITIAL_MULTISIG_SET_PROD: [[u8; 20]; 5] = [
    [
        0x41, 0x53, 0x4b, 0xb1, 0x76, 0xe4, 0x61, 0xa3, 0xfb, 0x30, 0x47, 0x94, 0x00, 0xf2, 0x10,
        0x54, 0x9e, 0xcc, 0xe6, 0x38,
    ],
    [
        0x65, 0x02, 0x98, 0x7b, 0x62, 0xf2, 0x1c, 0xab, 0x7e, 0xb5, 0xcc, 0xd8, 0xf0, 0x17, 0x30,
        0x84, 0xb6, 0x0d, 0x5b, 0x41,
    ],
    [
        0x44, 0xa3, 0xe8, 0xf6, 0xa3, 0x82, 0x41, 0x2c, 0xf6, 0xbb, 0x90, 0xa3, 0xf8, 0x10, 0x6e,
        0x68, 0x97, 0x74, 0x76, 0xc9,
    ],
    [
        0xd9, 0xd7, 0xd4, 0x52, 0x95, 0x77, 0x86, 0x43, 0x52, 0xc9, 0xa6, 0x53, 0x9a, 0x48, 0x23,
        0x8f, 0xcd, 0x44, 0x70, 0x52,
    ],
    [
        0x16, 0x63, 0xa5, 0xa8, 0x22, 0x33, 0x6e, 0xce, 0x48, 0x55, 0x9b, 0x1d, 0xfb, 0x1e, 0x93,
        0xa0, 0x17, 0xa7, 0xda, 0xc3,
    ],
];

cfg_if::cfg_if! {
    if #[cfg(feature = "beta")] {
        const PYTH_INITIAL_MULTISIG_SET : [[u8;20]; 3] = _PYTH_INITIAL_MULTISIG_SET_STAGING;
    } else {
        const PYTH_INITIAL_MULTISIG_SET : [[u8;20]; 5] = _PYTH_INITIAL_MULTISIG_SET_PROD;
    }
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct Initialize<'info> {
    /// Account to warehouse Core Bridge program info. This account is especially important for
    /// redeeming governance VAAs, where the guardian set attesting for a governance decree must be
    /// the one encoded in this account.
    #[account(
        init_if_needed,
        payer = payer,
        space = Config::INIT_SPACE,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    config: Account<'info, LegacyAnchorized<Config>>,

    /// New guardian set account acting as the active guardian set. This account is set up as the
    /// legacy schema (without a discriminator) for local testing purposes.
    ///
    /// NOTE: There are other Core Bridge smart contracts that take an additional guardian set index
    /// parameter to initialize a present-day guardian set at initialization. But because the Core
    /// Bridge already exists on Solana's mainnet and devnet, we keep initialization assuming the
    /// initial guardian set is index 0.
    #[account(
        init,
        payer = payer,
        space = GuardianSet::compute_size(PYTH_INITIAL_MULTISIG_SET.len()),
        seeds = [
            GuardianSet::SEED_PREFIX,
            u32::to_be_bytes(0).as_ref()
        ],
        bump,
    )]
    guardian_set: Account<'info, LegacyAnchorized<GuardianSet>>,

    /// Account used to collect Wormhole fees.
    ///
    /// CHECK: This system account is created and will be used whenever the post message
    /// instructions are invoked.
    #[account(
        init_if_needed,
        payer = payer,
        space = 0,
        seeds = [crate::constants::FEE_COLLECTOR_SEED_PREFIX],
        bump,
        owner = system_program.key(),
    )]
    fee_collector: AccountInfo<'info>,

    #[account(mut)]
    payer: Signer<'info>,

    /// Previously needed sysvar.
    ///
    /// CHECK: This account is unchecked.
    _clock: UncheckedAccount<'info>,

    /// Previously needed sysvar.
    ///
    /// CHECK: This account is unchecked.
    _rent: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

impl<'info> crate::legacy::utils::ProcessLegacyInstruction<'info, InitializeArgs>
    for Initialize<'info>
{
    const LOG_IX_NAME: &'static str = "LegacyInitialize";

    const ANCHOR_IX_FN: fn(Context<Self>, InitializeArgs) -> Result<()> = initialize;
}

/// Processor to initialize the program.
///
/// NOTE: This instruction handler does not set the upgrade authority to the Core Bridge's upgrade
/// authority PDA. Because this instruction is from the legacy program's implementation, we do not
/// want to disturb the peace by implementing a new instruction to replace this one. Practically,
/// the Core Bridge is already deployed on Solana's mainnet-beta and devnet, so would never need to
/// initialize again. And for local validator testing (in most cases) the program is simply loaded
/// in the validator and cannot be upgraded.
fn initialize(ctx: Context<Initialize>, _args: InitializeArgs) -> Result<()> {
    let guardian_set_ttl_seconds = 86400;
    let fee_lamports = 0;
    let initial_guardians = PYTH_INITIAL_MULTISIG_SET;

    // Check initial guardians.
    let mut keys = Vec::with_capacity(initial_guardians.len());
    for &guardian in initial_guardians.iter() {
        // We disallow guardian pubkeys that have zero address.
        require!(guardian != [0; 20], CoreBridgeError::GuardianZeroAddress);

        // Check if this pubkey is a duplicate of any already added.
        require!(
            !keys.contains(&guardian),
            CoreBridgeError::DuplicateGuardianAddress
        );
        keys.push(guardian);
    }

    // Set Bridge data account fields.
    ctx.accounts.config.set_inner(
        Config {
            guardian_set_index: 0,
            guardian_set_ttl: guardian_set_ttl_seconds.into(),
            fee_lamports,
            _gap_0: Default::default(),
        }
        .into(),
    );

    // Set guardian set account fields.
    ctx.accounts.guardian_set.set_inner(
        GuardianSet {
            index: 0,
            creation_time: Clock::get().map(Into::into)?,
            keys,
            expiration_time: Default::default(),
        }
        .into(),
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};

    fn decode_keys<const N: usize>(encoded: [&str; N]) -> [[u8; 20]; N] {
        encoded.map(|key| {
            STANDARD
                .decode(key)
                .expect("invalid base64")
                .try_into()
                .expect("guardian key must be 20 bytes")
        })
    }

    #[test]
    fn test_pyth_initial_multisig_set_staging() {
        let expected = decode_keys([
            "3NN6FvQqfd03cEbD1gfnInwe9Fk=",
            "EJiyKlUgJZQ0EFJgUijj2JYTL2o=",
            "/zs6t+BzFDWb0kacKxWRR445gSQ=",
        ]);
        assert_eq!(_PYTH_INITIAL_MULTISIG_SET_STAGING, expected);
    }

    #[test]
    fn test_pyth_initial_multisig_set_prod() {
        let expected = decode_keys([
            "QVNLsXbkYaP7MEeUAPIQVJ7M5jg=",
            "ZQKYe2LyHKt+tczY8BcwhLYNW0E=",
            "RKPo9qOCQSz2u5Cj+BBuaJd0dsk=",
            "2dfUUpV3hkNSyaZTmkgjj81EcFI=",
            "FmOlqCIzbs5IVZsd+x6ToBen2sM=",
        ]);
        assert_eq!(_PYTH_INITIAL_MULTISIG_SET_PROD, expected);
    }
}
