use {
    crate::{
        attestation_state::{
            AttestationState,
            AttestationStateMapPDA,
        },
        config::P2WConfigAccount,
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
        program::{
            invoke,
            invoke_signed,
        },
        program_error::ProgramError,
        rent::Rent,
        system_instruction,
        sysvar::Sysvar as SolanaSysvar,
    },
    solitaire::{
        trace,
        AccountState,
        CreationLamports,
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
/// The number must reflect how many pyth product/price pairs are
/// expected in the Attest struct below. The constant itself is only
/// used in the on-chain config in order for attesters to learn the
/// correct value dynamically.
pub const P2W_MAX_BATCH_SIZE: u16 = 5;

#[derive(FromAccounts)]
pub struct Attest<'b> {
    // Payer also used for wormhole
    pub payer:             Mut<Signer<Info<'b>>>,
    pub system_program:    Info<'b>,
    pub config:            P2WConfigAccount<'b, { AccountState::Initialized }>,
    pub attestation_state: Mut<AttestationStateMapPDA<'b>>,

    // Hardcoded product/price pairs, bypassing Solitaire's variable-length limitations
    // Any change to the number of accounts must include an appropriate change to P2W_MAX_BATCH_SIZE
    pub pyth_product: Info<'b>,
    pub pyth_price:   Info<'b>,

    pub pyth_product2: Option<Info<'b>>,
    pub pyth_price2:   Option<Info<'b>>,

    pub pyth_product3: Option<Info<'b>>,
    pub pyth_price3:   Option<Info<'b>>,

    pub pyth_product4: Option<Info<'b>>,
    pub pyth_price4:   Option<Info<'b>>,

    pub pyth_product5: Option<Info<'b>>,
    pub pyth_price5:   Option<Info<'b>>,

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
    pub consistency_level:  ConsistencyLevel,
    pub message_account_id: u64,
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

    let price_pairs: Vec<_> = price_pair_opts.iter().filter_map(|acc| *acc).collect();

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
            return Err(SolitaireError::InvalidOwner(*accs.pyth_price.owner));
        }
        let attestation_time = accs.clock.unix_timestamp;

        let price_data_ref = price.try_borrow_data()?;

        // Parse the upstream Pyth struct to extract current publish
        // time for payload construction
        let price_struct =
            pyth_sdk_solana::state::load_price_account(&price_data_ref).map_err(|e| {
                trace!(&e.to_string());
                ProgramError::InvalidAccountData
            })?;

        // prev_publish_time is picked if the price is not trading
        let last_trading_publish_time = match price_struct.agg.status {
            PriceStatus::Trading => price_struct.timestamp,
            _ => price_struct.prev_timestamp,
        };

        // Take a mut reference to this price's metadata
        let state_entry: &mut AttestationState = accs
            .attestation_state
            .entries
            .entry(*price.key)
            .or_insert(AttestationState {
                // Use the same value if no state
                // exists for the symbol, the new value _becomes_ the
                // last attested trading publish time
                last_attested_trading_publish_time: last_trading_publish_time,
            });

        let attestation = PriceAttestation::from_pyth_price_struct(
            Identifier::new(price.key.to_bytes()),
            attestation_time,
            state_entry.last_attested_trading_publish_time, // Used as last_attested_publish_time
            price_struct,
        );


        // update last_attested_publish_time with this price's
        // publish_time. Yes, it may be redundant for the entry() used
        // above in the rare first attestation edge case.
        state_entry.last_attested_trading_publish_time = last_trading_publish_time;

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

    // Serialize the state to calculate rent/account size adjustments
    let serialized = accs.attestation_state.1.try_to_vec()?;

    if accs.attestation_state.is_initialized() {
        accs.attestation_state
            .info()
            .realloc(serialized.len(), false)?;
        trace!("Attestation state resize OK");

        let target_rent = CreationLamports::Exempt.amount(serialized.len());
        let current_rent = accs.attestation_state.info().lamports();

        // Adjust rent, but only if there isn't enough
        if target_rent > current_rent {
            let transfer_amount = target_rent - current_rent;

            let transfer_ix = system_instruction::transfer(
                accs.payer.info().key,
                accs.attestation_state.info().key,
                transfer_amount,
            );

            invoke(&transfer_ix, ctx.accounts)?;
        }

        trace!("Attestation state rent transfer OK");
    } else {
        let seeds = accs
            .attestation_state
            .self_bumped_seeds(None, ctx.program_id);
        solitaire::create_account(
            ctx,
            accs.attestation_state.info(),
            accs.payer.key,
            solitaire::CreationLamports::Exempt,
            serialized.len(),
            ctx.program_id,
            solitaire::IsSigned::SignedWithSeeds(&[seeds
                .iter()
                .map(|s| s.as_slice())
                .collect::<Vec<_>>()
                .as_slice()]),
        )?;
        trace!("Attestation state init OK");
    }
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

    // NOTE: 2022-09-05
    //
    // This part is added to avoid rent exemption error that is introduced using
    // a wrong implementation in solitaire
    //
    // This is done after the cross-contract call to get the proper account sizes
    // and avoid breaking wormhole call.
    //
    // It can be removed once wormhole mitigates this problem and upgrades its contract

    // Checking the message account balance
    let wh_message_balance = accs.wh_message.info().lamports();
    let wh_message_rent_exempt = Rent::get()?.minimum_balance(accs.wh_message.info().data_len());

    if wh_message_balance < wh_message_rent_exempt {
        let required_deposit = wh_message_rent_exempt - wh_message_balance;

        let transfer_ix = system_instruction::transfer(
            accs.payer.key,
            accs.wh_message.info().key,
            required_deposit,
        );
        invoke(&transfer_ix, ctx.accounts)?
    }

    // Checking the sequence account balance
    let wh_sequence_balance = accs.wh_sequence.info().lamports();
    let wh_sequence_rent_exempt = Rent::get()?.minimum_balance(accs.wh_sequence.data_len());

    if wh_sequence_balance < wh_sequence_rent_exempt {
        let required_deposit = wh_sequence_rent_exempt - wh_sequence_balance;

        let transfer_ix =
            system_instruction::transfer(accs.payer.key, accs.wh_sequence.key, required_deposit);
        invoke(&transfer_ix, ctx.accounts)?
    }

    Ok(())
}
