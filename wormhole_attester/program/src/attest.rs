use {
    crate::{
        attestation_state::AttestationStatePDA,
        config::P2WConfigAccount,
        error::AttesterCustomError,
        message::{
            P2WMessage,
            P2WMessageDrvData,
        },
    },
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    bridge::{
        accounts::BridgeData,
        types::ConsistencyLevel,
    },
    pyth_sdk_solana::state::PriceStatus,
    pyth_wormhole_attester_sdk::{
        BatchPriceAttestation,
        Identifier,
        P2WEmitter,
        PriceAttestation,
    },
    solana_program::{
        clock::Clock,
        program::invoke_signed,
        program_error::ProgramError,
        rent::Rent,
    },
    solitaire::{
        trace,
        AccountState,
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
    },
};

/// Important: must be manually maintained until native Solitaire
/// variable len vector support.
///
/// The number must reflect how many pyth state/price pairs are
/// expected in the Attest struct below. The constant itself is only
/// used in the on-chain config in order for attesters to learn the
/// correct value dynamically.
pub const P2W_MAX_BATCH_SIZE: u16 = 5;

#[derive(FromAccounts)]
pub struct Attest<'b> {
    // Payer also used for wormhole
    pub payer:          Mut<Signer<Info<'b>>>,
    pub system_program: Info<'b>,
    pub config:         P2WConfigAccount<'b, { AccountState::Initialized }>,

    // Hardcoded state/price pairs, bypassing Solitaire's variable-length limitations
    // Any change to the number of accounts must include an appropriate change to P2W_MAX_BATCH_SIZE
    pub pyth_state: Mut<AttestationStatePDA<'b>>,
    pub pyth_price: Info<'b>,

    pub pyth_state2: Option<Mut<AttestationStatePDA<'b>>>,
    pub pyth_price2: Option<Info<'b>>,

    pub pyth_state3: Option<Mut<AttestationStatePDA<'b>>>,
    pub pyth_price3: Option<Info<'b>>,

    pub pyth_state4: Option<Mut<AttestationStatePDA<'b>>>,
    pub pyth_price4: Option<Info<'b>>,

    pub pyth_state5: Option<Mut<AttestationStatePDA<'b>>>,
    pub pyth_price5: Option<Info<'b>>,

    // Did you read the comment near `pyth_state`?
    // pub pyth_state6: Option<Mut<AttestationStatePDA<'b>>>,
    // pub pyth_price6: Option<Info<'b>>,

    // pub pyth_state7: Option<Mut<AttestationStatePDA<'b>>>,
    // pub pyth_price7: Option<Info<'b>>,

    // pub pyth_state8: Option<Mut<AttestationStatePDA<'b>>>,
    // pub pyth_price8: Option<Info<'b>>,

    // pub pyth_state9: Option<Mut<AttestationStatePDA<'b>>>,
    // pub pyth_price9: Option<Info<'b>>,

    // pub pyth_state10: Option<Mut<AttestationStatePDA<'b>>>,
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

    /// Account to store the posted message.
    /// This account is a PDA from the attestation contract
    /// which is owned by the wormhole core contract.
    pub wh_message: Mut<Info<'b>>,

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
    pub consistency_level:        ConsistencyLevel,
    pub message_account_id:       u64,
    /// Fail the transaction if the global attestation rate of all
    /// symbols in this batch is more frequent than the passed
    /// interval. This is checked using the attestation time stored in
    /// attestation state. This enables all of the clients to only
    /// contribute attestations if their desired interval is not
    /// already reached. If at least one symbol has been waiting
    /// longer than this interval, we attest the whole batch. 0
    /// effectively disables this feature.
    pub rate_limit_interval_secs: u32,
}

pub fn attest(ctx: &ExecutionContext, accs: &mut Attest, data: AttestData) -> SoliResult<()> {
    if !accs.config.is_active {
        // msg instead of trace makes sure we're not silent about this in prod
        solana_program::msg!("This attester program is disabled!");

        return Err(SolitaireError::Custom(4242));
    }

    accs.config.verify_derivation(ctx.program_id, None)?;

    if accs.config.wh_prog != *accs.wh_prog.key {
        trace!(&format!(
            "Wormhole program account mismatch (expected {:?}, got {:?})",
            accs.config.wh_prog, accs.wh_prog.key
        ));
        return Err(ProgramError::InvalidAccountData.into());
    }


    // Make the specified prices iterable
    let mut price_pair_opts = [
        (Some(&mut accs.pyth_state), Some(&accs.pyth_price)),
        (accs.pyth_state2.as_mut(), accs.pyth_price2.as_ref()),
        (accs.pyth_state3.as_mut(), accs.pyth_price3.as_ref()),
        (accs.pyth_state4.as_mut(), accs.pyth_price4.as_ref()),
        (accs.pyth_state5.as_mut(), accs.pyth_price5.as_ref()),
        // Did you read the comment near `pyth_state`?
        // (accs.pyth_state6.as_mut(), accs.pyth_price6.as_ref()),
        // (accs.pyth_state7.as_mut(), accs.pyth_price7.as_ref()),
        // (accs.pyth_state8.as_mut(), accs.pyth_price8.as_ref()),
        // (accs.pyth_state9.as_mut(), accs.pyth_price9.as_ref()),
        // (accs.pyth_state10.as_mut(), accs.pyth_price10.as_ref()),
    ];

    let price_pairs: Vec<(_, _)> = price_pair_opts
        .iter_mut()
        .filter_map(|pair| match pair {
            // Only use this pair if both accounts are Some
            (Some(state), Some(price)) => Some((state, price)),
            _other => None,
        })
        .collect();


    trace!("{} Pyth symbols received", price_pairs.len());

    // Collect the validated symbols here for batch serialization
    let mut attestations = Vec::with_capacity(price_pairs.len());

    let this_attestation_time = accs.clock.unix_timestamp;


    let mut over_rate_limit = true;
    for (state, price) in price_pairs.into_iter() {
        // Pyth must own the price
        if accs.config.pyth_owner != *price.owner {
            trace!(&format!(
                "Price {:?}: owner pubkey mismatch (expected pyth_owner {:?}, got unknown price owner {:?})",
                price, accs.config.pyth_owner, price.owner
            ));
            return Err(SolitaireError::InvalidOwner(*price.owner));
        }

        // State pubkey must reproduce from the price id
        let state_addr_from_price = AttestationStatePDA::key(price.key, ctx.program_id);
        if state_addr_from_price != *state.0 .0.info().key {
            trace!(&format!(
                "Price {:?}: pubkey does not produce the passed state account (expected {:?} from seeds, {:?} was passed)",
		price.key, state_addr_from_price, state.0.0.info().key
            ));
            return Err(ProgramError::InvalidAccountData.into());
        }

        let price_data_ref = price.try_borrow_data()?;

        // Parse the upstream Pyth struct to extract current publish
        // time for payload construction
        let price_struct =
            pyth_sdk_solana::state::load_price_account(&price_data_ref).map_err(|e| {
                trace!(&e.to_string());
                ProgramError::InvalidAccountData
            })?;

        // Retrieve and rotate last_attested_tradind_publish_time


        // Pick the value to store for the next attestation of this
        // symbol. We use the prev_ value if the symbol is not
        // currently being traded. The oracle marks the last known
        // trading timestamp with it.
        let new_last_attested_trading_publish_time = match price_struct.agg.status {
            PriceStatus::Trading => price_struct.timestamp,
            _ => price_struct.prev_timestamp,
        };

        // Retrieve the timestamp saved during the previous
        // attestation. Use the new_* value if no existind state is
        // present on-chain
        let current_last_attested_trading_publish_time = if state.0 .0.is_initialized() {
            // Use the existing on-chain value
            state.0 .0 .1.last_attested_trading_publish_time
        } else {
            // Fall back to the new value if the state is not initialized
            new_last_attested_trading_publish_time
        };

        // Build an attestatioin struct for this symbol using the just decided current value
        let attestation = PriceAttestation::from_pyth_price_struct(
            Identifier::new(price.key.to_bytes()),
            this_attestation_time,
            current_last_attested_trading_publish_time,
            price_struct,
        );

        // Save the new value for the next attestation of this symbol
        state.0 .0.last_attested_trading_publish_time = new_last_attested_trading_publish_time;

        // don't re-evaluate if at least one symbol was found to be under limit
        if over_rate_limit {
            // Evaluate rate limit - should be smaller than duration from last attestation
            if this_attestation_time - state.0 .0.last_attestation_time
                >= data.rate_limit_interval_secs as i64
            {
                over_rate_limit = false;
            } else {
                trace!("Price {:?}: over rate limit", price.key);
            }
        }

        // Update last attestation time
        state.0 .0.last_attestation_time = this_attestation_time;

        // handling of last_attested_trading_publish_time ends here

        if !state.0 .0.is_initialized() {
            // Serialize the state to learn account size for creation
            let state_serialized = state.0 .0 .1.try_to_vec()?;

            let seeds = state.self_bumped_seeds(price.key, ctx.program_id);
            solitaire::create_account(
                ctx,
                state.0 .0.info(),
                accs.payer.key,
                solitaire::CreationLamports::Exempt,
                state_serialized.len(),
                ctx.program_id,
                solitaire::IsSigned::SignedWithSeeds(&[seeds
                    .iter()
                    .map(|s| s.as_slice())
                    .collect::<Vec<_>>()
                    .as_slice()]),
            )?;
            trace!("Attestation state init OK");
        }


        attestations.push(attestation);
    }

    // Do not proceed if none of the symbols is under rate limit
    if over_rate_limit {
        trace!("All symbols over limit, bailing out");
        return Err(
            ProgramError::Custom(AttesterCustomError::AttestRateLimitReached as u32).into(),
        );
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

    let wh_msg_drv_data = P2WMessageDrvData {
        message_owner: *accs.payer.key,
        batch_size:    batch_attestation.price_attestations.len() as u16,
        id:            data.message_account_id,
    };

    if !P2WMessage::key(&wh_msg_drv_data, ctx.program_id).eq(accs.wh_message.info().key) {
        trace!(
            "Invalid seeds for wh message pubkey. Expected {} with given seeds {:?}, got {}",
            P2WMessage::key(&wh_msg_drv_data, ctx.program_id),
            P2WMessage::seeds(&wh_msg_drv_data)
                .iter_mut()
                .map(|seed| seed.as_slice())
                .collect::<Vec<_>>()
                .as_slice(),
            accs.wh_message.info().key
        );
        return Err(ProgramError::InvalidSeeds.into());
    }

    let ix = bridge::instructions::post_message_unreliable(
        *accs.wh_prog.info().key,
        *accs.payer.info().key,
        *accs.wh_emitter.info().key,
        *accs.wh_message.info().key,
        0,
        payload,
        data.consistency_level,
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
