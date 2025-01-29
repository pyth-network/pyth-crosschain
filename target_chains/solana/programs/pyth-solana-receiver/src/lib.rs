// We can't do much about the size of `anchor_lang::error::Error`.
#![allow(clippy::result_large_err)]

pub use pythnet_sdk::wire::v1::MerklePriceUpdate;
use {
    crate::error::ReceiverError,
    anchor_lang::prelude::*,
    pyth_solana_receiver_sdk::{
        config::{Config, DataSource},
        pda::{CONFIG_SEED, TREASURY_SEED},
        price_update::{PriceUpdateV2, TwapUpdate, VerificationLevel},
        PostTwapUpdateParams, PostUpdateAtomicParams, PostUpdateParams,
    },
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot,
        hashers::keccak256_160::Keccak160,
        messages::{Message, TwapMessage},
        wire::{
            from_slice,
            v1::{WormholeMessage, WormholePayload},
        },
    },
    solana_program::{
        keccak, program_memory::sol_memcpy, secp256k1_recover::secp256k1_recover,
        system_instruction,
    },
    wormhole_core_bridge_solana::{
        sdk::{legacy::AccountVariant, VaaAccount},
        state::GuardianSet,
    },
    wormhole_raw_vaas::{utils::quorum, GuardianSetSig, Vaa},
};

pub mod error;
pub mod sdk;

declare_id!(pyth_solana_receiver_sdk::ID);

#[program]
pub mod pyth_solana_receiver {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, initial_config: Config) -> Result<()> {
        require!(
            initial_config.minimum_signatures > 0,
            ReceiverError::ZeroMinimumSignatures
        );
        let config = &mut ctx.accounts.config;
        **config = initial_config;
        Ok(())
    }

    pub fn request_governance_authority_transfer(
        ctx: Context<Governance>,
        target_governance_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.target_governance_authority = Some(target_governance_authority);
        Ok(())
    }

    pub fn cancel_governance_authority_transfer(ctx: Context<Governance>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.target_governance_authority = None;
        Ok(())
    }

    pub fn accept_governance_authority_transfer(
        ctx: Context<AcceptGovernanceAuthorityTransfer>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.governance_authority = config.target_governance_authority.ok_or(error!(
            ReceiverError::NonexistentGovernanceAuthorityTransferRequest
        ))?;
        config.target_governance_authority = None;
        Ok(())
    }

    pub fn set_data_sources(
        ctx: Context<Governance>,
        valid_data_sources: Vec<DataSource>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.valid_data_sources = valid_data_sources;
        Ok(())
    }

    pub fn set_fee(ctx: Context<Governance>, single_update_fee_in_lamports: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.single_update_fee_in_lamports = single_update_fee_in_lamports;
        Ok(())
    }

    pub fn set_wormhole_address(ctx: Context<Governance>, wormhole: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.wormhole = wormhole;
        Ok(())
    }

    pub fn set_minimum_signatures(ctx: Context<Governance>, minimum_signatures: u8) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(minimum_signatures > 0, ReceiverError::ZeroMinimumSignatures);
        config.minimum_signatures = minimum_signatures;
        Ok(())
    }

    /// Post a price update using a VAA and a MerklePriceUpdate.
    /// This function allows you to post a price update in a single transaction.
    /// Compared to `post_update`, it only checks whatever signatures are present in the provided VAA and doesn't fail if the number of signatures is lower than the Wormhole quorum of two thirds of the guardians.
    /// The number of signatures that were in the VAA is stored in the `VerificationLevel` of the `PriceUpdateV2` account.
    ///
    /// We recommend using `post_update_atomic` with 5 signatures. This is close to the maximum signatures you can verify in one transaction without exceeding the transaction size limit.
    ///
    /// # Warning
    ///
    /// Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update.
    pub fn post_update_atomic(
        ctx: Context<PostUpdateAtomic>,
        params: PostUpdateAtomicParams,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let guardian_set =
            deserialize_guardian_set_checked(&ctx.accounts.guardian_set, &config.wormhole)?;

        // This section is borrowed from https://github.com/wormhole-foundation/wormhole/blob/wen/solana-rewrite/solana/programs/core-bridge/src/processor/parse_and_verify_vaa/verify_encoded_vaa_v1.rs#L59
        let vaa = Vaa::parse(&params.vaa).map_err(|_| ReceiverError::DeserializeVaaFailed)?;
        // Must be V1.
        require_eq!(vaa.version(), 1, ReceiverError::InvalidVaaVersion);

        // Make sure the encoded guardian set index agrees with the guardian set account's index.
        let guardian_set = guardian_set.inner();
        require_eq!(
            vaa.guardian_set_index(),
            guardian_set.index,
            ReceiverError::GuardianSetMismatch
        );

        let guardian_keys = &guardian_set.keys;
        let quorum = quorum(guardian_keys.len());
        require_gte!(
            vaa.signature_count(),
            config.minimum_signatures,
            ReceiverError::InsufficientGuardianSignatures
        );
        let verification_level = if usize::from(vaa.signature_count()) >= quorum {
            VerificationLevel::Full
        } else {
            VerificationLevel::Partial {
                num_signatures: vaa.signature_count(),
            }
        };

        // Generate the same message hash (using keccak) that the Guardians used to generate their
        // signatures. This message hash will be hashed again to produce the digest for
        // `secp256k1_recover`.
        let digest = keccak::hash(keccak::hash(vaa.body().as_ref()).as_ref());

        let mut last_guardian_index = None;
        for sig in vaa.signatures() {
            // We do not allow for non-increasing guardian signature indices.
            let index = usize::from(sig.guardian_index());
            if let Some(last_index) = last_guardian_index {
                require!(index > last_index, ReceiverError::InvalidGuardianOrder);
            }

            // Does this guardian index exist in this guardian set?
            let guardian_pubkey = guardian_keys
                .get(index)
                .ok_or_else(|| error!(ReceiverError::InvalidGuardianIndex))?;

            // Now verify that the signature agrees with the expected Guardian's pubkey.
            verify_guardian_signature(&sig, guardian_pubkey, digest.as_ref())?;

            last_guardian_index = Some(index);
        }
        // End borrowed section

        let payer = &ctx.accounts.payer;
        let write_authority: &Signer<'_> = &ctx.accounts.write_authority;
        let treasury = &ctx.accounts.treasury;
        let price_update_account = &mut ctx.accounts.price_update_account;

        let vaa_components = VaaComponents {
            verification_level,
            emitter_address: vaa.body().emitter_address(),
            emitter_chain: vaa.body().emitter_chain(),
        };

        post_price_update_from_vaa(
            config,
            payer,
            write_authority,
            treasury,
            price_update_account,
            &vaa_components,
            vaa.payload().as_ref(),
            &params.merkle_price_update,
        )?;

        Ok(())
    }

    /// Post a price update using an encoded_vaa account and a MerklePriceUpdate calldata.
    /// This should be called after the client has already verified the Vaa via the Wormhole contract.
    /// Check out target_chains/solana/cli/src/main.rs for an example of how to do this.
    pub fn post_update(ctx: Context<PostUpdate>, params: PostUpdateParams) -> Result<()> {
        let config = &ctx.accounts.config;
        let payer: &Signer<'_> = &ctx.accounts.payer;
        let write_authority: &Signer<'_> = &ctx.accounts.write_authority;
        let encoded_vaa = VaaAccount::load(&ctx.accounts.encoded_vaa)?; // IMPORTANT: This line checks that the encoded_vaa has ProcessingStatus::Verified. This check is critical otherwise the program could be tricked into accepting unverified VAAs.
        let treasury: &AccountInfo<'_> = &ctx.accounts.treasury;
        let price_update_account: &mut Account<'_, PriceUpdateV2> =
            &mut ctx.accounts.price_update_account;

        let vaa_components = VaaComponents {
            verification_level: VerificationLevel::Full,
            emitter_address: encoded_vaa.try_emitter_address()?,
            emitter_chain: encoded_vaa.try_emitter_chain()?,
        };

        post_price_update_from_vaa(
            config,
            payer,
            write_authority,
            treasury,
            price_update_account,
            &vaa_components,
            encoded_vaa.try_payload()?.as_ref(),
            &params.merkle_price_update,
        )?;

        Ok(())
    }

    /// Post a TWAP (time weighted average price) update for a given time window.
    /// This should be called after the client has already verified the VAAs via the Wormhole contract.
    /// Check out target_chains/solana/cli/src/main.rs for an example of how to do this.
    pub fn post_twap_update(
        ctx: Context<PostTwapUpdate>,
        params: PostTwapUpdateParams,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let payer: &Signer<'_> = &ctx.accounts.payer;
        let write_authority: &Signer<'_> = &ctx.accounts.write_authority;

        // IMPORTANT: These lines check that the encoded VAAs have ProcessingStatus::Verified.
        // These checks are critical otherwise the program could be tricked into accepting unverified VAAs.
        let start_encoded_vaa = VaaAccount::load(&ctx.accounts.start_encoded_vaa)?;
        let end_encoded_vaa = VaaAccount::load(&ctx.accounts.end_encoded_vaa)?;

        let treasury: &AccountInfo<'_> = &ctx.accounts.treasury;
        let twap_update_account: &mut Account<'_, TwapUpdate> =
            &mut ctx.accounts.twap_update_account;

        let start_vaa_components = VaaComponents {
            verification_level: VerificationLevel::Full,
            emitter_address: start_encoded_vaa.try_emitter_address()?,
            emitter_chain: start_encoded_vaa.try_emitter_chain()?,
        };
        let end_vaa_components = VaaComponents {
            verification_level: VerificationLevel::Full,
            emitter_address: end_encoded_vaa.try_emitter_address()?,
            emitter_chain: end_encoded_vaa.try_emitter_chain()?,
        };

        post_twap_update_from_vaas(
            config,
            payer,
            write_authority,
            treasury,
            twap_update_account,
            &start_vaa_components,
            &end_vaa_components,
            start_encoded_vaa.try_payload()?.as_ref(),
            end_encoded_vaa.try_payload()?.as_ref(),
            &params.start_merkle_price_update,
            &params.end_merkle_price_update,
        )?;

        Ok(())
    }

    pub fn reclaim_rent(_ctx: Context<ReclaimRent>) -> Result<()> {
        Ok(())
    }
    pub fn reclaim_twap_rent(_ctx: Context<ReclaimTwapRent>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(initial_config : Config)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, space = Config::LEN, payer=payer, seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Governance<'info> {
    #[account(constraint =
        payer.key() == config.governance_authority @
        ReceiverError::GovernanceAuthorityMismatch
    )]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct AcceptGovernanceAuthorityTransfer<'info> {
    #[account(constraint =
        payer.key() == config.target_governance_authority.ok_or(error!(ReceiverError::NonexistentGovernanceAuthorityTransferRequest))? @
        ReceiverError::TargetGovernanceAuthorityMismatch
    )]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
#[instruction(params: PostUpdateParams)]
pub struct PostUpdate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(owner = config.wormhole @ ReceiverError::WrongVaaOwner)]
    /// CHECK: We aren't deserializing the VAA here but later with VaaAccount::load, which is the recommended way
    pub encoded_vaa: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    /// CHECK: This is just a PDA controlled by the program. There is currently no way to withdraw funds from it.
    #[account(mut, seeds = [TREASURY_SEED.as_ref(), &[params.treasury_id]], bump)]
    pub treasury: AccountInfo<'info>,
    /// The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
    /// Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
    #[account(init_if_needed, constraint = price_update_account.write_authority == Pubkey::default() || price_update_account.write_authority == write_authority.key() @ ReceiverError::WrongWriteAuthority , payer =payer, space = PriceUpdateV2::LEN)]
    pub price_update_account: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
    pub write_authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(params: PostTwapUpdateParams)]
pub struct PostTwapUpdate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: We aren't deserializing the VAA here but later with VaaAccount::load, which is the recommended way
    #[account(owner = config.wormhole @ ReceiverError::WrongVaaOwner)]
    pub start_encoded_vaa: AccountInfo<'info>,
    /// CHECK: We aren't deserializing the VAA here but later with VaaAccount::load, which is the recommended way
    #[account(owner = config.wormhole @ ReceiverError::WrongVaaOwner)]
    pub end_encoded_vaa: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    /// CHECK: This is just a PDA controlled by the program. There is currently no way to withdraw funds from it.
    #[account(mut, seeds = [TREASURY_SEED.as_ref(), &[params.treasury_id]], bump)]
    pub treasury: AccountInfo<'info>,
    /// The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
    /// Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
    #[account(init_if_needed, constraint = twap_update_account.write_authority == Pubkey::default() || twap_update_account.write_authority == write_authority.key() @ ReceiverError::WrongWriteAuthority , payer =payer, space = TwapUpdate::LEN)]
    pub twap_update_account: Account<'info, TwapUpdate>,
    pub system_program: Program<'info, System>,
    pub write_authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(params: PostUpdateAtomicParams)]
pub struct PostUpdateAtomic<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: We can't use AccountVariant::<GuardianSet> here because its owner is hardcoded as the "official" Wormhole program and we want to get the wormhole address from the config.
    /// Instead we do the same steps in deserialize_guardian_set_checked.
    #[account(
        owner = config.wormhole @ ReceiverError::WrongGuardianSetOwner)]
    pub guardian_set: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_ref()], bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [TREASURY_SEED.as_ref(), &[params.treasury_id]], bump)]
    /// CHECK: This is just a PDA controlled by the program. There is currently no way to withdraw funds from it.
    pub treasury: AccountInfo<'info>,
    /// The constraint is such that either the price_update_account is uninitialized or the write_authority is the write_authority.
    /// Pubkey::default() is the SystemProgram on Solana and it can't sign so it's impossible that price_update_account.write_authority == Pubkey::default() once the account is initialized
    #[account(init_if_needed, constraint = price_update_account.write_authority == Pubkey::default() || price_update_account.write_authority == write_authority.key() @ ReceiverError::WrongWriteAuthority, payer = payer, space = PriceUpdateV2::LEN)]
    pub price_update_account: Account<'info, PriceUpdateV2>,
    pub system_program: Program<'info, System>,
    pub write_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReclaimRent<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, close = payer, constraint = price_update_account.write_authority == payer.key() @ ReceiverError::WrongWriteAuthority)]
    pub price_update_account: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
pub struct ReclaimTwapRent<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, close = payer, constraint = twap_update_account.write_authority == payer.key() @ ReceiverError::WrongWriteAuthority)]
    pub twap_update_account: Account<'info, TwapUpdate>,
}

fn deserialize_guardian_set_checked(
    account_info: &AccountInfo<'_>,
    wormhole: &Pubkey,
) -> Result<AccountVariant<GuardianSet>> {
    let mut guardian_set_data: &[u8] = &account_info.try_borrow_data()?;
    let guardian_set = AccountVariant::<GuardianSet>::try_deserialize(&mut guardian_set_data)?;

    let expected_address = Pubkey::find_program_address(
        &[
            GuardianSet::SEED_PREFIX,
            guardian_set.inner().index.to_be_bytes().as_ref(),
        ],
        wormhole,
    )
    .0;

    require!(
        expected_address == *account_info.key,
        ReceiverError::InvalidGuardianSetPda
    );

    let timestamp = Clock::get().map(Into::into)?;
    require!(
        guardian_set.inner().is_active(&timestamp),
        ReceiverError::GuardianSetExpired
    );

    Ok(guardian_set)
}

struct VaaComponents {
    verification_level: VerificationLevel,
    emitter_address: [u8; 32],
    emitter_chain: u16,
}

#[allow(clippy::too_many_arguments)]
fn post_price_update_from_vaa<'info>(
    config: &Account<'info, Config>,
    payer: &Signer<'info>,
    write_authority: &Signer<'info>,
    treasury: &AccountInfo<'info>,
    price_update_account: &mut Account<'_, PriceUpdateV2>,
    vaa_components: &VaaComponents,
    vaa_payload: &[u8],
    price_update: &MerklePriceUpdate,
) -> Result<()> {
    pay_single_update_fee(config, treasury, payer)?;
    verify_vaa_data_source(config, vaa_components)?;
    let message = verify_merkle_proof(vaa_payload, price_update)?;
    match message {
        Message::PriceFeedMessage(price_feed_message) => {
            price_update_account.write_authority = write_authority.key();
            price_update_account.verification_level = vaa_components.verification_level;
            price_update_account.price_message = price_feed_message;
            price_update_account.posted_slot = Clock::get()?.slot;
        }
        Message::TwapMessage(_) | Message::PublisherStakeCapsMessage(_) => {
            return err!(ReceiverError::UnsupportedMessageType);
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn post_twap_update_from_vaas<'info>(
    config: &Account<'info, Config>,
    payer: &Signer<'info>,
    write_authority: &Signer<'info>,
    treasury: &AccountInfo<'info>,
    twap_update_account: &mut Account<'_, TwapUpdate>,
    start_vaa_components: &VaaComponents,
    end_vaa_components: &VaaComponents,
    start_vaa_payload: &[u8],
    end_vaa_payload: &[u8],
    start_price_update: &MerklePriceUpdate,
    end_price_update: &MerklePriceUpdate,
) -> Result<()> {
    pay_single_update_fee(config, treasury, payer)?;

    // Verify data sources for both VAAs
    for vaa_components in [start_vaa_components, end_vaa_components] {
        verify_vaa_data_source(config, vaa_components)?;
    }

    // Verify both merkle proofs and extract their messages
    let start_message = verify_merkle_proof(start_vaa_payload, start_price_update)?;
    let end_message = verify_merkle_proof(end_vaa_payload, end_price_update)?;

    // Calculate the TWAP and store it in the output account
    match (start_message, end_message) {
        (Message::TwapMessage(start_msg), Message::TwapMessage(end_msg)) => {
            // Verify that the feed ids and expos match, the start msg was published before the end msg,
            // and that they are the first messages within their slots
            validate_twap_messages(&start_msg, &end_msg)?;
            let (price, conf, down_slots_ratio) = calculate_twap(&start_msg, &end_msg)?;

            twap_update_account.write_authority = write_authority.key();
            twap_update_account.twap.feed_id = start_msg.feed_id;
            twap_update_account.twap.start_time = start_msg.publish_time;
            twap_update_account.twap.end_time = end_msg.publish_time;
            twap_update_account.twap.price = price;
            twap_update_account.twap.conf = conf;
            twap_update_account.twap.exponent = start_msg.exponent;
            twap_update_account.twap.down_slots_ratio = down_slots_ratio;
        }
        _ => {
            return err!(ReceiverError::UnsupportedMessageType);
        }
    }

    Ok(())
}

fn validate_twap_messages(start_msg: &TwapMessage, end_msg: &TwapMessage) -> Result<()> {
    // Validate feed ids match
    require!(
        start_msg.feed_id == end_msg.feed_id,
        ReceiverError::FeedIdMismatch
    );

    // Validate exponents match
    require!(
        start_msg.exponent == end_msg.exponent,
        ReceiverError::ExponentMismatch
    );

    // Validate slots
    require!(
        end_msg.publish_slot > start_msg.publish_slot,
        ReceiverError::InvalidTwapSlots
    );

    // Validate first messages in timestamp
    require!(
        start_msg.prev_publish_time < start_msg.publish_time,
        ReceiverError::InvalidTwapStartMessage
    );
    require!(
        end_msg.prev_publish_time < end_msg.publish_time,
        ReceiverError::InvalidTwapEndMessage
    );
    Ok(())
}

/// Calculate the TWAP for the window before start and end messages
/// Warning: The parameters aren't checked for validity, call `validate_twap_messages` before using.
fn calculate_twap(start_msg: &TwapMessage, end_msg: &TwapMessage) -> Result<(i64, u64, u32)> {
    let slot_diff = end_msg
        .publish_slot
        .checked_sub(start_msg.publish_slot)
        .ok_or(ReceiverError::TwapCalculationOverflow)?;

    let price_diff = end_msg
        .cumulative_price
        .checked_sub(start_msg.cumulative_price)
        .ok_or(ReceiverError::TwapCalculationOverflow)?;

    let conf_diff = end_msg
        .cumulative_conf
        .checked_sub(start_msg.cumulative_conf)
        .ok_or(ReceiverError::TwapCalculationOverflow)?;

    // Calculate time averaged price and confidence
    let price = i64::try_from(price_diff / i128::from(slot_diff))
        .map_err(|_| ReceiverError::TwapCalculationOverflow)?;
    let conf = u64::try_from(conf_diff / u128::from(slot_diff))
        .map_err(|_| ReceiverError::TwapCalculationOverflow)?;

    // Calculate down_slots_ratio as an integer between 0 and 1_000_000
    // A value of 1_000_000 means all slots were missed and 0 means no slots were missed.
    let total_down_slots = end_msg
        .num_down_slots
        .checked_sub(start_msg.num_down_slots)
        .ok_or(ReceiverError::TwapCalculationOverflow)?;
    let down_slots_ratio = total_down_slots
        .checked_mul(1_000_000)
        .ok_or(ReceiverError::TwapCalculationOverflow)?
        .checked_div(slot_diff)
        .ok_or(ReceiverError::TwapCalculationOverflow)?;
    // down_slots_ratio is a number in [0, 1_000_000], so we only need 32 unsigned bits
    let down_slots_ratio =
        u32::try_from(down_slots_ratio).map_err(|_| ReceiverError::TwapCalculationOverflow)?;
    Ok((price, conf, down_slots_ratio))
}

fn pay_single_update_fee<'info>(
    config: &Account<'info, Config>,
    treasury: &AccountInfo<'info>,
    payer: &Signer<'info>,
) -> Result<()> {
    // Handle treasury payment
    let amount_to_pay = if treasury.lamports() == 0 {
        Rent::get()?
            .minimum_balance(0)
            .max(config.single_update_fee_in_lamports)
    } else {
        config.single_update_fee_in_lamports
    };

    if payer.lamports()
        < Rent::get()?
            .minimum_balance(payer.data_len())
            .saturating_add(amount_to_pay)
    {
        return err!(ReceiverError::InsufficientFunds);
    }

    let transfer_instruction = system_instruction::transfer(payer.key, treasury.key, amount_to_pay);
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[payer.to_account_info(), treasury.to_account_info()],
    )?;
    Ok(())
}

/**
 * Borrowed from https://github.com/wormhole-foundation/wormhole/blob/wen/solana-rewrite/solana/programs/core-bridge/src/processor/parse_and_verify_vaa/verify_encoded_vaa_v1.rs#L121
 */
fn verify_guardian_signature(
    sig: &GuardianSetSig,
    guardian_pubkey: &[u8; 20],
    digest: &[u8],
) -> Result<()> {
    // Recover using `solana_program::secp256k1_recover`. Public key recovery costs 25k compute
    // units. And hashing this public key to recover the Ethereum public key costs about 13k.
    let recovered = {
        // Recover EC public key (64 bytes).
        let pubkey = secp256k1_recover(digest, sig.recovery_id(), &sig.rs())
            .map_err(|_| ReceiverError::InvalidSignature)?;

        // The Ethereum public key is the last 20 bytes of keccak hashed public key above.
        let hashed = keccak::hash(&pubkey.to_bytes());

        let mut eth_pubkey = [0; 20];
        sol_memcpy(&mut eth_pubkey, &hashed.0[12..], 20);

        eth_pubkey
    };

    // The recovered public key should agree with the Guardian's public key at this index.
    require!(
        recovered == *guardian_pubkey,
        ReceiverError::InvalidGuardianKeyRecovery
    );

    // Done.
    Ok(())
}

fn verify_merkle_proof(vaa_payload: &[u8], price_update: &MerklePriceUpdate) -> Result<Message> {
    let wormhole_message = WormholeMessage::try_from_bytes(vaa_payload)
        .map_err(|_| ReceiverError::InvalidWormholeMessage)?;
    let root: MerkleRoot<Keccak160> = MerkleRoot::new(match wormhole_message.payload {
        WormholePayload::Merkle(merkle_root) => merkle_root.root,
    });

    if !root.check(price_update.proof.clone(), price_update.message.as_ref()) {
        return err!(ReceiverError::InvalidPriceUpdate);
    }

    from_slice::<byteorder::BE, Message>(price_update.message.as_ref())
        .map_err(|_| error!(ReceiverError::DeserializeMessageFailed))
}
fn verify_vaa_data_source(
    config: &Account<'_, Config>,
    vaa_components: &VaaComponents,
) -> Result<()> {
    let valid_data_source = config.valid_data_sources.iter().any(|x| {
        *x == DataSource {
            chain: vaa_components.emitter_chain,
            emitter: Pubkey::from(vaa_components.emitter_address),
        }
    });
    if !valid_data_source {
        return err!(ReceiverError::InvalidDataSource);
    }
    Ok(())
}

#[cfg(test)]
/// Unit tests for the core TWAP calculation logic in `calculate_twap` and `validate_twap_messages`
/// This test module is here because these functions are private and can't
/// be imported into `tests/test_post_twap_updates`.
mod calculate_twap_unit_tests {
    use super::*;

    fn create_basic_twap_message(
        cumulative_price: i128,
        publish_time: i64,
        prev_publish_time: i64,
        publish_slot: u64,
    ) -> TwapMessage {
        TwapMessage {
            feed_id: [0; 32],
            cumulative_price,
            cumulative_conf: 100,
            num_down_slots: 0,
            exponent: 8,
            publish_time,
            prev_publish_time,
            publish_slot,
        }
    }

    #[test]
    fn test_valid_twap() {
        let start = create_basic_twap_message(100, 100, 90, 1000);
        let end = create_basic_twap_message(300, 200, 180, 1100);

        validate_twap_messages(&start, &end).unwrap();
        let price = calculate_twap(&start, &end).unwrap();
        assert_eq!(price.0, 2); // (300-100)/(1100-1000) = 2
    }

    #[test]
    fn test_invalid_slot_order() {
        let start = create_basic_twap_message(100, 100, 90, 1100);
        let end = create_basic_twap_message(300, 200, 180, 1000);

        let err = validate_twap_messages(&start, &end).unwrap_err();
        assert_eq!(err, ReceiverError::InvalidTwapSlots.into());
    }

    #[test]
    fn test_invalid_timestamps() {
        let start = create_basic_twap_message(100, 100, 110, 1000);
        let end = create_basic_twap_message(300, 200, 180, 1100);

        let err = validate_twap_messages(&start, &end).unwrap_err();
        assert_eq!(err, ReceiverError::InvalidTwapStartMessage.into());

        let start = create_basic_twap_message(100, 100, 90, 1000);
        let end = create_basic_twap_message(300, 200, 200, 1100);

        let err = validate_twap_messages(&start, &end).unwrap_err();
        assert_eq!(err, ReceiverError::InvalidTwapEndMessage.into());
    }

    #[test]
    fn test_overflow() {
        let start = create_basic_twap_message(i128::MIN, 100, 90, 1000);
        let end = create_basic_twap_message(i128::MAX, 200, 180, 1100);

        validate_twap_messages(&start, &end).unwrap();
        let err = calculate_twap(&start, &end).unwrap_err();
        assert_eq!(err, ReceiverError::TwapCalculationOverflow.into());
    }

    #[test]
    fn test_mismatched_feed_id() {
        let start = create_basic_twap_message(100, 100, 90, 1000);
        let mut end = create_basic_twap_message(300, 200, 180, 1100);
        end.feed_id = [1; 32];

        let err = validate_twap_messages(&start, &end).unwrap_err();
        assert_eq!(err, ReceiverError::FeedIdMismatch.into());
    }

    #[test]
    fn test_mismatched_exponent() {
        let start = create_basic_twap_message(100, 100, 90, 1000);
        let mut end = create_basic_twap_message(300, 200, 180, 1100);
        end.exponent = 9;

        let err = validate_twap_messages(&start, &end).unwrap_err();
        assert_eq!(err, ReceiverError::ExponentMismatch.into());
    }
}
