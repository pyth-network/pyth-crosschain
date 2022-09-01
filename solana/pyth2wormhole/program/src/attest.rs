use crate::{
    config::P2WConfigAccount,
    message::{
        P2WMessage,
        P2WMessageDrvData,
    },
};
use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use solana_program::{
    clock::Clock,
    instruction::{
        AccountMeta,
        Instruction,
    },
    program::{
        invoke,
        invoke_signed,
    },
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
};

use p2w_sdk::{
    BatchPriceAttestation,
    Identifier,
    P2WEmitter,
    PriceAttestation,
};

use bridge::{
    accounts::BridgeData,
    types::ConsistencyLevel,
    PostMessageData,
};

use solitaire::{
    invoke_seeded,
    trace,
    AccountState,
    Derive,
    ExecutionContext,
    FromAccounts,
    Info,
    Keyed,
    Mut,
    Peel,
    Result as SoliResult,
    Seeded,
    Signer,
    SolitaireError,
    Sysvar,
};

/// Important: must be manually maintained until native Solitaire
/// variable len vector support.
///
/// The number must reflect how many pyth product/price pairs are
/// expected in the Attest struct below. The constant itself is only
/// used in the on-chain config in order for attesters to learn the
/// correct value dynamically.
pub const P2W_MAX_BATCH_SIZE: u16 = 5;

#[derive(FromAccounts)]
pub struct Attest<'b> {
    // Payer also used for wormhole
    pub payer: Mut<Signer<Info<'b>>>,
    pub system_program: Info<'b>,
    pub config: P2WConfigAccount<'b, { AccountState::Initialized }>,

    // Hardcoded product/price pairs, bypassing Solitaire's variable-length limitations
    // Any change to the number of accounts must include an appropriate change to P2W_MAX_BATCH_SIZE
    pub pyth_product: Info<'b>,
    pub pyth_price: Info<'b>,

    pub pyth_product2: Option<Info<'b>>,
    pub pyth_price2: Option<Info<'b>>,

    pub pyth_product3: Option<Info<'b>>,
    pub pyth_price3: Option<Info<'b>>,

    pub pyth_product4: Option<Info<'b>>,
    pub pyth_price4: Option<Info<'b>>,

    pub pyth_product5: Option<Info<'b>>,
    pub pyth_price5: Option<Info<'b>>,

    // Did you read the comment near `pyth_product`?
    // pub pyth_product6: Option<Info<'b>>,
    // pub pyth_price6: Option<Info<'b>>,

    // pub pyth_product7: Option<Info<'b>>,
    // pub pyth_price7: Option<Info<'b>>,

    // pub pyth_product8: Option<Info<'b>>,
    // pub pyth_price8: Option<Info<'b>>,

    // pub pyth_product9: Option<Info<'b>>,
    // pub pyth_price9: Option<Info<'b>>,

    // pub pyth_product10: Option<Info<'b>>,
    // pub pyth_price10: Option<Info<'b>>,
    pub clock: Sysvar<'b, Clock>,

    /// Wormhole program address - must match the config value
    pub wh_prog: Info<'b>,

    // wormhole's post_message_unreliable accounts
    //
    // This contract makes no attempt to exhaustively validate
    // Wormhole's account inputs. Only the wormhole contract address
    // is validated (see above).
    /// Bridge config needed for fee calculation
    pub wh_bridge: Mut<Info<'b>>,

    /// Account to store the posted message
    pub wh_message: P2WMessage<'b>,

    /// Emitter of the VAA
    pub wh_emitter: P2WEmitter<'b>,

    /// Tracker for the emitter sequence
    pub wh_sequence: Mut<Info<'b>>,

    // We reuse our payer
    // pub wh_payer: Mut<Signer<Info<'b>>>,
    /// Account to collect tx fee
    pub wh_fee_collector: Mut<Info<'b>>,

    pub wh_rent: Sysvar<'b, Rent>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct AttestData {
    pub consistency_level: ConsistencyLevel,
    pub message_account_id: u64,
}

pub fn attest(ctx: &ExecutionContext, accs: &mut Attest, data: AttestData) -> SoliResult<()> {
    if !accs.config.is_active {
        // msg instead of trace makes sure we're not silent about this in prod
        solana_program::msg!("This attester program is disabled!");

        return Err(SolitaireError::Custom(4242));
    }

    let wh_msg_drv_data = P2WMessageDrvData {
        message_owner: accs.payer.key.clone(),
        id: data.message_account_id,
    };

    accs.config.verify_derivation(ctx.program_id, None)?;
    accs.wh_message
        .verify_derivation(ctx.program_id, &wh_msg_drv_data)?;

    if accs.config.wh_prog != *accs.wh_prog.key {
        trace!(&format!(
            "Wormhole program account mismatch (expected {:?}, got {:?})",
            accs.config.wh_prog, accs.wh_prog.key
        ));
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Make the specified prices iterable
    let price_pair_opts = [
        Some(&accs.pyth_product),
        Some(&accs.pyth_price),
        accs.pyth_product2.as_ref(),
        accs.pyth_price2.as_ref(),
        accs.pyth_product3.as_ref(),
        accs.pyth_price3.as_ref(),
        accs.pyth_product4.as_ref(),
        accs.pyth_price4.as_ref(),
        accs.pyth_product5.as_ref(),
        accs.pyth_price5.as_ref(),
        // Did you read the comment near `pyth_product`?
        // accs.pyth_product6.as_ref(),
        // accs.pyth_price6.as_ref(),
        // accs.pyth_product7.as_ref(),
        // accs.pyth_price7.as_ref(),
        // accs.pyth_product8.as_ref(),
        // accs.pyth_price8.as_ref(),
        // accs.pyth_product9.as_ref(),
        // accs.pyth_price9.as_ref(),
        // accs.pyth_product10.as_ref(),
        // accs.pyth_price10.as_ref(),
    ];

    let price_pairs: Vec<_> = price_pair_opts.into_iter().filter_map(|acc| *acc).collect();

    if price_pairs.len() % 2 != 0 {
        trace!(&format!(
            "Uneven product/price count detected: {}",
            price_pairs.len()
        ));
        return Err(ProgramError::InvalidAccountData.into());
    }

    trace!("{} Pyth symbols received", price_pairs.len() / 2);

    // Collect the validated symbols for batch serialization
    let mut attestations = Vec::with_capacity(price_pairs.len() / 2);

    for pair in price_pairs.as_slice().chunks_exact(2) {
        let product = pair[0];
        let price = pair[1];

        if accs.config.pyth_owner != *price.owner || accs.config.pyth_owner != *product.owner {
            trace!(&format!(
            "Pair {:?} - {:?}: pyth_owner pubkey mismatch (expected {:?}, got product owner {:?} and price owner {:?}",
		product, price,
            accs.config.pyth_owner, product.owner, price.owner
        ));
            return Err(SolitaireError::InvalidOwner(accs.pyth_price.owner.clone()).into());
        }

        let attestation = PriceAttestation::from_pyth_price_bytes(
            Identifier::new(product.key.to_bytes()),
            accs.clock.unix_timestamp,
            &*price.try_borrow_data()?,
        )
        .map_err(|e| {
            trace!(&e.to_string());
            ProgramError::InvalidAccountData
        })?;

        // The following check is crucial against poorly ordered
        // account inputs, e.g. [Some(prod1), Some(price1),
        // Some(prod2), None, None, Some(price)], interpreted by
        // earlier logic as [(prod1, price1), (prod2, price3)].
        //
        // Failing to verify the product/price relationship could lead
        // to mismatched product/price metadata, which would result in
        // a false attestation.
        if attestation.product_id.to_bytes() != product.key.to_bytes() {
            trace!(&format!(
                "Price's product_id does not match the pased account (points at {:?} instead)",
                attestation.product_id
            ));
            return Err(ProgramError::InvalidAccountData.into());
        }

        attestations.push(attestation);
    }

    let batch_attestation = BatchPriceAttestation {
        price_attestations: attestations,
    };

    trace!("Attestations successfully created");

    let bridge_config = BridgeData::try_from_slice(&accs.wh_bridge.try_borrow_mut_data()?)?.config;

    // Pay wormhole fee
    let transfer_ix = solana_program::system_instruction::transfer(
        accs.payer.key,
        accs.wh_fee_collector.info().key,
        bridge_config.fee,
    );
    solana_program::program::invoke(&transfer_ix, ctx.accounts)?;

    let payload = batch_attestation.serialize().map_err(|e| {
        trace!(&e.to_string());
        ProgramError::InvalidAccountData
    })?;

    // Adjust message account size if necessary.
    // NOTE: We assume that:
    // - the rent and size values are far away from
    // i64/u64/isize/usize overflow shenanigans (on the order of
    // single kilobytes).
    // - Pyth payload size change == Wormhole message size change (their metadata is constant-size)
    if accs.wh_message.is_initialized() && accs.wh_message.payload.len() != payload.len() {
        // NOTE: Payload =/= account size (account size includes
        // surrounding wormhole data structure, payload is just the
        // Pyth bytes).

        // This value will be negative if we need to shrink down
        let old_account_size = accs.wh_message.info().data_len();

        // How much payload size changes
        let payload_size_diff = payload.len() as isize - old_account_size as isize;

        // How big the overall account data becomes
        let new_account_size = (old_account_size as isize + payload_size_diff) as usize;

        // Adjust account size
        accs.wh_message.info().realloc(new_account_size, false)?;

        // Exempt balance for adjusted size
        let new_msg_account_balance = Rent::default().minimum_balance(new_account_size);

        // How the account balance changes
        let balance_diff =
            new_msg_account_balance as i64 - accs.wh_message.info().lamports() as i64;

        // How the diff affects payer balance
        let new_payer_balance = (accs.payer.info().lamports() as i64 - balance_diff) as u64;

        **accs.wh_message.info().lamports.borrow_mut() = new_msg_account_balance;
        **accs.payer.info().lamports.borrow_mut() = new_payer_balance;

        trace!("After message size/balance adjustment");
    }

    let ix = bridge::instructions::post_message_unreliable(
        *accs.wh_prog.info().key,
        *accs.payer.info().key,
        *accs.wh_emitter.info().key,
        *accs.wh_message.info().key,
        0,
        payload,
        data.consistency_level.clone(),
    )?;

    trace!(&format!(
        "Cross-call Seeds: {:?}",
        [
            // message seeds
            P2WMessage::seeds(&wh_msg_drv_data)
                .iter_mut()
                .map(|seed| seed.as_slice())
                .collect::<Vec<_>>()
                .as_slice(),
            // emitter seeds
            P2WEmitter::seeds(None)
                .iter_mut()
                .map(|seed| seed.as_slice())
                .collect::<Vec<_>>()
                .as_slice(),
        ]
    ));

    trace!("attest() finished, cross-calling wormhole");
    invoke_signed(
        &ix,
        ctx.accounts,
        [
            // message seeds
            P2WMessage::bumped_seeds(&wh_msg_drv_data, ctx.program_id)
                .iter_mut()
                .map(|seed| seed.as_slice())
                .collect::<Vec<_>>()
                .as_slice(),
            // emitter seeds
            P2WEmitter::bumped_seeds(None, ctx.program_id)
                .iter_mut()
                .map(|seed| seed.as_slice())
                .collect::<Vec<_>>()
                .as_slice(),
        ]
        .as_slice(),
    )?;

    Ok(())
}
