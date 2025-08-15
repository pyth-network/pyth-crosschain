#![allow(clippy::result_large_err, unexpected_cfgs)]

use anchor_lang::prelude::*;
use solana_program::{clock::Clock, keccak};

pub mod error;
pub mod sdk;

use error::EntropyError;

declare_id!("pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ");

pub const CONFIG_SEED: &[u8] = b"config";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const PROVIDER_SEED: &[u8] = b"provider";
pub const REQUEST_SEED: &[u8] = b"request";

#[program]
pub mod pyth_entropy {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, initial_config: EntropyConfig) -> Result<()> {
        let config = &mut ctx.accounts.config;
        **config = initial_config;
        Ok(())
    }

    pub fn register(
        ctx: Context<Register>,
        fee_in_lamports: u64,
        commitment: [u8; 32],
        commitment_metadata: Vec<u8>,
        chain_length: u64,
        uri: Vec<u8>,
    ) -> Result<()> {
        require!(chain_length > 0, EntropyError::AssertionFailure);

        let provider_info = &mut ctx.accounts.provider_info;

        provider_info.provider = ctx.accounts.provider.key();
        provider_info.fee_in_lamports = fee_in_lamports;
        provider_info.original_commitment = commitment;
        provider_info.original_commitment_sequence_number = provider_info.sequence_number;
        provider_info.current_commitment = commitment;
        provider_info.current_commitment_sequence_number = provider_info.sequence_number;
        provider_info.commitment_metadata = commitment_metadata;
        provider_info.end_sequence_number = provider_info.sequence_number + chain_length;
        provider_info.uri = uri;
        provider_info.accrued_fees_in_lamports = 0;
        provider_info.sequence_number += 1;
        provider_info.fee_manager = Pubkey::default();
        provider_info.max_num_hashes = 0;
        provider_info.default_gas_limit = 0;

        emit!(ProviderRegistered {
            provider: ctx.accounts.provider.key(),
            fee_in_lamports,
            commitment,
            chain_length,
        });

        Ok(())
    }

    pub fn request_v2(ctx: Context<RequestV2>, gas_limit: u32) -> Result<u64> {
        let provider_info = &mut ctx.accounts.provider_info;
        let config = &ctx.accounts.config;
        let request_account = &mut ctx.accounts.request_account;
        let clock = Clock::get()?;

        require!(
            provider_info.sequence_number > 0,
            EntropyError::NoSuchProvider
        );

        let assigned_sequence_number = provider_info.sequence_number;
        require!(
            assigned_sequence_number < provider_info.end_sequence_number,
            EntropyError::OutOfRandomness
        );

        provider_info.sequence_number += 1;

        let required_fee = get_fee_v2_internal(provider_info, config, gas_limit);
        require!(
            ctx.accounts.payer.lamports() >= required_fee,
            EntropyError::InsufficientFee
        );

        let provider_fee = get_provider_fee_internal(provider_info, gas_limit);
        provider_info.accrued_fees_in_lamports += provider_fee;

        let user_contribution = generate_user_contribution(&clock, &ctx.accounts.requester.key());
        let user_commitment = construct_user_commitment(user_contribution);

        request_account.provider = provider_info.provider;
        request_account.sequence_number = assigned_sequence_number;
        request_account.num_hashes =
            (assigned_sequence_number - provider_info.current_commitment_sequence_number) as u32;
        request_account.commitment =
            combine_commitments(user_commitment, provider_info.current_commitment);
        request_account.requester = ctx.accounts.requester.key();
        request_account.block_number = clock.slot;
        request_account.use_blockhash = false;
        request_account.callback_status = CallbackStatus::NotNecessary;
        request_account.gas_limit = gas_limit;

        emit!(RandomnessRequested {
            provider: provider_info.provider,
            requester: ctx.accounts.requester.key(),
            sequence_number: assigned_sequence_number,
            user_contribution,
            gas_limit,
        });

        Ok(assigned_sequence_number)
    }

    pub fn reveal_with_callback(
        ctx: Context<RevealWithCallback>,
        sequence_number: u64,
        user_contribution: [u8; 32],
        provider_contribution: [u8; 32],
    ) -> Result<()> {
        let request_account = &mut ctx.accounts.request_account;
        let provider_info = &mut ctx.accounts.provider_info;

        require!(
            request_account.callback_status == CallbackStatus::NotStarted
                || request_account.callback_status == CallbackStatus::Failed,
            EntropyError::InvalidRevealCall
        );

        let random_number = reveal_helper(
            request_account,
            provider_info,
            user_contribution,
            provider_contribution,
        )?;

        request_account.callback_status = CallbackStatus::Completed;

        emit!(RandomnessRevealed {
            provider: provider_info.provider,
            requester: request_account.requester,
            sequence_number,
            random_number,
            user_contribution,
            provider_contribution,
        });

        Ok(())
    }

    pub fn get_provider_info_v2(_ctx: Context<GetProviderInfoV2>) -> Result<()> {
        Ok(())
    }

    pub fn get_request_v2(_ctx: Context<GetRequestV2>) -> Result<()> {
        Ok(())
    }

    pub fn get_fee_v2(ctx: Context<GetFeeV2>, gas_limit: u32) -> Result<u64> {
        let provider_info = &ctx.accounts.provider_info;
        let config = &ctx.accounts.config;
        Ok(get_fee_v2_internal(provider_info, config, gas_limit))
    }

    pub fn set_provider_fee(ctx: Context<SetProviderFee>, new_fee_in_lamports: u64) -> Result<()> {
        let provider_info = &mut ctx.accounts.provider_info;
        require!(
            provider_info.sequence_number > 0,
            EntropyError::NoSuchProvider
        );

        let old_fee = provider_info.fee_in_lamports;
        provider_info.fee_in_lamports = new_fee_in_lamports;

        emit!(ProviderFeeUpdated {
            provider: provider_info.provider,
            old_fee,
            new_fee: new_fee_in_lamports,
        });

        Ok(())
    }

    pub fn set_provider_uri(ctx: Context<SetProviderUri>, new_uri: Vec<u8>) -> Result<()> {
        let provider_info = &mut ctx.accounts.provider_info;
        require!(
            provider_info.sequence_number > 0,
            EntropyError::NoSuchProvider
        );

        let old_uri = provider_info.uri.clone();
        provider_info.uri = new_uri.clone();

        emit!(ProviderUriUpdated {
            provider: provider_info.provider,
            old_uri,
            new_uri,
        });

        Ok(())
    }

    pub fn set_fee_manager(ctx: Context<SetFeeManager>, manager: Pubkey) -> Result<()> {
        let provider_info = &mut ctx.accounts.provider_info;
        require!(
            provider_info.sequence_number > 0,
            EntropyError::NoSuchProvider
        );

        let old_fee_manager = provider_info.fee_manager;
        provider_info.fee_manager = manager;

        emit!(ProviderFeeManagerUpdated {
            provider: provider_info.provider,
            old_fee_manager,
            new_fee_manager: manager,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let provider_info = &mut ctx.accounts.provider_info;
        require!(
            provider_info.accrued_fees_in_lamports >= amount,
            EntropyError::InsufficientFee
        );

        provider_info.accrued_fees_in_lamports -= amount;

        **ctx
            .accounts
            .provider
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;
        **ctx
            .accounts
            .treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;

        emit!(Withdrawal {
            provider: provider_info.provider,
            recipient: ctx.accounts.provider.key(),
            amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, space = 8 + EntropyConfig::LEN, payer = payer, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, EntropyConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Register<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(
        init,
        payer = provider,
        space = 8 + ProviderInfo::LEN,
        seeds = [PROVIDER_SEED, provider.key().as_ref()],
        bump
    )]
    pub provider_info: Account<'info, ProviderInfo>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestV2<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub requester: Signer<'info>,
    #[account(mut, seeds = [PROVIDER_SEED, provider_info.provider.as_ref()], bump)]
    pub provider_info: Account<'info, ProviderInfo>,
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, EntropyConfig>,
    #[account(init, payer = payer, space = 8 + EntropyRequest::LEN, seeds = [REQUEST_SEED, provider_info.provider.as_ref(), &provider_info.sequence_number.to_le_bytes()], bump)]
    pub request_account: Account<'info, EntropyRequest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealWithCallback<'info> {
    #[account(mut)]
    pub revealer: Signer<'info>,
    #[account(
        mut,
        seeds = [PROVIDER_SEED, provider_info.provider.as_ref()],
        bump
    )]
    pub provider_info: Account<'info, ProviderInfo>,
    #[account(
        mut,
        seeds = [REQUEST_SEED, request_account.provider.as_ref(), &request_account.sequence_number.to_le_bytes()],
        bump,
        close = revealer
    )]
    pub request_account: Account<'info, EntropyRequest>,
}

#[derive(Accounts)]
pub struct GetProviderInfoV2<'info> {
    #[account(
        seeds = [PROVIDER_SEED, provider_info.provider.as_ref()],
        bump
    )]
    pub provider_info: Account<'info, ProviderInfo>,
}

#[derive(Accounts)]
pub struct GetRequestV2<'info> {
    #[account(
        seeds = [REQUEST_SEED, request_account.provider.as_ref(), &request_account.sequence_number.to_le_bytes()],
        bump
    )]
    pub request_account: Account<'info, EntropyRequest>,
}

#[derive(Accounts)]
pub struct GetFeeV2<'info> {
    #[account(
        seeds = [PROVIDER_SEED, provider_info.provider.as_ref()],
        bump
    )]
    pub provider_info: Account<'info, ProviderInfo>,
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, EntropyConfig>,
}

#[derive(Accounts)]
pub struct SetProviderFee<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(
        mut,
        seeds = [PROVIDER_SEED, provider.key().as_ref()],
        bump,
        constraint = provider_info.provider == provider.key() @ EntropyError::Unauthorized
    )]
    pub provider_info: Account<'info, ProviderInfo>,
}

#[derive(Accounts)]
pub struct SetProviderUri<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(
        mut,
        seeds = [PROVIDER_SEED, provider.key().as_ref()],
        bump,
        constraint = provider_info.provider == provider.key() @ EntropyError::Unauthorized
    )]
    pub provider_info: Account<'info, ProviderInfo>,
}

#[derive(Accounts)]
pub struct SetFeeManager<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(
        mut,
        seeds = [PROVIDER_SEED, provider.key().as_ref()],
        bump,
        constraint = provider_info.provider == provider.key() @ EntropyError::Unauthorized
    )]
    pub provider_info: Account<'info, ProviderInfo>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(
        mut,
        seeds = [PROVIDER_SEED, provider.key().as_ref()],
        bump,
        constraint = provider_info.provider == provider.key() @ EntropyError::Unauthorized
    )]
    pub provider_info: Account<'info, ProviderInfo>,
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: SystemAccount<'info>,
}

#[account]
pub struct EntropyConfig {
    pub admin: Pubkey,
    pub pyth_fee_in_lamports: u64,
    pub default_provider: Pubkey,
    pub accrued_pyth_fees_in_lamports: u64,
}

impl EntropyConfig {
    pub const LEN: usize = 32 + 8 + 32 + 8;
}

#[account]
pub struct ProviderInfo {
    pub provider: Pubkey,
    pub fee_in_lamports: u64,
    pub accrued_fees_in_lamports: u64,
    pub original_commitment: [u8; 32],
    pub original_commitment_sequence_number: u64,
    pub current_commitment: [u8; 32],
    pub current_commitment_sequence_number: u64,
    pub commitment_metadata: Vec<u8>,
    pub end_sequence_number: u64,
    pub sequence_number: u64,
    pub uri: Vec<u8>,
    pub fee_manager: Pubkey,
    pub max_num_hashes: u32,
    pub default_gas_limit: u32,
}

impl ProviderInfo {
    pub const LEN: usize = 32 + 8 + 8 + 32 + 8 + 32 + 8 + 4 + 256 + 8 + 8 + 4 + 256 + 32 + 4 + 4;
}

#[account]
pub struct EntropyRequest {
    pub provider: Pubkey,
    pub sequence_number: u64,
    pub num_hashes: u32,
    pub commitment: [u8; 32],
    pub requester: Pubkey,
    pub block_number: u64,
    pub use_blockhash: bool,
    pub callback_status: CallbackStatus,
    pub gas_limit: u32,
}

impl EntropyRequest {
    pub const LEN: usize = 32 + 8 + 4 + 32 + 32 + 8 + 1 + 1 + 4;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CallbackStatus {
    NotNecessary,
    NotStarted,
    InProgress,
    Completed,
    Failed,
}

#[event]
pub struct ProviderRegistered {
    pub provider: Pubkey,
    pub fee_in_lamports: u64,
    pub commitment: [u8; 32],
    pub chain_length: u64,
}

#[event]
pub struct RandomnessRequested {
    pub provider: Pubkey,
    pub requester: Pubkey,
    pub sequence_number: u64,
    pub user_contribution: [u8; 32],
    pub gas_limit: u32,
}

#[event]
pub struct RandomnessRevealed {
    pub provider: Pubkey,
    pub requester: Pubkey,
    pub sequence_number: u64,
    pub random_number: [u8; 32],
    pub user_contribution: [u8; 32],
    pub provider_contribution: [u8; 32],
}

#[event]
pub struct ProviderFeeUpdated {
    pub provider: Pubkey,
    pub old_fee: u64,
    pub new_fee: u64,
}

#[event]
pub struct ProviderUriUpdated {
    pub provider: Pubkey,
    pub old_uri: Vec<u8>,
    pub new_uri: Vec<u8>,
}

#[event]
pub struct ProviderFeeManagerUpdated {
    pub provider: Pubkey,
    pub old_fee_manager: Pubkey,
    pub new_fee_manager: Pubkey,
}

#[event]
pub struct Withdrawal {
    pub provider: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

fn reveal_helper(
    request: &mut EntropyRequest,
    provider_info: &mut ProviderInfo,
    user_contribution: [u8; 32],
    provider_contribution: [u8; 32],
) -> Result<[u8; 32]> {
    let provider_commitment =
        construct_provider_commitment(request.num_hashes, provider_contribution);
    let user_commitment = construct_user_commitment(user_contribution);
    let expected_commitment = combine_commitments(user_commitment, provider_commitment);

    require!(
        expected_commitment == request.commitment,
        EntropyError::IncorrectRevelation
    );

    if provider_info.current_commitment_sequence_number < request.sequence_number {
        provider_info.current_commitment_sequence_number = request.sequence_number;
        provider_info.current_commitment = provider_contribution;
    }

    let random_number = combine_random_values(user_contribution, provider_contribution, [0u8; 32]);
    Ok(random_number)
}

fn construct_user_commitment(user_randomness: [u8; 32]) -> [u8; 32] {
    keccak::hash(&user_randomness).to_bytes()
}

fn construct_provider_commitment(num_hashes: u32, revelation: [u8; 32]) -> [u8; 32] {
    let mut current_hash = revelation;
    for _ in 0..num_hashes {
        current_hash = keccak::hash(&current_hash).to_bytes();
    }
    current_hash
}

fn combine_commitments(user_commitment: [u8; 32], provider_commitment: [u8; 32]) -> [u8; 32] {
    let mut combined = Vec::new();
    combined.extend_from_slice(&user_commitment);
    combined.extend_from_slice(&provider_commitment);
    keccak::hash(&combined).to_bytes()
}

fn combine_random_values(
    user_randomness: [u8; 32],
    provider_randomness: [u8; 32],
    block_hash: [u8; 32],
) -> [u8; 32] {
    let mut combined = Vec::new();
    combined.extend_from_slice(&user_randomness);
    combined.extend_from_slice(&provider_randomness);
    combined.extend_from_slice(&block_hash);
    keccak::hash(&combined).to_bytes()
}

fn generate_user_contribution(clock: &Clock, requester: &Pubkey) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(&clock.slot.to_le_bytes());
    data.extend_from_slice(&clock.unix_timestamp.to_le_bytes());
    data.extend_from_slice(requester.as_ref());
    keccak::hash(&data).to_bytes()
}

fn get_fee_v2_internal(
    provider_info: &ProviderInfo,
    config: &EntropyConfig,
    gas_limit: u32,
) -> u64 {
    get_provider_fee_internal(provider_info, gas_limit) + config.pyth_fee_in_lamports
}

fn get_provider_fee_internal(provider_info: &ProviderInfo, _gas_limit: u32) -> u64 {
    provider_info.fee_in_lamports
}
