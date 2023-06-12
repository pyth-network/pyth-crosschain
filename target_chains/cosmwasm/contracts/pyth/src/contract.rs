#[cfg(feature = "injective")]
use crate::injective::{
    create_relay_pyth_prices_msg,
    InjectiveMsgWrapper as MsgWrapper,
};
#[cfg(not(feature = "injective"))]
use cosmwasm_std::Empty as MsgWrapper;
#[cfg(feature = "osmosis")]
use osmosis_std::types::osmosis::txfees::v1beta1::TxfeesQuerier;
use {
    crate::{
        governance::{
            GovernanceAction::{
                AuthorizeGovernanceDataSourceTransfer,
                RequestGovernanceDataSourceTransfer,
                SetDataSources,
                SetFee,
                SetValidPeriod,
                UpgradeContract,
            },
            GovernanceInstruction,
            GovernanceModule,
        },
        msg::{
            InstantiateMsg,
            MigrateMsg,
        },
        state::{
            config,
            config_read,
            price_feed_bucket,
            price_feed_read_bucket,
            set_contract_version,
            ConfigInfo,
            PythDataSource,
        },
        wormhole::{
            ParsedVAA,
            WormholeQueryMsg,
        },
    },
    byteorder::BigEndian,
    cosmwasm_std::{
        coin,
        entry_point,
        to_binary,
        Addr,
        Binary,
        Coin,
        CosmosMsg,
        Deps,
        DepsMut,
        Env,
        MessageInfo,
        OverflowError,
        OverflowOperation,
        QueryRequest,
        Response,
        StdResult,
        WasmMsg,
        WasmQuery,
    },
    pyth_sdk_cw::{
        error::PythContractError,
        ExecuteMsg,
        Price,
        PriceFeed,
        PriceFeedResponse,
        PriceIdentifier,
        QueryMsg,
    },
    pyth_wormhole_attester_sdk::{
        BatchPriceAttestation,
        PriceAttestation,
        PriceStatus,
    },
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot,
        hashers::keccak256_160::Keccak160,
        messages::Message,
        wire::{
            from_slice,
            v1::{
                AccumulatorUpdateData,
                Proof,
                WormholeMessage,
                WormholePayload,
                PYTHNET_ACCUMULATOR_UPDATE_MAGIC,
            },
        },
    },
    std::{
        collections::HashSet,
        convert::TryFrom,
        iter::FromIterator,
        time::Duration,
    },
};

const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Migration code that runs once when the contract is upgraded. On upgrade, the migrate
/// function in the *new* code version is run, which allows the new code to update the on-chain
/// state before any of its other functions are invoked.
///
/// After the upgrade is complete, the code in this function can be deleted (and replaced with
/// different code for the next migration).
///
/// Most upgrades won't require any special migration logic. In those cases,
/// this function can safely be implemented as:
/// `Ok(Response::default())`
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    // a new contract version should be set everytime a contract is migrated
    set_contract_version(deps.storage, &String::from(CONTRACT_VERSION))?;
    Ok(Response::default().add_attribute("Contract Version", CONTRACT_VERSION))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // Save general wormhole and pyth info
    let state = ConfigInfo {
        wormhole_contract:          deps.api.addr_validate(msg.wormhole_contract.as_ref())?,
        data_sources:               msg.data_sources.iter().cloned().collect(),
        chain_id:                   msg.chain_id,
        governance_source:          msg.governance_source.clone(),
        governance_source_index:    msg.governance_source_index,
        governance_sequence_number: msg.governance_sequence_number,
        valid_time_period:          Duration::from_secs(msg.valid_time_period_secs as u64),
        fee:                        msg.fee,
    };
    config(deps.storage).save(&state)?;

    set_contract_version(deps.storage, &String::from(CONTRACT_VERSION))?;

    Ok(Response::default())
}

/// Verify that `data` represents an authentic Wormhole VAA.
///
/// *Warning* this function does not verify the emitter of the wormhole message; it only checks
/// that the wormhole signatures are valid. The caller is responsible for checking that the message
/// originates from the expected emitter.
pub fn parse_and_verify_vaa(deps: DepsMut, block_time: u64, data: &Binary) -> StdResult<ParsedVAA> {
    let cfg = config_read(deps.storage).load()?;
    let vaa: ParsedVAA = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: cfg.wormhole_contract.to_string(),
        msg:           to_binary(&WormholeQueryMsg::VerifyVAA {
            vaa: data.clone(),
            block_time,
        })?,
    }))?;
    Ok(vaa)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response<MsgWrapper>> {
    match msg {
        ExecuteMsg::UpdatePriceFeeds { data } => update_price_feeds(deps, env, info, &data),
        ExecuteMsg::ExecuteGovernanceInstruction { data } => {
            execute_governance_instruction(deps, env, info, &data)
        }
    }
}

#[cfg(not(feature = "osmosis"))]
fn is_fee_sufficient(deps: &Deps, info: MessageInfo, data: &[Binary]) -> StdResult<bool> {
    use cosmwasm_std::has_coins;

    let state = config_read(deps.storage).load()?;

    // For any chain other than osmosis there is only one base denom
    // If base denom is present in coins and has enough amount this will return true
    // or if the base fee is set to 0
    // else it will return false
    return Ok(state.fee.amount.u128() == 0
        || has_coins(info.funds.as_ref(), &get_update_fee(deps, data)?));
}

// it only checks for fee denoms other than the base denom
#[cfg(feature = "osmosis")]
fn is_allowed_tx_fees_denom(deps: &Deps, denom: &String) -> bool {
    // TxFeesQuerier uses stargate queries which we can't mock as of now.
    // The capability has not been implemented in `cosmwasm-std` yet.
    // Hence, we are hacking it with a feature flag to be able to write tests.
    // FIXME
    #[cfg(test)]
    if denom == "uion"
        || denom == "ibc/FF3065989E34457F342D4EFB8692406D49D4E2B5C70F725F127862E22CE6BDCD"
    {
        return true;
    }

    let querier = TxfeesQuerier::new(&deps.querier);
    match querier.denom_pool_id(denom.to_string()) {
        Ok(_) => true,
        Err(_) => false,
    }
}

// TODO: add tests for these
#[cfg(feature = "osmosis")]
fn is_fee_sufficient(deps: &Deps, info: MessageInfo, data: &[Binary]) -> StdResult<bool> {
    let state = config_read(deps.storage).load()?;

    // how to change this in future
    // for given coins verify they are allowed in txfee module
    // convert each of them to the base token that is 'uosmo'
    // combine all the converted token
    // check with `has_coins`

    // FIXME: should we accept fee for a single transaction in different tokens?
    let mut total_amount = 0u128;
    for coin in &info.funds {
        if coin.denom != state.fee.denom && !is_allowed_tx_fees_denom(deps, &coin.denom) {
            return Err(PythContractError::InvalidFeeDenom {
                denom: coin.denom.to_string(),
            })?;
        }
        total_amount = total_amount
            .checked_add(coin.amount.u128())
            .ok_or(OverflowError::new(
                OverflowOperation::Add,
                total_amount,
                coin.amount,
            ))?;
    }

    let base_denom_fee = get_update_fee(deps, data)?;

    // NOTE: the base fee denom right now is = denom: 'uosmo', amount: 1, which is almost negligible
    // It's not important to convert the price right now. For now
    // we are keeping the base fee amount same for each valid denom -> 1
    // but this logic will be updated to use spot price for different valid tokens in future
    Ok(base_denom_fee.amount.u128() <= total_amount)
}

/// Update the on-chain price feeds given the array of price update VAAs `data`.
/// Each price update VAA must be a valid Wormhole message and sent from an authorized emitter.
///
/// This method additionally requires the caller to pay a fee to the contract; the
/// magnitude of the fee depends on both the data and the current contract configuration.
fn update_price_feeds(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    data: &[Binary],
) -> StdResult<Response<MsgWrapper>> {
    let state = config_read(deps.storage).load()?;

    if !is_fee_sufficient(&deps.as_ref(), info, data)? {
        return Err(PythContractError::InsufficientFee)?;
    }

    let mut num_total_attestations: usize = 0;
    let mut total_new_feeds: Vec<PriceFeed> = vec![];

    for datum in data {
        let header = datum.get(0..4);
        let (num_attestations, new_feeds) =
            if header == Some(PYTHNET_ACCUMULATOR_UPDATE_MAGIC.as_slice()) {
                process_merkle(&mut deps, &env, datum)?
            } else {
                let vaa = parse_and_verify_vaa(deps.branch(), env.block.time.seconds(), datum)?;
                verify_vaa_from_data_source(&state, &vaa)?;

                let data = &vaa.payload;
                let batch_attestation = BatchPriceAttestation::deserialize(&data[..])
                    .map_err(|_| PythContractError::InvalidUpdatePayload)?;

                process_batch_attestation(&mut deps, &env, &batch_attestation)?
            };
        num_total_attestations += num_attestations;
        for new_feed in new_feeds {
            total_new_feeds.push(new_feed.to_owned());
        }
    }

    let num_total_new_attestations = total_new_feeds.len();

    let response = Response::new();

    #[cfg(feature = "injective")]
    {
        let inj_message = create_relay_pyth_prices_msg(env.contract.address, total_new_feeds);
        Ok(response
            .add_message(inj_message)
            .add_attribute("action", "update_price_feeds")
            .add_attribute("num_attestations", format!("{num_total_attestations}"))
            .add_attribute("num_updated", format!("{num_total_new_attestations}")))
    }

    #[cfg(not(feature = "injective"))]
    {
        Ok(response
            .add_attribute("action", "update_price_feeds")
            .add_attribute("num_attestations", format!("{num_total_attestations}"))
            .add_attribute("num_updated", format!("{num_total_new_attestations}")))
    }
}

/// Execute a governance instruction provided as the VAA `data`.
/// The VAA must come from an authorized governance emitter.
/// See [GovernanceInstruction] for descriptions of the supported operations.
fn execute_governance_instruction(
    mut deps: DepsMut,
    env: Env,
    _info: MessageInfo,
    data: &Binary,
) -> StdResult<Response<MsgWrapper>> {
    let vaa = parse_and_verify_vaa(deps.branch(), env.block.time.seconds(), data)?;
    let state = config_read(deps.storage).load()?;
    verify_vaa_from_governance_source(&state, &vaa)?;

    // store updates to the config as a result of this action in here.
    let mut updated_config: ConfigInfo = state.clone();

    // Governance messages must be applied in order. This check prevents replay attacks where
    // previous messages are re-applied.
    if vaa.sequence <= state.governance_sequence_number {
        return Err(PythContractError::OldGovernanceMessage)?;
    } else {
        updated_config.governance_sequence_number = vaa.sequence;
    }

    let data = &vaa.payload;
    let instruction = GovernanceInstruction::deserialize(&data[..])
        .map_err(|_| PythContractError::InvalidGovernancePayload)?;

    // Check that the instruction is intended for this chain.
    // chain_id = 0 means the instruction applies to all chains
    if instruction.target_chain_id != state.chain_id && instruction.target_chain_id != 0 {
        return Err(PythContractError::InvalidGovernancePayload)?;
    }

    // Check that the instruction is intended for this target chain contract (as opposed to
    // other Pyth contracts that may live on the same chain).
    if instruction.module != GovernanceModule::Target {
        return Err(PythContractError::InvalidGovernancePayload)?;
    }

    let response = match instruction.action {
        UpgradeContract { code_id } => {
            if instruction.target_chain_id == 0 {
                Err(PythContractError::InvalidGovernancePayload)?
            }
            upgrade_contract(&env.contract.address, code_id)?
        }
        AuthorizeGovernanceDataSourceTransfer { claim_vaa } => {
            let parsed_claim_vaa =
                parse_and_verify_vaa(deps.branch(), env.block.time.seconds(), &claim_vaa)?;
            transfer_governance(&mut updated_config, &state, &parsed_claim_vaa)?
        }
        SetDataSources { data_sources } => {
            updated_config.data_sources = HashSet::from_iter(data_sources.iter().cloned());

            Response::new()
                .add_attribute("action", "set_data_sources")
                .add_attribute("new_data_sources", format!("{data_sources:?}"))
        }
        SetFee { val, expo } => {
            let new_fee_amount: u128 = (val as u128)
                .checked_mul(
                    10_u128
                        .checked_pow(
                            u32::try_from(expo)
                                .map_err(|_| PythContractError::InvalidGovernancePayload)?,
                        )
                        .ok_or(PythContractError::InvalidGovernancePayload)?,
                )
                .ok_or(PythContractError::InvalidGovernancePayload)?;

            updated_config.fee = Coin::new(new_fee_amount, updated_config.fee.denom.clone());

            Response::new()
                .add_attribute("action", "set_fee")
                .add_attribute("new_fee", format!("{}", updated_config.fee))
        }
        SetValidPeriod { valid_seconds } => {
            updated_config.valid_time_period = Duration::from_secs(valid_seconds);

            Response::new()
                .add_attribute("action", "set_valid_period")
                .add_attribute("new_valid_seconds", format!("{valid_seconds}"))
        }
        RequestGovernanceDataSourceTransfer { .. } => {
            // RequestGovernanceDataSourceTransfer can only be part of the
            // AuthorizeGovernanceDataSourceTransfer message.
            Err(PythContractError::InvalidGovernancePayload)?
        }
    };

    config(deps.storage).save(&updated_config)?;

    Ok(response)
}

/// Transfers governance to the data source provided in `parsed_claim_vaa`.
/// This function updates the contract config in `next_config`; it is the caller's responsibility
/// to save this configuration in the on-chain storage.
fn transfer_governance(
    next_config: &mut ConfigInfo,
    current_config: &ConfigInfo,
    parsed_claim_vaa: &ParsedVAA,
) -> StdResult<Response<MsgWrapper>> {
    let claim_vaa_instruction =
        GovernanceInstruction::deserialize(parsed_claim_vaa.payload.as_slice())
            .map_err(|_| PythContractError::InvalidGovernancePayload)?;

    // Check that the requester is asking to govern this target chain contract.
    // chain_id == 0 means they're asking for governance of all target chain contracts.
    // (this check doesn't matter for security because we have already checked the information
    // in the authorization message.)
    if claim_vaa_instruction.target_chain_id != current_config.chain_id
        && claim_vaa_instruction.target_chain_id != 0
    {
        Err(PythContractError::InvalidGovernancePayload)?
    }

    match claim_vaa_instruction.action {
        RequestGovernanceDataSourceTransfer {
            governance_data_source_index,
        } => {
            if current_config.governance_source_index != governance_data_source_index - 1 {
                Err(PythContractError::InvalidGovernanceSourceIndex)?
            }

            next_config.governance_source_index = governance_data_source_index;
            let new_governance_source = PythDataSource {
                emitter:  Binary::from(parsed_claim_vaa.emitter_address.clone()),
                chain_id: parsed_claim_vaa.emitter_chain,
            };
            next_config.governance_source = new_governance_source;
            next_config.governance_sequence_number = parsed_claim_vaa.sequence;

            Ok(Response::new()
                .add_attribute("action", "authorize_governance_data_source_transfer")
                .add_attribute(
                    "new_governance_emitter_address",
                    format!("{:?}", parsed_claim_vaa.emitter_address),
                )
                .add_attribute(
                    "new_governance_emitter_chain",
                    format!("{}", parsed_claim_vaa.emitter_chain),
                )
                .add_attribute(
                    "new_governance_sequence_number",
                    format!("{}", parsed_claim_vaa.sequence),
                ))
        }
        _ => Err(PythContractError::InvalidGovernancePayload)?,
    }
}

/// Upgrades the contract at `address` to `new_code_id` (by sending a `Migrate` message). The
/// migration will fail unless this contract is the admin of the contract being upgraded.
/// (Typically, `address` is this contract's address, and the contract is its own admin.)
fn upgrade_contract(address: &Addr, new_code_id: u64) -> StdResult<Response<MsgWrapper>> {
    Ok(Response::new()
        .add_message(CosmosMsg::Wasm(WasmMsg::Migrate {
            contract_addr: address.to_string(),
            new_code_id,
            msg: to_binary(&MigrateMsg {})?,
        }))
        .add_attribute("action", "upgrade_contract")
        .add_attribute("new_code_id", format!("{new_code_id}")))
}

/// Check that `vaa` is from a valid data source (and hence is a legitimate price update message).
fn verify_vaa_from_data_source(state: &ConfigInfo, vaa: &ParsedVAA) -> StdResult<()> {
    let vaa_data_source = PythDataSource {
        emitter:  vaa.emitter_address.clone().into(),
        chain_id: vaa.emitter_chain,
    };
    if !state.data_sources.contains(&vaa_data_source) {
        return Err(PythContractError::InvalidUpdateEmitter)?;
    }
    Ok(())
}

/// Check that `vaa` is from a valid governance source (and hence is a legitimate governance instruction).
fn verify_vaa_from_governance_source(state: &ConfigInfo, vaa: &ParsedVAA) -> StdResult<()> {
    let vaa_data_source = PythDataSource {
        emitter:  vaa.emitter_address.clone().into(),
        chain_id: vaa.emitter_chain,
    };
    if state.governance_source != vaa_data_source {
        return Err(PythContractError::InvalidUpdateEmitter)?;
    }
    Ok(())
}

fn process_merkle(
    deps: &mut DepsMut,
    env: &Env,
    data: &[u8],
) -> StdResult<(usize, Vec<PriceFeed>)> {
    let update_data = AccumulatorUpdateData::try_from_slice(data)
        .map_err(|_| PythContractError::InvalidAccumulatorPayload)?;
    match update_data.proof {
        Proof::WormholeMerkle { vaa, updates } => {
            let parsed_vaa = parse_and_verify_vaa(
                deps.branch(),
                env.block.time.seconds(),
                &Binary::from(Vec::from(vaa)),
            )?;
            let state = config_read(deps.storage).load()?;
            verify_vaa_from_data_source(&state, &parsed_vaa)?;

            let msg = WormholeMessage::try_from_bytes(parsed_vaa.payload)
                .map_err(|_| PythContractError::InvalidWormholeMessage)?;

            let root: MerkleRoot<Keccak160> = MerkleRoot::new(match msg.payload {
                WormholePayload::Merkle(merkle_root) => merkle_root.root,
            });
            let update_len = updates.len();
            let mut new_feeds = vec![];
            for update in updates {
                let message_vec = Vec::from(update.message);
                if !root.check(update.proof, &message_vec) {
                    return Err(PythContractError::InvalidMerkleProof)?;
                }

                let msg = from_slice::<BigEndian, Message>(&message_vec)
                    .map_err(|_| PythContractError::InvalidAccumulatorMessage)?;

                match msg {
                    Message::PriceFeedMessage(price_feed_message) => {
                        let price_feed = PriceFeed::new(
                            PriceIdentifier::new(price_feed_message.id),
                            Price {
                                price:        price_feed_message.price,
                                conf:         price_feed_message.conf,
                                expo:         price_feed_message.exponent,
                                publish_time: price_feed_message.publish_time,
                            },
                            Price {
                                price:        price_feed_message.ema_price,
                                conf:         price_feed_message.ema_conf,
                                expo:         price_feed_message.exponent,
                                publish_time: price_feed_message.publish_time,
                            },
                        );

                        if update_price_feed_if_new(deps, env, price_feed)? {
                            new_feeds.push(price_feed);
                        }
                    }
                    _ => return Err(PythContractError::InvalidAccumulatorMessageType)?,
                }
            }
            Ok((update_len, new_feeds))
        }
    }
}

/// Update the on-chain storage for any new price updates provided in `batch_attestation`.
fn process_batch_attestation(
    deps: &mut DepsMut,
    env: &Env,
    batch_attestation: &BatchPriceAttestation,
) -> StdResult<(usize, Vec<PriceFeed>)> {
    let mut new_feeds = vec![];

    // Update prices
    for price_attestation in batch_attestation.price_attestations.iter() {
        let price_feed = create_price_feed_from_price_attestation(price_attestation);

        if update_price_feed_if_new(deps, env, price_feed)? {
            new_feeds.push(price_feed);
        }
    }

    Ok((batch_attestation.price_attestations.len(), new_feeds))
}

fn create_price_feed_from_price_attestation(price_attestation: &PriceAttestation) -> PriceFeed {
    match price_attestation.status {
        PriceStatus::Trading => PriceFeed::new(
            PriceIdentifier::new(price_attestation.price_id.to_bytes()),
            Price {
                price:        price_attestation.price,
                conf:         price_attestation.conf,
                expo:         price_attestation.expo,
                publish_time: price_attestation.publish_time,
            },
            Price {
                price:        price_attestation.ema_price,
                conf:         price_attestation.ema_conf,
                expo:         price_attestation.expo,
                publish_time: price_attestation.publish_time,
            },
        ),
        _ => PriceFeed::new(
            PriceIdentifier::new(price_attestation.price_id.to_bytes()),
            Price {
                price:        price_attestation.prev_price,
                conf:         price_attestation.prev_conf,
                expo:         price_attestation.expo,
                publish_time: price_attestation.prev_publish_time,
            },
            Price {
                price:        price_attestation.ema_price,
                conf:         price_attestation.ema_conf,
                expo:         price_attestation.expo,
                publish_time: price_attestation.prev_publish_time,
            },
        ),
    }
}

/// Returns true if the price_feed is newer than the stored one.
///
/// This function returns error only if there be issues in ser/de when it reads from the bucket.
/// Such an example would be upgrades which migration is not handled carefully so the binary stored
/// in the bucket won't be parsed.
fn update_price_feed_if_new(
    deps: &mut DepsMut,
    _env: &Env,
    new_price_feed: PriceFeed,
) -> StdResult<bool> {
    let mut is_new_price = true;
    price_feed_bucket(deps.storage).update(
        new_price_feed.id.as_ref(),
        |maybe_price_feed| -> StdResult<PriceFeed> {
            match maybe_price_feed {
                Some(price_feed) => {
                    // This check ensures that a price won't be updated with the same or older
                    // message. Publish_TIme is guaranteed increasing in
                    // solana
                    if price_feed.get_price_unchecked().publish_time
                        < new_price_feed.get_price_unchecked().publish_time
                    {
                        Ok(new_price_feed)
                    } else {
                        is_new_price = false;
                        Ok(price_feed)
                    }
                }
                None => Ok(new_price_feed),
            }
        },
    )?;
    Ok(is_new_price)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::PriceFeed { id } => to_binary(&query_price_feed(&deps, id.as_ref())?),
        #[cfg(feature = "osmosis")]
        QueryMsg::GetUpdateFeeForDenom { vaas, denom } => {
            to_binary(&get_update_fee_for_denom(&deps, &vaas, denom)?)
        }
        QueryMsg::GetUpdateFee { vaas } => to_binary(&get_update_fee(&deps, &vaas)?),
        QueryMsg::GetValidTimePeriod => to_binary(&get_valid_time_period(&deps)?),
    }
}

/// Get the most recent value of the price feed indicated by `feed_id`.
pub fn query_price_feed(deps: &Deps, feed_id: &[u8]) -> StdResult<PriceFeedResponse> {
    match price_feed_read_bucket(deps.storage).load(feed_id) {
        Ok(price_feed) => Ok(PriceFeedResponse { price_feed }),
        Err(_) => Err(PythContractError::PriceFeedNotFound)?,
    }
}

/// Get the fee that a caller must pay in order to submit a price update.
/// The fee depends on both the current contract configuration and the update data `vaas`.
/// The fee is in the denoms as stored in the current configuration
pub fn get_update_fee(deps: &Deps, vaas: &[Binary]) -> StdResult<Coin> {
    let config = config_read(deps.storage).load()?;

    Ok(coin(
        config
            .fee
            .amount
            .u128()
            .checked_mul(vaas.len() as u128)
            .ok_or(OverflowError::new(
                OverflowOperation::Mul,
                config.fee.amount,
                vaas.len(),
            ))?,
        config.fee.denom,
    ))
}

#[cfg(feature = "osmosis")]
/// Osmosis can support multiple tokens for transaction fees
/// This will return update fee for the given denom only if that denom is allowed in Osmosis's txFee module
/// Else it will throw error
pub fn get_update_fee_for_denom(deps: &Deps, vaas: &[Binary], denom: String) -> StdResult<Coin> {
    let config = config_read(deps.storage).load()?;

    // if the denom is not a base denom it should be an allowed one
    if denom != config.fee.denom && !is_allowed_tx_fees_denom(deps, &denom) {
        return Err(PythContractError::InvalidFeeDenom { denom })?;
    }

    // the base fee is set to -> denom = base denom of a chain, amount = 1
    // which is very minimal
    // for other valid denoms too we are using the base amount as 1
    // base amount is multiplied to number of vaas to get the total amount

    // this will be change later on to add custom logic using spot price for valid tokens
    Ok(coin(
        config
            .fee
            .amount
            .u128()
            .checked_mul(vaas.len() as u128)
            .ok_or(OverflowError::new(
                OverflowOperation::Mul,
                config.fee.amount,
                vaas.len(),
            ))?,
        denom,
    ))
}

pub fn get_valid_time_period(deps: &Deps) -> StdResult<Duration> {
    Ok(config_read(deps.storage).load()?.valid_time_period)
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::{
            governance::GovernanceModule::{
                Executor,
                Target,
            },
            state::get_contract_version,
        },
        cosmwasm_std::{
            coins,
            from_binary,
            testing::{
                mock_dependencies,
                mock_env,
                mock_info,
                MockApi,
                MockQuerier,
                MockStorage,
            },
            Addr,
            ContractResult,
            OwnedDeps,
            QuerierResult,
            StdError,
            SystemError,
            SystemResult,
            Uint128,
        },
        pyth_sdk::UnixTimestamp,
        pyth_sdk_cw::PriceIdentifier,
        pyth_wormhole_attester_sdk::PriceAttestation,
        pythnet_sdk::{
            accumulators::{
                merkle::MerkleTree,
                Accumulator,
            },
            messages::{
                PriceFeedMessage,
                TwapMessage,
            },
            wire::{
                to_vec,
                v1::{
                    MerklePriceUpdate,
                    WormholeMerkleRoot,
                },
                PrefixedVec,
            },
        },
        std::time::Duration,
    };

    /// Default valid time period for testing purposes.
    const VALID_TIME_PERIOD: Duration = Duration::from_secs(3 * 60);
    const WORMHOLE_ADDR: &str = "Wormhole";
    const EMITTER_CHAIN: u16 = 3;

    fn default_emitter_addr() -> Vec<u8> {
        vec![0, 1, 80]
    }

    fn default_config_info() -> ConfigInfo {
        ConfigInfo {
            wormhole_contract: Addr::unchecked(WORMHOLE_ADDR),
            data_sources: create_data_sources(default_emitter_addr(), EMITTER_CHAIN),
            ..create_zero_config_info()
        }
    }

    fn setup_test() -> (OwnedDeps<MockStorage, MockApi, MockQuerier>, Env) {
        let mut dependencies = mock_dependencies();
        dependencies.querier.update_wasm(handle_wasm_query);

        let mut config = config(dependencies.as_mut().storage);
        config
            .save(&ConfigInfo {
                valid_time_period: VALID_TIME_PERIOD,
                ..create_zero_config_info()
            })
            .unwrap();
        (dependencies, mock_env())
    }

    /// Mock handler for wormhole queries.
    /// Warning: the interface for the `VerifyVAA` action is slightly different than the real wormhole contract.
    /// In the mock, you pass in a binary-encoded `ParsedVAA`, and that exact vaa will be returned by wormhole.
    /// The real contract uses a different binary VAA format (see `ParsedVAA::deserialize`) which includes
    /// the guardian signatures.
    fn handle_wasm_query(wasm_query: &WasmQuery) -> QuerierResult {
        match wasm_query {
            WasmQuery::Smart { contract_addr, msg } if *contract_addr == WORMHOLE_ADDR => {
                let query_msg = from_binary::<WormholeQueryMsg>(msg);
                match query_msg {
                    Ok(WormholeQueryMsg::VerifyVAA { vaa, .. }) => {
                        SystemResult::Ok(ContractResult::Ok(vaa))
                    }
                    Err(_e) => SystemResult::Err(SystemError::InvalidRequest {
                        error:   "Invalid message".into(),
                        request: msg.clone(),
                    }),
                    _ => SystemResult::Err(SystemError::NoSuchContract {
                        addr: contract_addr.clone(),
                    }),
                }
            }
            WasmQuery::Smart { contract_addr, .. } => {
                SystemResult::Err(SystemError::NoSuchContract {
                    addr: contract_addr.clone(),
                })
            }
            WasmQuery::Raw { contract_addr, .. } => {
                SystemResult::Err(SystemError::NoSuchContract {
                    addr: contract_addr.clone(),
                })
            }
            WasmQuery::ContractInfo { contract_addr, .. } => {
                SystemResult::Err(SystemError::NoSuchContract {
                    addr: contract_addr.clone(),
                })
            }
            _ => unreachable!(),
        }
    }

    fn create_zero_vaa() -> ParsedVAA {
        ParsedVAA {
            version:            0,
            guardian_set_index: 0,
            timestamp:          0,
            nonce:              0,
            len_signers:        0,
            emitter_chain:      0,
            emitter_address:    vec![],
            sequence:           0,
            consistency_level:  0,
            payload:            vec![],
            hash:               vec![],
        }
    }

    fn create_price_update_msg(emitter_address: &[u8], emitter_chain: u16) -> Binary {
        let batch_attestation = BatchPriceAttestation {
            price_attestations: vec![PriceAttestation::default()],
        };

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = emitter_address.to_vec();
        vaa.emitter_chain = emitter_chain;
        vaa.payload = batch_attestation.serialize().unwrap();

        to_binary(&vaa).unwrap()
    }

    fn create_zero_config_info() -> ConfigInfo {
        ConfigInfo {
            wormhole_contract:          Addr::unchecked(String::default()),
            data_sources:               HashSet::default(),
            governance_source:          PythDataSource {
                emitter:  Binary(vec![]),
                chain_id: 0,
            },
            governance_source_index:    0,
            governance_sequence_number: 0,
            chain_id:                   0,
            valid_time_period:          Duration::new(0, 0),
            fee:                        Coin::new(0, ""),
        }
    }

    fn create_price_feed(expo: i32, publish_time: UnixTimestamp) -> PriceFeed {
        PriceFeed::new(
            PriceIdentifier::new([0u8; 32]),
            Price {
                expo,
                publish_time,
                ..Default::default()
            },
            Price {
                expo,
                ..Default::default()
            },
        )
    }

    fn create_data_sources(
        pyth_emitter: Vec<u8>,
        pyth_emitter_chain: u16,
    ) -> HashSet<PythDataSource> {
        HashSet::from([PythDataSource {
            emitter:  pyth_emitter.into(),
            chain_id: pyth_emitter_chain,
        }])
    }

    /// Updates the price feed with the given publish time stamp and
    /// returns the update status (true means updated, false means ignored)
    fn do_update_price_feed(deps: &mut DepsMut, env: &Env, price_feed: PriceFeed) -> bool {
        update_price_feed_if_new(deps, env, price_feed).unwrap()
    }

    fn apply_price_update(
        config_info: &ConfigInfo,
        emitter_address: &[u8],
        emitter_chain: u16,
        funds: &[Coin],
    ) -> StdResult<Response<MsgWrapper>> {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage).save(config_info).unwrap();

        let info = mock_info("123", funds);
        let msg = create_price_update_msg(emitter_address, emitter_chain);
        update_price_feeds(deps.as_mut(), env, info, &[msg])
    }

    #[test]
    fn test_instantiate() {
        let mut deps = mock_dependencies();

        let instantiate_msg = InstantiateMsg {
            // this is an example wormhole contract address in order to create a valid instantiate message
            wormhole_contract:          String::from("inj1xx3aupmgv3ce537c0yce8zzd3sz567syuyedpg"),
            data_sources:               Vec::new(),
            governance_source:          PythDataSource {
                emitter:  Binary(vec![]),
                chain_id: 0,
            },
            governance_source_index:    0,
            governance_sequence_number: 0,
            chain_id:                   0,
            valid_time_period_secs:     0,
            fee:                        Coin::new(0, ""),
        };

        let res = instantiate(
            deps.as_mut(),
            mock_env(),
            MessageInfo {
                sender: Addr::unchecked(""),
                funds:  Vec::new(),
            },
            instantiate_msg,
        );
        assert!(res.is_ok());

        // check config
        let config_result = config(&mut deps.storage).load();
        assert!(config_result.is_ok());

        // check contract version
        let contract_version = get_contract_version(&mut deps.storage);
        assert_eq!(contract_version, Ok(String::from(CONTRACT_VERSION)));
    }

    #[test]
    fn test_instantiate_invalid_wormhole_address() {
        let mut deps = mock_dependencies();

        let instantiate_msg = InstantiateMsg {
            wormhole_contract:          String::from(""),
            data_sources:               Vec::new(),
            governance_source:          PythDataSource {
                emitter:  Binary(vec![]),
                chain_id: 0,
            },
            governance_source_index:    0,
            governance_sequence_number: 0,
            chain_id:                   0,
            valid_time_period_secs:     0,
            fee:                        Coin::new(0, ""),
        };

        let res = instantiate(
            deps.as_mut(),
            mock_env(),
            MessageInfo {
                sender: Addr::unchecked(""),
                funds:  Vec::new(),
            },
            instantiate_msg,
        );
        assert!(res.is_err());
    }

    #[cfg(not(feature = "osmosis"))]
    #[test]
    fn test_is_fee_sufficient() {
        let mut config_info = default_config_info();
        config_info.fee = Coin::new(100, "foo");

        let (mut deps, _env) = setup_test();
        config(&mut deps.storage).save(&config_info).unwrap();

        let mut info = mock_info("123", coins(100, "foo").as_slice());
        let data = create_price_update_msg(default_emitter_addr().as_slice(), EMITTER_CHAIN);

        // sufficient fee -> true
        let result = is_fee_sufficient(&deps.as_ref(), info.clone(), &[data.clone()]);
        assert_eq!(result, Ok(true));

        // insufficient fee -> false
        info.funds = coins(50, "foo");
        let result = is_fee_sufficient(&deps.as_ref(), info.clone(), &[data.clone()]);
        assert_eq!(result, Ok(false));

        // insufficient fee -> false
        info.funds = coins(150, "bar");
        let result = is_fee_sufficient(&deps.as_ref(), info, &[data]);
        assert_eq!(result, Ok(false));
    }

    #[cfg(feature = "osmosis")]
    #[test]
    fn test_is_fee_sufficient() {
        // setup config with base fee
        let base_denom = "foo";
        let base_amount = 100;
        let mut config_info = default_config_info();
        config_info.fee = Coin::new(base_amount, base_denom);
        let (mut deps, _env) = setup_test();
        config(&mut deps.storage).save(&config_info).unwrap();

        // a dummy price data
        let data = create_price_update_msg(default_emitter_addr().as_slice(), EMITTER_CHAIN);

        // sufficient fee in base denom -> true
        let info = mock_info("123", coins(base_amount, base_denom).as_slice());
        let result = is_fee_sufficient(&deps.as_ref(), info.clone(), &[data.clone()]);
        assert_eq!(result, Ok(true));

        // insufficient fee in base denom -> false
        let info = mock_info("123", coins(50, base_denom).as_slice());
        let result = is_fee_sufficient(&deps.as_ref(), info, &[data.clone()]);
        assert_eq!(result, Ok(false));

        // valid denoms are 'uion' or 'ibc/FF3065989E34457F342D4EFB8692406D49D4E2B5C70F725F127862E22CE6BDCD'
        // a valid denom other than base denom with sufficient fee
        let info = mock_info("123", coins(100, "uion").as_slice());
        let result = is_fee_sufficient(&deps.as_ref(), info, &[data.clone()]);
        assert_eq!(result, Ok(true));

        // insufficient fee in valid denom -> false
        let info = mock_info("123", coins(50, "uion").as_slice());
        let result = is_fee_sufficient(&deps.as_ref(), info, &[data.clone()]);
        assert_eq!(result, Ok(false));

        // an invalid denom -> Err invalid fee denom
        let info = mock_info("123", coins(100, "invalid_denom").as_slice());
        let result = is_fee_sufficient(&deps.as_ref(), info, &[data.clone()]);
        assert_eq!(
            result,
            Err(PythContractError::InvalidFeeDenom {
                denom: "invalid_denom".to_string(),
            }
            .into())
        );
    }

    #[test]
    fn test_process_batch_attestation_empty_array() {
        let (mut deps, env) = setup_test();
        let attestations = BatchPriceAttestation {
            price_attestations: vec![],
        };
        let (num_attestations, new_attestations) =
            process_batch_attestation(&mut deps.as_mut(), &env, &attestations).unwrap();

        assert_eq!(num_attestations, 0);
        assert_eq!(new_attestations.len(), 0);
    }

    fn create_dummy_price_feed_message(value: i64) -> Message {
        let mut dummy_id = [0; 32];
        dummy_id[0] = value as u8;
        let msg = PriceFeedMessage {
            id:                dummy_id,
            price:             value,
            conf:              value as u64,
            exponent:          value as i32,
            publish_time:      value,
            prev_publish_time: value,
            ema_price:         value,
            ema_conf:          value as u64,
        };
        Message::PriceFeedMessage(msg)
    }

    fn create_accumulator_message_from_updates(
        price_updates: Vec<MerklePriceUpdate>,
        tree: MerkleTree<Keccak160>,
        corrupt_wormhole_message: bool,
    ) -> Binary {
        let mut root_hash = [0u8; 20];
        root_hash.copy_from_slice(&to_vec::<_, BigEndian>(&tree.root).unwrap()[..20]);
        let wormhole_message = WormholeMessage::new(WormholePayload::Merkle(WormholeMerkleRoot {
            slot:      0,
            ring_size: 0,
            root:      root_hash,
        }));

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = default_emitter_addr().to_vec();
        vaa.emitter_chain = EMITTER_CHAIN;
        vaa.payload = to_vec::<_, BigEndian>(&wormhole_message).unwrap();
        if corrupt_wormhole_message {
            vaa.payload[0] = 0;
        }

        let vaa_binary = to_binary(&vaa).unwrap();
        let accumulator_update_data = AccumulatorUpdateData::new(Proof::WormholeMerkle {
            vaa:     PrefixedVec::from(vaa_binary.to_vec()),
            updates: price_updates,
        });

        Binary::from(to_vec::<_, BigEndian>(&accumulator_update_data).unwrap())
    }

    fn create_accumulator_message(
        all_feeds: &[Message],
        updates: &[Message],
        corrupt_wormhole_message: bool,
    ) -> Binary {
        let all_feeds_bytes: Vec<_> = all_feeds
            .iter()
            .map(|f| to_vec::<_, BigEndian>(f).unwrap())
            .collect();
        let all_feeds_bytes_refs: Vec<_> = all_feeds_bytes.iter().map(|f| f.as_ref()).collect();
        let tree = MerkleTree::<Keccak160>::new(all_feeds_bytes_refs.as_slice()).unwrap();
        let mut price_updates: Vec<MerklePriceUpdate> = vec![];
        for update in updates {
            let proof = tree
                .prove(&to_vec::<_, BigEndian>(update).unwrap())
                .unwrap();
            price_updates.push(MerklePriceUpdate {
                message: PrefixedVec::from(to_vec::<_, BigEndian>(update).unwrap()),
                proof,
            });
        }
        create_accumulator_message_from_updates(price_updates, tree, corrupt_wormhole_message)
    }


    fn check_price_match(deps: &OwnedDeps<MockStorage, MockApi, MockQuerier>, msg: &Message) {
        match msg {
            Message::PriceFeedMessage(feed_msg) => {
                let feed = price_feed_read_bucket(&deps.storage)
                    .load(&feed_msg.id)
                    .unwrap();
                let price = feed.get_price_unchecked();
                let ema_price = feed.get_ema_price_unchecked();
                assert_eq!(price.price, feed_msg.price);
                assert_eq!(price.conf, feed_msg.conf);
                assert_eq!(price.expo, feed_msg.exponent);
                assert_eq!(price.publish_time, feed_msg.publish_time);

                assert_eq!(ema_price.price, feed_msg.ema_price);
                assert_eq!(ema_price.conf, feed_msg.ema_conf);
                assert_eq!(ema_price.expo, feed_msg.exponent);
                assert_eq!(ema_price.publish_time, feed_msg.publish_time);
            }
            _ => assert!(false, "invalid message type"),
        };
    }

    #[test]
    fn test_accumulator_message_single_update() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let feed2 = create_dummy_price_feed_message(200);
        let msg = create_accumulator_message(&[feed1, feed2], &[feed1], false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);
        assert!(result.is_ok());
        check_price_match(&deps, &feed1);
    }

    #[test]
    fn test_accumulator_message_multi_update_many_feeds() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();
        let mut all_feeds: Vec<Message> = vec![];
        for i in 0..10000 {
            all_feeds.push(create_dummy_price_feed_message(i));
        }
        let msg = create_accumulator_message(&all_feeds, &all_feeds[100..110], false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);
        assert!(result.is_ok());
        for i in 100..110 {
            check_price_match(&deps, &all_feeds[i]);
        }
    }

    fn to_price_feed(msg: &mut Message) -> &mut PriceFeedMessage {
        match msg {
            Message::PriceFeedMessage(ref mut price_feed) => price_feed,
            _ => {
                panic!("unexpected message type");
            }
        }
    }

    #[test]
    fn test_accumulator_multi_message_multi_update() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();
        let mut feed1 = create_dummy_price_feed_message(100);
        let mut feed2 = create_dummy_price_feed_message(200);
        let mut feed3 = create_dummy_price_feed_message(300);
        let msg = create_accumulator_message(&[feed1, feed2, feed3], &[feed1, feed2, feed3], false);
        to_price_feed(&mut feed1).publish_time += 1;
        to_price_feed(&mut feed2).publish_time += 1;
        to_price_feed(&mut feed3).publish_time += 1;
        to_price_feed(&mut feed1).price *= 2;
        to_price_feed(&mut feed2).price *= 2;
        to_price_feed(&mut feed3).price *= 2;
        let msg2 =
            create_accumulator_message(&[feed1, feed2, feed3], &[feed1, feed2, feed3], false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg, msg2]);

        assert!(result.is_ok());
        check_price_match(&deps, &feed1);
        check_price_match(&deps, &feed2);
        check_price_match(&deps, &feed3);
    }

    #[test]
    fn test_accumulator_multi_update_out_of_order() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();
        let feed1 = create_dummy_price_feed_message(100);
        let mut feed2 = create_dummy_price_feed_message(100);
        let feed3 = create_dummy_price_feed_message(300);
        to_price_feed(&mut feed2).publish_time -= 1;
        to_price_feed(&mut feed2).price *= 2;
        let msg = create_accumulator_message(&[feed1, feed2, feed3], &[feed1, feed2, feed3], false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);

        assert!(result.is_ok());
        check_price_match(&deps, &feed1);
        check_price_match(&deps, &feed3);
    }

    #[test]
    fn test_accumulator_multi_message_multi_update_out_of_order() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();
        let feed1 = create_dummy_price_feed_message(100);
        let mut feed2 = create_dummy_price_feed_message(100);
        let feed3 = create_dummy_price_feed_message(300);
        to_price_feed(&mut feed2).publish_time -= 1;
        to_price_feed(&mut feed2).price *= 2;
        let msg = create_accumulator_message(&[feed1, feed2, feed3], &[feed1, feed3], false);

        let msg2 = create_accumulator_message(&[feed1, feed2, feed3], &[feed2, feed3], false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg, msg2]);

        assert!(result.is_ok());
        check_price_match(&deps, &feed1);
        check_price_match(&deps, &feed3);
    }

    #[test]
    fn test_invalid_accumulator_update() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let mut msg = create_accumulator_message(&[feed1], &[feed1], false);
        msg.0[5] = 3;
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            StdError::from(PythContractError::InvalidAccumulatorPayload)
        );
    }

    #[test]
    fn test_invalid_wormhole_message() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let msg = create_accumulator_message(&[feed1], &[feed1], true);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            StdError::from(PythContractError::InvalidWormholeMessage)
        );
    }

    #[test]
    fn test_invalid_accumulator_message_type() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();
        let feed1 = Message::TwapMessage(TwapMessage {
            id:                [0; 32],
            cumulative_price:  0,
            cumulative_conf:   0,
            num_down_slots:    0,
            exponent:          0,
            publish_time:      0,
            prev_publish_time: 0,
            publish_slot:      0,
        });
        let msg = create_accumulator_message(&[feed1], &[feed1], false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            StdError::from(PythContractError::InvalidAccumulatorMessageType)
        );
    }

    #[test]
    fn test_invalid_proof() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let feed2 = create_dummy_price_feed_message(200);
        let feed1_bytes = to_vec::<_, BigEndian>(&feed1).unwrap();
        let feed2_bytes = to_vec::<_, BigEndian>(&feed2).unwrap();
        let tree = MerkleTree::<Keccak160>::new(&[feed1_bytes.as_slice()]).unwrap();
        let mut price_updates: Vec<MerklePriceUpdate> = vec![];

        let proof1 = tree.prove(&feed1_bytes).unwrap();
        price_updates.push(MerklePriceUpdate {
            // proof1 is valid for feed1, but not feed2
            message: PrefixedVec::from(feed2_bytes),
            proof:   proof1,
        });
        let msg = create_accumulator_message_from_updates(price_updates, tree, false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            StdError::from(PythContractError::InvalidMerkleProof)
        );
    }

    #[test]
    fn test_invalid_message() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let mut feed1_bytes = to_vec::<_, BigEndian>(&feed1).unwrap();
        feed1_bytes.pop();
        let tree = MerkleTree::<Keccak160>::new(&[feed1_bytes.as_slice()]).unwrap();
        let mut price_updates: Vec<MerklePriceUpdate> = vec![];

        let proof1 = tree.prove(&feed1_bytes).unwrap();
        price_updates.push(MerklePriceUpdate {
            message: PrefixedVec::from(feed1_bytes),
            proof:   proof1,
        });
        let msg = create_accumulator_message_from_updates(price_updates, tree, false);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg]);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            StdError::from(PythContractError::InvalidAccumulatorMessage)
        );
    }

    #[test]
    fn test_create_price_feed_from_price_attestation_status_trading() {
        let price_attestation = PriceAttestation {
            price_id: pyth_wormhole_attester_sdk::Identifier::new([0u8; 32]),
            price: 100,
            conf: 100,
            expo: 100,
            ema_price: 100,
            ema_conf: 100,
            status: PriceStatus::Trading,
            attestation_time: 100,
            publish_time: 100,
            prev_publish_time: 99,
            prev_price: 99,
            prev_conf: 99,
            ..Default::default()
        };

        let price_feed = create_price_feed_from_price_attestation(&price_attestation);
        let price = price_feed.get_price_unchecked();
        let ema_price = price_feed.get_ema_price_unchecked();

        // for price
        assert_eq!(price.price, 100);
        assert_eq!(price.conf, 100);
        assert_eq!(price.expo, 100);
        assert_eq!(price.publish_time, 100);

        // for ema
        assert_eq!(ema_price.price, 100);
        assert_eq!(ema_price.conf, 100);
        assert_eq!(ema_price.expo, 100);
        assert_eq!(ema_price.publish_time, 100);
    }

    #[test]
    fn test_create_price_feed_from_price_attestation_status_unknown() {
        test_create_price_feed_from_price_attestation_not_trading(PriceStatus::Unknown)
    }

    #[test]
    fn test_create_price_feed_from_price_attestation_status_halted() {
        test_create_price_feed_from_price_attestation_not_trading(PriceStatus::Halted)
    }

    #[test]
    fn test_create_price_feed_from_price_attestation_status_auction() {
        test_create_price_feed_from_price_attestation_not_trading(PriceStatus::Auction)
    }

    fn test_create_price_feed_from_price_attestation_not_trading(status: PriceStatus) {
        let price_attestation = PriceAttestation {
            price_id: pyth_wormhole_attester_sdk::Identifier::new([0u8; 32]),
            price: 100,
            conf: 100,
            expo: 100,
            ema_price: 100,
            ema_conf: 100,
            status,
            attestation_time: 100,
            publish_time: 100,
            prev_publish_time: 99,
            prev_price: 99,
            prev_conf: 99,
            ..Default::default()
        };

        let price_feed = create_price_feed_from_price_attestation(&price_attestation);

        let price = price_feed.get_price_unchecked();
        let ema_price = price_feed.get_ema_price_unchecked();

        // for price
        assert_eq!(price.price, 99);
        assert_eq!(price.conf, 99);
        assert_eq!(price.expo, 100);
        assert_eq!(price.publish_time, 99);

        // for ema
        assert_eq!(ema_price.price, 100);
        assert_eq!(ema_price.conf, 100);
        assert_eq!(ema_price.expo, 100);
        assert_eq!(ema_price.publish_time, 99);
    }

    // this is testing the function process_batch_attestation
    // process_batch_attestation is calling update_price_feed_if_new
    // changes to update_price_feed_if_new might cause this test
    #[test]
    fn test_process_batch_attestation_status_not_trading() {
        let (mut deps, env) = setup_test();

        let price_attestation = PriceAttestation {
            price_id: pyth_wormhole_attester_sdk::Identifier::new([0u8; 32]),
            price: 100,
            conf: 100,
            expo: 100,
            ema_price: 100,
            ema_conf: 100,
            status: PriceStatus::Auction,
            attestation_time: 100,
            publish_time: 100,
            prev_publish_time: 99,
            prev_price: 99,
            prev_conf: 99,
            ..Default::default()
        };

        let attestations = BatchPriceAttestation {
            price_attestations: vec![price_attestation],
        };
        let (num_attestations, new_attestations) =
            process_batch_attestation(&mut deps.as_mut(), &env, &attestations).unwrap();

        let stored_price_feed = price_feed_read_bucket(&deps.storage)
            .load(&[0u8; 32])
            .unwrap();
        let price = stored_price_feed.get_price_unchecked();
        let ema_price = stored_price_feed.get_ema_price_unchecked();

        assert_eq!(num_attestations, 1);
        assert_eq!(new_attestations.len(), 1);

        // for price
        assert_eq!(price.price, 99);
        assert_eq!(price.conf, 99);
        assert_eq!(price.expo, 100);
        assert_eq!(price.publish_time, 99);

        // for ema
        assert_eq!(ema_price.price, 100);
        assert_eq!(ema_price.conf, 100);
        assert_eq!(ema_price.expo, 100);
        assert_eq!(ema_price.publish_time, 99);
    }

    // this is testing the function process_batch_attestation
    // process_batch_attestation is calling update_price_feed_if_new
    // changes to update_price_feed_if_new might affect this test
    #[test]
    fn test_process_batch_attestation_status_trading() {
        let (mut deps, env) = setup_test();

        let price_attestation = PriceAttestation {
            price_id: pyth_wormhole_attester_sdk::Identifier::new([0u8; 32]),
            price: 100,
            conf: 100,
            expo: 100,
            ema_price: 100,
            ema_conf: 100,
            status: PriceStatus::Trading,
            attestation_time: 100,
            publish_time: 100,
            prev_publish_time: 99,
            prev_price: 99,
            prev_conf: 99,
            ..Default::default()
        };

        let attestations = BatchPriceAttestation {
            price_attestations: vec![price_attestation],
        };
        let (num_attestations, new_attestations) =
            process_batch_attestation(&mut deps.as_mut(), &env, &attestations).unwrap();

        let stored_price_feed = price_feed_read_bucket(&deps.storage)
            .load(&[0u8; 32])
            .unwrap();
        let price = stored_price_feed.get_price_unchecked();
        let ema_price = stored_price_feed.get_ema_price_unchecked();

        assert_eq!(num_attestations, 1);
        assert_eq!(new_attestations.len(), 1);

        // for price
        assert_eq!(price.price, 100);
        assert_eq!(price.conf, 100);
        assert_eq!(price.expo, 100);
        assert_eq!(price.publish_time, 100);

        // for ema
        assert_eq!(ema_price.price, 100);
        assert_eq!(ema_price.conf, 100);
        assert_eq!(ema_price.expo, 100);
        assert_eq!(ema_price.publish_time, 100);
    }

    #[test]
    fn test_verify_vaa_sender_ok() {
        let result = apply_price_update(
            &default_config_info(),
            default_emitter_addr().as_slice(),
            EMITTER_CHAIN,
            &[],
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_vaa_sender_fail_wrong_emitter_address() {
        let emitter_address = [17, 23, 14];
        let result = apply_price_update(
            &default_config_info(),
            emitter_address.as_slice(),
            EMITTER_CHAIN,
            &[],
        );
        assert_eq!(result, Err(PythContractError::InvalidUpdateEmitter.into()));
    }

    #[test]
    fn test_verify_vaa_sender_fail_wrong_emitter_chain() {
        let result = apply_price_update(
            &default_config_info(),
            default_emitter_addr().as_slice(),
            EMITTER_CHAIN + 1,
            &[],
        );
        assert_eq!(result, Err(PythContractError::InvalidUpdateEmitter.into()));
    }

    #[test]
    fn test_update_price_feed_if_new_first_price_ok() {
        let (mut deps, env) = setup_test();
        let price_feed = create_price_feed(3, 100);

        let changed = do_update_price_feed(&mut deps.as_mut(), &env, price_feed);
        assert!(changed);

        let stored_price_feed = price_feed_bucket(&mut deps.storage)
            .load(price_feed.id.as_ref())
            .unwrap();

        assert_eq!(stored_price_feed, price_feed);
    }

    #[test]
    fn test_update_price_feed_if_new_ignore_duplicate_time() {
        let (mut deps, env) = setup_test();

        let first_price_feed = create_price_feed(3, 100);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, first_price_feed);
        assert!(changed);

        let second_price_feed = create_price_feed(4, 100);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, second_price_feed);
        assert!(!changed);

        let stored_price_feed = price_feed_bucket(&mut deps.storage)
            .load(first_price_feed.id.as_ref())
            .unwrap();
        assert_eq!(stored_price_feed, first_price_feed);
    }

    #[test]
    fn test_update_price_feed_if_new_ignore_older() {
        let (mut deps, env) = setup_test();

        let first_price_feed = create_price_feed(3, 100);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, first_price_feed);
        assert!(changed);

        let second_price_feed = create_price_feed(4, 90);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, second_price_feed);
        assert!(!changed);

        let stored_price_feed = price_feed_bucket(&mut deps.storage)
            .load(first_price_feed.id.as_ref())
            .unwrap();
        assert_eq!(stored_price_feed, first_price_feed);
    }

    #[test]
    fn test_update_price_feed_if_new_accept_newer() {
        let (mut deps, env) = setup_test();

        let first_price_feed = create_price_feed(3, 100);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, first_price_feed);
        assert!(changed);

        let second_price_feed = create_price_feed(4, 110);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, second_price_feed);
        assert!(changed);

        let stored_price_feed = price_feed_bucket(&mut deps.storage)
            .load(first_price_feed.id.as_ref())
            .unwrap();
        assert_eq!(stored_price_feed, second_price_feed);
    }

    #[test]
    fn test_query_price_info_ok() {
        let (mut deps, _env) = setup_test();

        let address = b"123".as_ref();

        let dummy_price_feed = PriceFeed::new(
            PriceIdentifier::new([0u8; 32]),
            Price {
                price:        300,
                conf:         301,
                expo:         302,
                publish_time: 303,
            },
            Default::default(),
        );
        price_feed_bucket(&mut deps.storage)
            .save(address, &dummy_price_feed)
            .unwrap();

        let price_feed = query_price_feed(&deps.as_ref(), address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.get_price_unchecked().price, 300);
        assert_eq!(price_feed.get_price_unchecked().conf, 301);
        assert_eq!(price_feed.get_price_unchecked().expo, 302);
        assert_eq!(price_feed.get_price_unchecked().publish_time, 303);
    }

    #[test]
    fn test_query_price_info_err_not_found() {
        let deps = setup_test().0;

        assert_eq!(
            query_price_feed(&deps.as_ref(), b"123".as_ref()),
            Err(PythContractError::PriceFeedNotFound.into())
        );
    }

    #[test]
    fn test_get_update_fee() {
        let (mut deps, _env) = setup_test();
        let fee_denom: String = "test".into();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                fee: Coin::new(10, fee_denom.clone()),
                ..create_zero_config_info()
            })
            .unwrap();

        let updates = vec![Binary::from([1u8]), Binary::from([2u8])];

        assert_eq!(
            get_update_fee(&deps.as_ref(), &updates[0..0]),
            Ok(Coin::new(0, fee_denom.clone()))
        );
        assert_eq!(
            get_update_fee(&deps.as_ref(), &updates[0..1]),
            Ok(Coin::new(10, fee_denom.clone()))
        );
        assert_eq!(
            get_update_fee(&deps.as_ref(), &updates[0..2]),
            Ok(Coin::new(20, fee_denom.clone()))
        );

        let big_fee: u128 = (u128::MAX / 4) * 3;
        config(&mut deps.storage)
            .save(&ConfigInfo {
                fee: Coin::new(big_fee, fee_denom.clone()),
                ..create_zero_config_info()
            })
            .unwrap();

        assert_eq!(
            get_update_fee(&deps.as_ref(), &updates[0..1]),
            Ok(Coin::new(big_fee, fee_denom))
        );
        assert!(get_update_fee(&deps.as_ref(), &updates[0..2]).is_err());
    }

    #[cfg(feature = "osmosis")]
    #[test]
    fn test_get_update_fee_for_denom() {
        let (mut deps, _env) = setup_test();
        let base_denom = "test";
        config(&mut deps.storage)
            .save(&ConfigInfo {
                fee: Coin::new(10, base_denom),
                ..create_zero_config_info()
            })
            .unwrap();

        let updates = vec![Binary::from([1u8]), Binary::from([2u8])];

        // test for base denom
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..0], base_denom.to_string()),
            Ok(Coin::new(0, base_denom))
        );
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..1], base_denom.to_string()),
            Ok(Coin::new(10, base_denom))
        );
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..2], base_denom.to_string()),
            Ok(Coin::new(20, base_denom))
        );

        // test for valid but not base denom
        // valid denoms are 'uion' or 'ibc/FF3065989E34457F342D4EFB8692406D49D4E2B5C70F725F127862E22CE6BDCD'
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..0], "uion".to_string()),
            Ok(Coin::new(0, "uion"))
        );
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..1], "uion".to_string()),
            Ok(Coin::new(10, "uion"))
        );
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..2], "uion".to_string()),
            Ok(Coin::new(20, "uion"))
        );


        // test for invalid denom
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..0], "invalid_denom".to_string()),
            Err(PythContractError::InvalidFeeDenom {
                denom: "invalid_denom".to_string(),
            }
            .into())
        );
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..1], "invalid_denom".to_string()),
            Err(PythContractError::InvalidFeeDenom {
                denom: "invalid_denom".to_string(),
            }
            .into())
        );
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..2], "invalid_denom".to_string()),
            Err(PythContractError::InvalidFeeDenom {
                denom: "invalid_denom".to_string(),
            }
            .into())
        );

        // check for overflow
        let big_fee: u128 = (u128::MAX / 4) * 3;
        config(&mut deps.storage)
            .save(&ConfigInfo {
                fee: Coin::new(big_fee, base_denom),
                ..create_zero_config_info()
            })
            .unwrap();

        // base denom
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..1], base_denom.to_string()),
            Ok(Coin::new(big_fee, base_denom))
        );
        assert!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..2], base_denom.to_string())
                .is_err()
        );

        // valid but not base
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..1], "uion".to_string()),
            Ok(Coin::new(big_fee, "uion"))
        );
        assert!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..2], "uion".to_string()).is_err()
        );

        // invalid
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..1], "invalid_denom".to_string()),
            Err(PythContractError::InvalidFeeDenom {
                denom: "invalid_denom".to_string(),
            }
            .into())
        );
        assert_eq!(
            get_update_fee_for_denom(&deps.as_ref(), &updates[0..2], "invalid_denom".to_string()),
            Err(PythContractError::InvalidFeeDenom {
                denom: "invalid_denom".to_string(),
            }
            .into())
        );
    }

    #[test]
    fn test_get_valid_time_period() {
        let (mut deps, _env) = setup_test();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                valid_time_period: Duration::from_secs(10),
                ..create_zero_config_info()
            })
            .unwrap();

        assert_eq!(
            get_valid_time_period(&deps.as_ref()),
            Ok(Duration::from_secs(10))
        );
    }

    /// Initialize the contract with `initial_config` then execute `vaa` as a governance instruction
    /// against it. Returns the response of the governance instruction along with the resulting config.
    fn apply_governance_vaa(
        initial_config: &ConfigInfo,
        vaa: &ParsedVAA,
    ) -> StdResult<(Response<MsgWrapper>, ConfigInfo)> {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage).save(initial_config).unwrap();

        let info = mock_info("123", &[]);

        let result = execute_governance_instruction(deps.as_mut(), env, info, &to_binary(&vaa)?);

        result.and_then(|response| config_read(&deps.storage).load().map(|c| (response, c)))
    }

    fn governance_test_config() -> ConfigInfo {
        ConfigInfo {
            wormhole_contract: Addr::unchecked(WORMHOLE_ADDR),
            governance_source: PythDataSource {
                emitter:  Binary(vec![1u8, 2u8]),
                chain_id: 3,
            },
            governance_sequence_number: 4,
            chain_id: 5,
            ..create_zero_config_info()
        }
    }

    fn governance_vaa(instruction: &GovernanceInstruction) -> ParsedVAA {
        let mut vaa = create_zero_vaa();
        vaa.emitter_address = vec![1u8, 2u8];
        vaa.emitter_chain = 3;
        vaa.sequence = 7;
        vaa.payload = instruction.serialize().unwrap();

        vaa
    }

    #[test]
    fn test_governance_authorization() {
        let test_config = governance_test_config();

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: 5,
            action:          SetFee { val: 6, expo: 0 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        // First check that a valid VAA is accepted (to ensure that no one accidentally breaks the following test cases).
        assert!(apply_governance_vaa(&test_config, &test_vaa).is_ok());

        // Wrong emitter address
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.emitter_address = vec![2u8, 3u8];
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // wrong source chain
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.emitter_chain = 4;
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // sequence number too low
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.sequence = 4;
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // wrong magic number
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.payload[0] = 0;
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // wrong target chain
        let mut instruction_copy = test_instruction.clone();
        instruction_copy.target_chain_id = 6;
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.payload = instruction_copy.serialize().unwrap();
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // target chain == 0 is allowed
        let mut instruction_copy = test_instruction.clone();
        instruction_copy.target_chain_id = 0;
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.payload = instruction_copy.serialize().unwrap();
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_ok());

        // wrong module
        let mut instruction_copy = test_instruction.clone();
        instruction_copy.module = Executor;
        let mut vaa_copy = test_vaa;
        vaa_copy.payload = instruction_copy.serialize().unwrap();
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // invalid action index
        let _instruction_copy = test_instruction;
        vaa_copy.payload[9] = 100;
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());
    }

    #[test]
    fn test_authorize_governance_transfer_success() {
        let source_2 = PythDataSource {
            emitter:  Binary::from([2u8; 32]),
            chain_id: 4,
        };

        let test_config = governance_test_config();
        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: test_config.chain_id,
            action:          AuthorizeGovernanceDataSourceTransfer {
                claim_vaa: to_binary(&ParsedVAA {
                    emitter_address: source_2.emitter.to_vec(),
                    emitter_chain: source_2.chain_id,
                    sequence: 12,
                    payload: GovernanceInstruction {
                        module:          Target,
                        target_chain_id: test_config.chain_id,
                        action:          RequestGovernanceDataSourceTransfer {
                            governance_data_source_index: 1,
                        },
                    }
                    .serialize()
                    .unwrap(),
                    ..create_zero_vaa()
                })
                .unwrap(),
            },
        };

        let test_vaa = governance_vaa(&test_instruction);
        let (_response, result_config) = apply_governance_vaa(&test_config, &test_vaa).unwrap();
        assert_eq!(result_config.governance_source, source_2);
        assert_eq!(result_config.governance_source_index, 1);
        assert_eq!(result_config.governance_sequence_number, 12);
    }

    #[test]
    fn test_authorize_governance_transfer_bad_source_index() {
        let source_2 = PythDataSource {
            emitter:  Binary::from([2u8; 32]),
            chain_id: 4,
        };

        let mut test_config = governance_test_config();
        test_config.governance_source_index = 10;
        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: test_config.chain_id,
            action:          AuthorizeGovernanceDataSourceTransfer {
                claim_vaa: to_binary(&ParsedVAA {
                    emitter_address: source_2.emitter.to_vec(),
                    emitter_chain: source_2.chain_id,
                    sequence: 12,
                    payload: GovernanceInstruction {
                        module:          Target,
                        target_chain_id: test_config.chain_id,
                        action:          RequestGovernanceDataSourceTransfer {
                            governance_data_source_index: 10,
                        },
                    }
                    .serialize()
                    .unwrap(),
                    ..create_zero_vaa()
                })
                .unwrap(),
            },
        };

        let test_vaa = governance_vaa(&test_instruction);
        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa),
            Err(PythContractError::InvalidGovernanceSourceIndex.into())
        );
    }

    #[test]
    fn test_authorize_governance_transfer_bad_target_chain() {
        let source_2 = PythDataSource {
            emitter:  Binary::from([2u8; 32]),
            chain_id: 4,
        };

        let test_config = governance_test_config();
        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: test_config.chain_id,
            action:          AuthorizeGovernanceDataSourceTransfer {
                claim_vaa: to_binary(&ParsedVAA {
                    emitter_address: source_2.emitter.to_vec(),
                    emitter_chain: source_2.chain_id,
                    sequence: 12,
                    payload: GovernanceInstruction {
                        module:          Target,
                        target_chain_id: test_config.chain_id + 1,
                        action:          RequestGovernanceDataSourceTransfer {
                            governance_data_source_index: 11,
                        },
                    }
                    .serialize()
                    .unwrap(),
                    ..create_zero_vaa()
                })
                .unwrap(),
            },
        };

        let test_vaa = governance_vaa(&test_instruction);
        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa),
            Err(PythContractError::InvalidGovernancePayload.into())
        );
    }

    #[test]
    fn test_set_data_sources() {
        let source_1 = PythDataSource {
            emitter:  Binary::from([1u8; 32]),
            chain_id: 2,
        };
        let source_2 = PythDataSource {
            emitter:  Binary::from([2u8; 32]),
            chain_id: 4,
        };
        let source_3 = PythDataSource {
            emitter:  Binary::from([3u8; 32]),
            chain_id: 6,
        };

        let mut test_config = governance_test_config();
        test_config.data_sources = HashSet::from([source_1]);

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: test_config.chain_id,
            action:          SetDataSources {
                data_sources: vec![source_2.clone(), source_3.clone()],
            },
        };
        let test_vaa = governance_vaa(&test_instruction);
        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.data_sources),
            Ok([source_2, source_3].iter().cloned().collect())
        );

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: test_config.chain_id,
            action:          SetDataSources {
                data_sources: vec![],
            },
        };
        let test_vaa = governance_vaa(&test_instruction);
        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.data_sources),
            Ok(HashSet::new())
        );
    }

    #[test]
    fn test_set_fee() {
        let mut test_config = governance_test_config();
        test_config.fee = Coin::new(1, "foo");

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: 5,
            action:          SetFee { val: 6, expo: 1 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.fee.amount),
            Ok(Uint128::new(60))
        );

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: 5,
            action:          SetFee { val: 6, expo: 0 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.fee.amount),
            Ok(Uint128::new(6))
        );
    }

    #[test]
    fn test_set_valid_period() {
        let mut test_config = governance_test_config();
        test_config.valid_time_period = Duration::from_secs(10);

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: 5,
            action:          SetValidPeriod { valid_seconds: 20 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.valid_time_period),
            Ok(Duration::from_secs(20))
        );
    }

    #[test]
    fn test_request_governance_transfer() {
        let test_config = governance_test_config();

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: test_config.chain_id,
            action:          RequestGovernanceDataSourceTransfer {
                governance_data_source_index: 7,
            },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert!(apply_governance_vaa(&test_config, &test_vaa).is_err());
    }
}
