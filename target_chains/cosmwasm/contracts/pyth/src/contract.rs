#[cfg(feature = "injective")]
use crate::injective::{create_relay_pyth_prices_msg, InjectiveMsgWrapper as MsgWrapper};
#[cfg(not(feature = "injective"))]
use cosmwasm_std::Empty as MsgWrapper;
#[cfg(feature = "osmosis")]
use osmosis_std::types::osmosis::txfees::v1beta1::TxfeesQuerier;
use {
    crate::{
        governance::{
            GovernanceAction::{
                AuthorizeGovernanceDataSourceTransfer, RequestGovernanceDataSourceTransfer,
                SetDataSources, SetFee, SetValidPeriod, UpgradeContract,
            },
            GovernanceInstruction, GovernanceModule,
        },
        msg::{InstantiateMsg, MigrateMsg},
        state::{
            config, config_read, price_feed_bucket, price_feed_read_bucket, set_contract_version,
            ConfigInfo, PythDataSource,
        },
    },
    byteorder::BigEndian,
    cosmwasm_std::{
        coin, entry_point, to_binary, Addr, Binary, Coin, CosmosMsg, Deps, DepsMut, Env,
        MessageInfo, OverflowError, OverflowOperation, QueryRequest, Response, StdResult, WasmMsg,
        WasmQuery,
    },
    cw_wormhole::{msg::QueryMsg as WormholeQueryMsg, state::ParsedVAA},
    pyth_sdk::{Identifier, UnixTimestamp},
    pyth_sdk_cw::{
        error::PythContractError, ExecuteMsg, Price, PriceFeed, PriceFeedResponse, PriceIdentifier,
        QueryMsg,
    },
    pythnet_sdk::legacy::{BatchPriceAttestation, PriceAttestation, PriceStatus},
    pythnet_sdk::{
        accumulators::merkle::MerkleRoot,
        hashers::keccak256_160::Keccak160,
        messages::Message,
        wire::{
            from_slice,
            v1::{
                AccumulatorUpdateData, Proof, WormholeMessage, WormholePayload,
                PYTHNET_ACCUMULATOR_UPDATE_MAGIC,
            },
        },
    },
    std::{collections::HashSet, convert::TryFrom, iter::FromIterator, time::Duration},
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
        wormhole_contract: deps.api.addr_validate(msg.wormhole_contract.as_ref())?,
        data_sources: msg.data_sources.iter().cloned().collect(),
        chain_id: msg.chain_id,
        governance_source: msg.governance_source.clone(),
        governance_source_index: msg.governance_source_index,
        governance_sequence_number: msg.governance_sequence_number,
        valid_time_period: Duration::from_secs(msg.valid_time_period_secs as u64),
        fee: msg.fee,
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
pub fn parse_and_verify_vaa(deps: Deps, block_time: u64, data: &Binary) -> StdResult<ParsedVAA> {
    let cfg = config_read(deps.storage).load()?;
    let vaa: ParsedVAA = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: cfg.wormhole_contract.to_string(),
        msg: to_binary(&WormholeQueryMsg::VerifyVAA {
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
    if !is_fee_sufficient(&deps.as_ref(), info, data)? {
        Err(PythContractError::InsufficientFee)?;
    }

    let (num_total_attestations, total_new_feeds) = apply_updates(&mut deps, &env, data)?;

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
    deps: DepsMut,
    env: Env,
    _info: MessageInfo,
    data: &Binary,
) -> StdResult<Response<MsgWrapper>> {
    let vaa = parse_and_verify_vaa(deps.as_ref(), env.block.time.seconds(), data)?;
    let state = config_read(deps.storage).load()?;
    verify_vaa_from_governance_source(&state, &vaa)?;

    // store updates to the config as a result of this action in here.
    let mut updated_config: ConfigInfo = state.clone();

    // Governance messages must be applied in order. This check prevents replay attacks where
    // previous messages are re-applied.
    if vaa.sequence <= state.governance_sequence_number {
        Err(PythContractError::OldGovernanceMessage)?;
    } else {
        updated_config.governance_sequence_number = vaa.sequence;
    }

    let data = &vaa.payload;
    let instruction = GovernanceInstruction::deserialize(&data[..])
        .map_err(|_| PythContractError::InvalidGovernancePayload)?;

    // Check that the instruction is intended for this chain.
    // chain_id = 0 means the instruction applies to all chains
    if instruction.target_chain_id != state.chain_id && instruction.target_chain_id != 0 {
        Err(PythContractError::InvalidGovernancePayload)?;
    }

    // Check that the instruction is intended for this target chain contract (as opposed to
    // other Pyth contracts that may live on the same chain).
    if instruction.module != GovernanceModule::Target {
        Err(PythContractError::InvalidGovernancePayload)?;
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
                parse_and_verify_vaa(deps.as_ref(), env.block.time.seconds(), &claim_vaa)?;
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
                emitter: Binary::from(parsed_claim_vaa.emitter_address.clone()),
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
        emitter: vaa.emitter_address.clone().into(),
        chain_id: vaa.emitter_chain,
    };
    if !state.data_sources.contains(&vaa_data_source) {
        Err(PythContractError::InvalidUpdateEmitter)?;
    }
    Ok(())
}

/// Check that `vaa` is from a valid governance source (and hence is a legitimate governance instruction).
fn verify_vaa_from_governance_source(state: &ConfigInfo, vaa: &ParsedVAA) -> StdResult<()> {
    let vaa_data_source = PythDataSource {
        emitter: vaa.emitter_address.clone().into(),
        chain_id: vaa.emitter_chain,
    };
    if state.governance_source != vaa_data_source {
        Err(PythContractError::InvalidUpdateEmitter)?;
    }
    Ok(())
}

fn parse_update(deps: &Deps, env: &Env, data: &Binary) -> StdResult<Vec<PriceFeed>> {
    let header = data.get(0..4);
    let feeds = if header == Some(PYTHNET_ACCUMULATOR_UPDATE_MAGIC.as_slice()) {
        parse_accumulator(deps, env, data)?
    } else {
        parse_batch_attestation(deps, env, data)?
    };
    Ok(feeds)
}

fn apply_updates(
    deps: &mut DepsMut,
    env: &Env,
    data: &[Binary],
) -> StdResult<(usize, Vec<PriceFeed>)> {
    let mut num_total_attestations: usize = 0;
    let mut total_new_feeds: Vec<PriceFeed> = vec![];

    for datum in data {
        let feeds = parse_update(&deps.as_ref(), env, datum)?;
        num_total_attestations += feeds.len();
        for feed in feeds {
            if update_price_feed_if_new(deps, env, feed)? {
                total_new_feeds.push(feed);
            }
        }
    }
    Ok((num_total_attestations, total_new_feeds))
}

fn parse_accumulator(deps: &Deps, env: &Env, data: &[u8]) -> StdResult<Vec<PriceFeed>> {
    let update_data = AccumulatorUpdateData::try_from_slice(data)
        .map_err(|_| PythContractError::InvalidAccumulatorPayload)?;
    match update_data.proof {
        Proof::WormholeMerkle { vaa, updates } => {
            let parsed_vaa = parse_and_verify_vaa(
                *deps,
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
            let mut feeds = vec![];
            for update in updates {
                let message_vec = Vec::from(update.message);
                if !root.check(update.proof, &message_vec) {
                    Err(PythContractError::InvalidMerkleProof)?;
                }

                let msg = from_slice::<BigEndian, Message>(&message_vec)
                    .map_err(|_| PythContractError::InvalidAccumulatorMessage)?;

                match msg {
                    Message::PriceFeedMessage(price_feed_message) => {
                        let price_feed = PriceFeed::new(
                            PriceIdentifier::new(price_feed_message.feed_id),
                            Price {
                                price: price_feed_message.price,
                                conf: price_feed_message.conf,
                                expo: price_feed_message.exponent,
                                publish_time: price_feed_message.publish_time,
                            },
                            Price {
                                price: price_feed_message.ema_price,
                                conf: price_feed_message.ema_conf,
                                expo: price_feed_message.exponent,
                                publish_time: price_feed_message.publish_time,
                            },
                        );
                        feeds.push(price_feed);
                    }
                    _ => return Err(PythContractError::InvalidAccumulatorMessageType)?,
                }
            }
            Ok(feeds)
        }
    }
}

/// Update the on-chain storage for any new price updates provided in `batch_attestation`.
fn parse_batch_attestation(deps: &Deps, env: &Env, data: &Binary) -> StdResult<Vec<PriceFeed>> {
    let vaa = parse_and_verify_vaa(*deps, env.block.time.seconds(), data)?;
    let state = config_read(deps.storage).load()?;
    verify_vaa_from_data_source(&state, &vaa)?;
    let data = &vaa.payload;
    let batch_attestation = BatchPriceAttestation::deserialize(&data[..])
        .map_err(|_| PythContractError::InvalidUpdatePayload)?;
    let mut feeds = vec![];

    // Update prices
    for price_attestation in batch_attestation.price_attestations.iter() {
        let price_feed = create_price_feed_from_price_attestation(price_attestation);
        feeds.push(price_feed);
    }

    Ok(feeds)
}

fn create_price_feed_from_price_attestation(price_attestation: &PriceAttestation) -> PriceFeed {
    match price_attestation.status {
        PriceStatus::Trading => PriceFeed::new(
            PriceIdentifier::new(price_attestation.price_id.to_bytes()),
            Price {
                price: price_attestation.price,
                conf: price_attestation.conf,
                expo: price_attestation.expo,
                publish_time: price_attestation.publish_time,
            },
            Price {
                price: price_attestation.ema_price,
                conf: price_attestation.ema_conf,
                expo: price_attestation.expo,
                publish_time: price_attestation.publish_time,
            },
        ),
        _ => PriceFeed::new(
            PriceIdentifier::new(price_attestation.price_id.to_bytes()),
            Price {
                price: price_attestation.prev_price,
                conf: price_attestation.prev_conf,
                expo: price_attestation.expo,
                publish_time: price_attestation.prev_publish_time,
            },
            Price {
                price: price_attestation.ema_price,
                conf: price_attestation.ema_conf,
                expo: price_attestation.expo,
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

/// This function is not used in the contract yet but mimicks the behavior implemented
/// in the EVM contract. We are yet to finalize how the parsed prices should be consumed
/// in injective as well as other chains.
pub fn parse_price_feed_updates(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    updates: &[Binary],
    price_feeds: Vec<Identifier>,
    min_publish_time: UnixTimestamp,
    max_publish_time: UnixTimestamp,
) -> StdResult<Response<MsgWrapper>> {
    let _config = config_read(deps.storage).load()?;
    if !is_fee_sufficient(&deps.as_ref(), info, updates)? {
        Err(PythContractError::InsufficientFee)?;
    }
    let mut found_feeds = 0;
    let mut results: Vec<(Identifier, Option<PriceFeed>)> =
        price_feeds.iter().map(|id| (*id, None)).collect();
    for datum in updates {
        let feeds = parse_update(&deps.as_ref(), &env, datum)?;
        for result in results.as_mut_slice() {
            if result.1.is_some() {
                continue;
            }
            for feed in feeds.as_slice() {
                if feed.get_price_unchecked().publish_time < min_publish_time
                    || feed.get_price_unchecked().publish_time > max_publish_time
                {
                    continue;
                }
                if result.0 == feed.id {
                    result.1 = Some(*feed);
                    found_feeds += 1;
                    break;
                }
            }
        }
    }
    if found_feeds != price_feeds.len() {
        Err(PythContractError::InvalidUpdatePayload)?;
    }

    let _unwrapped_feeds = results
        .into_iter()
        .map(|(_, feed)| feed.unwrap())
        .collect::<Vec<PriceFeed>>();
    let response = Response::new();
    Ok(response.add_attribute("action", "parse_price_feeds"))
}

/// Get the most recent value of the price feed indicated by `feed_id`.
pub fn query_price_feed(deps: &Deps, feed_id: &[u8]) -> StdResult<PriceFeedResponse> {
    match price_feed_read_bucket(deps.storage).load(feed_id) {
        Ok(price_feed) => Ok(PriceFeedResponse { price_feed }),
        Err(_) => Err(PythContractError::PriceFeedNotFound)?,
    }
}

pub fn get_update_fee_amount(deps: &Deps, vaas: &[Binary]) -> StdResult<u128> {
    let config = config_read(deps.storage).load()?;

    let mut total_updates: u128 = 0;
    for datum in vaas {
        let header = datum.get(0..4);
        if header == Some(PYTHNET_ACCUMULATOR_UPDATE_MAGIC.as_slice()) {
            let update_data = AccumulatorUpdateData::try_from_slice(datum)
                .map_err(|_| PythContractError::InvalidAccumulatorPayload)?;
            match update_data.proof {
                Proof::WormholeMerkle { vaa: _, updates } => {
                    total_updates += updates.len() as u128;
                }
            }
        } else {
            total_updates += 1;
        }
    }

    Ok(config
        .fee
        .amount
        .u128()
        .checked_mul(total_updates)
        .ok_or(OverflowError::new(
            OverflowOperation::Mul,
            config.fee.amount,
            total_updates,
        ))?)
}

/// Get the fee that a caller must pay in order to submit a price update.
/// The fee depends on both the current contract configuration and the update data `vaas`.
/// The fee is in the denoms as stored in the current configuration
pub fn get_update_fee(deps: &Deps, vaas: &[Binary]) -> StdResult<Coin> {
    let config = config_read(deps.storage).load()?;
    Ok(coin(get_update_fee_amount(deps, vaas)?, config.fee.denom))
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
    Ok(coin(get_update_fee_amount(deps, vaas)?, denom))
}

pub fn get_valid_time_period(deps: &Deps) -> StdResult<Duration> {
    Ok(config_read(deps.storage).load()?.valid_time_period)
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::{
            governance::GovernanceModule::{Executor, Target},
            state::get_contract_version,
        },
        cosmwasm_std::{
            coins, from_binary,
            testing::{mock_dependencies, mock_env, mock_info, MockApi, MockQuerier, MockStorage},
            Addr, ContractResult, OwnedDeps, QuerierResult, StdError, SystemError, SystemResult,
            Uint128,
        },
        pyth_sdk::UnixTimestamp,
        pyth_sdk_cw::PriceIdentifier,
        pythnet_sdk::legacy::PriceAttestation,
        pythnet_sdk::{
            accumulators::{merkle::MerkleTree, Accumulator},
            messages::{PriceFeedMessage, TwapMessage},
            test_utils::{
                create_accumulator_message, create_accumulator_message_from_updates,
                create_dummy_price_feed_message, create_vaa_from_payload, DEFAULT_CHAIN_ID,
                DEFAULT_DATA_SOURCE, DEFAULT_GOVERNANCE_SOURCE, DEFAULT_VALID_TIME_PERIOD,
                SECONDARY_GOVERNANCE_SOURCE, WRONG_CHAIN_ID, WRONG_SOURCE,
            },
            wire::{to_vec, v1::MerklePriceUpdate, PrefixedVec},
        },
        serde_wormhole::RawMessage,
        std::time::Duration,
        wormhole_sdk::{Address, Chain, Vaa},
    };

    /// Default valid time period for testing purposes.
    const WORMHOLE_ADDR: &str = "Wormhole";

    fn default_config_info() -> ConfigInfo {
        ConfigInfo {
            wormhole_contract: Addr::unchecked(WORMHOLE_ADDR),
            data_sources: create_data_sources(
                DEFAULT_DATA_SOURCE.address.0.to_vec(),
                DEFAULT_DATA_SOURCE.chain.into(),
            ),
            ..create_zero_config_info()
        }
    }

    fn setup_test() -> (OwnedDeps<MockStorage, MockApi, MockQuerier>, Env) {
        let mut dependencies = mock_dependencies();
        dependencies.querier.update_wasm(handle_wasm_query);

        let mut config = config(dependencies.as_mut().storage);
        config
            .save(&ConfigInfo {
                valid_time_period: Duration::from_secs(DEFAULT_VALID_TIME_PERIOD),
                ..create_zero_config_info()
            })
            .unwrap();
        (dependencies, mock_env())
    }

    fn handle_wasm_query(wasm_query: &WasmQuery) -> QuerierResult {
        match wasm_query {
            WasmQuery::Smart { contract_addr, msg } if *contract_addr == WORMHOLE_ADDR => {
                let query_msg = from_binary::<WormholeQueryMsg>(msg);
                match query_msg {
                    Ok(WormholeQueryMsg::VerifyVAA { vaa, .. }) => {
                        SystemResult::Ok(ContractResult::Ok(
                            to_binary(&ParsedVAA::deserialize(&vaa).unwrap()).unwrap(),
                        ))
                    }
                    Err(_e) => SystemResult::Err(SystemError::InvalidRequest {
                        error: "Invalid message".into(),
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

    fn create_batch_price_update_msg(
        emitter_address: Address,
        emitter_chain: Chain,
        attestations: Vec<PriceAttestation>,
    ) -> Binary {
        let batch_attestation = BatchPriceAttestation {
            price_attestations: attestations,
        };

        let vaa = create_vaa_from_payload(
            &batch_attestation.serialize().unwrap(),
            emitter_address,
            emitter_chain,
            0,
        );
        serde_wormhole::to_vec(&vaa).unwrap().into()
    }

    fn create_batch_price_update_msg_from_attestations(
        attestations: Vec<PriceAttestation>,
    ) -> Binary {
        create_batch_price_update_msg(
            DEFAULT_DATA_SOURCE.address,
            DEFAULT_DATA_SOURCE.chain,
            attestations,
        )
    }

    fn create_zero_config_info() -> ConfigInfo {
        ConfigInfo {
            wormhole_contract: Addr::unchecked(String::default()),
            data_sources: HashSet::default(),
            governance_source: PythDataSource {
                emitter: Binary(vec![]),
                chain_id: 0,
            },
            governance_source_index: 0,
            governance_sequence_number: 0,
            chain_id: 0,
            valid_time_period: Duration::new(0, 0),
            fee: Coin::new(0, ""),
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
            emitter: pyth_emitter.into(),
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
        emitter_address: Address,
        emitter_chain: Chain,
        attestations: Vec<PriceAttestation>,
    ) -> StdResult<(usize, Vec<PriceFeed>)> {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage).save(config_info).unwrap();
        let msg = create_batch_price_update_msg(emitter_address, emitter_chain, attestations);
        apply_updates(&mut deps.as_mut(), &env, &[msg])
    }

    #[test]
    fn test_instantiate() {
        let mut deps = mock_dependencies();

        let instantiate_msg = InstantiateMsg {
            // this is an example wormhole contract address in order to create a valid instantiate message
            wormhole_contract: String::from("inj1xx3aupmgv3ce537c0yce8zzd3sz567syuyedpg"),
            data_sources: Vec::new(),
            governance_source: PythDataSource {
                emitter: Binary(vec![]),
                chain_id: 0,
            },
            governance_source_index: 0,
            governance_sequence_number: 0,
            chain_id: 0,
            valid_time_period_secs: 0,
            fee: Coin::new(0, ""),
        };

        let res = instantiate(
            deps.as_mut(),
            mock_env(),
            MessageInfo {
                sender: Addr::unchecked(""),
                funds: Vec::new(),
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
            wormhole_contract: String::from(""),
            data_sources: Vec::new(),
            governance_source: PythDataSource {
                emitter: Binary(vec![]),
                chain_id: 0,
            },
            governance_source_index: 0,
            governance_sequence_number: 0,
            chain_id: 0,
            valid_time_period_secs: 0,
            fee: Coin::new(0, ""),
        };

        let res = instantiate(
            deps.as_mut(),
            mock_env(),
            MessageInfo {
                sender: Addr::unchecked(""),
                funds: Vec::new(),
            },
            instantiate_msg,
        );
        assert!(res.is_err());
    }

    #[cfg(feature = "osmosis")]
    fn check_sufficient_fee(deps: &Deps, data: &[Binary]) {
        let mut info = mock_info("123", coins(100, "foo").as_slice());
        let result = is_fee_sufficient(deps, info.clone(), data);
        assert_eq!(result, Ok(true));

        // insufficient fee in base denom -> false
        info.funds = coins(50, "foo");
        let result = is_fee_sufficient(deps, info.clone(), data);
        assert_eq!(result, Ok(false));

        // valid denoms are 'uion' or 'ibc/FF3065989E34457F342D4EFB8692406D49D4E2B5C70F725F127862E22CE6BDCD'
        // a valid denom other than base denom with sufficient fee
        info.funds = coins(100, "uion");
        let result = is_fee_sufficient(deps, info.clone(), data);
        assert_eq!(result, Ok(true));

        // insufficient fee in valid denom -> false
        info.funds = coins(50, "uion");
        let result = is_fee_sufficient(deps, info.clone(), data);
        assert_eq!(result, Ok(false));

        // an invalid denom -> Err invalid fee denom
        info.funds = coins(100, "invalid_denom");
        let result = is_fee_sufficient(deps, info, data);
        assert_eq!(
            result,
            Err(PythContractError::InvalidFeeDenom {
                denom: "invalid_denom".to_string(),
            }
            .into())
        );
    }

    #[cfg(not(feature = "osmosis"))]
    fn check_sufficient_fee(deps: &Deps, data: &[Binary]) {
        let mut info = mock_info("123", coins(100, "foo").as_slice());

        // sufficient fee -> true
        let result = is_fee_sufficient(deps, info.clone(), data);
        assert_eq!(result, Ok(true));

        // insufficient fee -> false
        info.funds = coins(50, "foo");
        let result = is_fee_sufficient(deps, info.clone(), data);
        assert_eq!(result, Ok(false));

        // insufficient fee -> false
        info.funds = coins(150, "bar");
        let result = is_fee_sufficient(deps, info, data);
        assert_eq!(result, Ok(false));
    }

    #[test]
    fn test_is_fee_sufficient() {
        let mut config_info = default_config_info();
        config_info.fee = Coin::new(100, "foo");

        let (mut deps, _env) = setup_test();
        config(&mut deps.storage).save(&config_info).unwrap();
        let data = [create_batch_price_update_msg_from_attestations(vec![
            PriceAttestation::default(),
        ])];
        check_sufficient_fee(&deps.as_ref(), &data);

        let feed1 = create_dummy_price_feed_message(100);
        let feed2 = create_dummy_price_feed_message(200);
        let feed3 = create_dummy_price_feed_message(300);
        let data =
            create_accumulator_message(&[&feed1, &feed2, &feed3], &[&feed1], false, false, None);
        check_sufficient_fee(&deps.as_ref(), &[data.into()])
    }

    #[test]
    fn test_parse_batch_attestation_empty_array() {
        let (num_attestations, new_attestations) = apply_price_update(
            &default_config_info(),
            DEFAULT_DATA_SOURCE.address,
            DEFAULT_DATA_SOURCE.chain,
            vec![],
        )
        .unwrap();

        assert_eq!(num_attestations, 0);
        assert_eq!(new_attestations.len(), 0);
    }

    fn check_price_match(deps: &OwnedDeps<MockStorage, MockApi, MockQuerier>, msg: &Message) {
        match msg {
            Message::PriceFeedMessage(feed_msg) => {
                let feed = price_feed_read_bucket(&deps.storage)
                    .load(&feed_msg.feed_id)
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
            _ => panic!("invalid message type"),
        };
    }

    fn test_accumulator_wrong_source(emitter_address: Address, emitter_chain: Chain) {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let feed1_bytes = to_vec::<_, BigEndian>(&feed1).unwrap();
        let tree = MerkleTree::<Keccak160>::new(&[feed1_bytes.as_slice()]).unwrap();
        let mut price_updates: Vec<MerklePriceUpdate> = vec![];
        let proof1 = tree.prove(&feed1_bytes).unwrap();
        price_updates.push(MerklePriceUpdate {
            message: PrefixedVec::from(feed1_bytes),
            proof: proof1,
        });
        let msg = create_accumulator_message_from_updates(
            price_updates,
            tree,
            false,
            emitter_address,
            emitter_chain,
        );
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
        assert!(result.is_err());
        assert_eq!(result, Err(PythContractError::InvalidUpdateEmitter.into()));
    }

    #[test]
    fn test_accumulator_verify_vaa_sender_fail_wrong_emitter_address() {
        test_accumulator_wrong_source(WRONG_SOURCE.address, DEFAULT_DATA_SOURCE.chain);
    }

    #[test]
    fn test_accumulator_verify_vaa_sender_fail_wrong_emitter_chain() {
        test_accumulator_wrong_source(DEFAULT_DATA_SOURCE.address, WRONG_SOURCE.chain);
    }

    #[test]
    fn test_accumulator_get_update_fee_amount() {
        let mut config_info = default_config_info();
        config_info.fee = Coin::new(100, "foo");

        let (mut deps, _env) = setup_test();
        config(&mut deps.storage).save(&config_info).unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let feed2 = create_dummy_price_feed_message(200);
        let feed3 = create_dummy_price_feed_message(300);

        let msg = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed1, &feed3],
            false,
            false,
            None,
        );
        assert_eq!(
            get_update_fee_amount(&deps.as_ref(), &[msg.into()]).unwrap(),
            200
        );

        let msg =
            create_accumulator_message(&[&feed1, &feed2, &feed3], &[&feed1], false, false, None);
        assert_eq!(
            get_update_fee_amount(&deps.as_ref(), &[msg.into()]).unwrap(),
            100
        );

        let msg = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed1, &feed2, &feed3, &feed1, &feed3],
            false,
            false,
            None,
        );
        assert_eq!(
            get_update_fee_amount(&deps.as_ref(), &[msg.into()]).unwrap(),
            500
        );

        let batch_msg =
            create_batch_price_update_msg_from_attestations(vec![PriceAttestation::default()]);
        let msg = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed1, &feed2, &feed3],
            false,
            false,
            None,
        );
        assert_eq!(
            get_update_fee_amount(&deps.as_ref(), &[msg.into(), batch_msg]).unwrap(),
            400
        );
    }

    #[test]
    fn test_accumulator_message_single_update() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();

        let feed1 = create_dummy_price_feed_message(100);
        let feed2 = create_dummy_price_feed_message(200);
        let msg = create_accumulator_message(&[&feed1, &feed2], &[&feed1], false, false, None);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
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
        let all_feeds: Vec<&Message> = all_feeds.iter().collect();
        let msg = create_accumulator_message(&all_feeds, &all_feeds[100..110], false, false, None);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
        assert!(result.is_ok());
        for msg in &all_feeds[100..110] {
            check_price_match(&deps, msg);
        }
    }

    fn as_mut_price_feed(msg: &mut Message) -> &mut PriceFeedMessage {
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
        let msg = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed1, &feed2, &feed3],
            false,
            false,
            None,
        );
        as_mut_price_feed(&mut feed1).publish_time += 1;
        as_mut_price_feed(&mut feed2).publish_time += 1;
        as_mut_price_feed(&mut feed3).publish_time += 1;
        as_mut_price_feed(&mut feed1).price *= 2;
        as_mut_price_feed(&mut feed2).price *= 2;
        as_mut_price_feed(&mut feed3).price *= 2;
        let msg2 = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed1, &feed2, &feed3],
            false,
            false,
            None,
        );
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into(), msg2.into()]);

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
        as_mut_price_feed(&mut feed2).publish_time -= 1;
        as_mut_price_feed(&mut feed2).price *= 2;
        let msg = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed1, &feed2, &feed3],
            false,
            false,
            None,
        );
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);

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
        as_mut_price_feed(&mut feed2).publish_time -= 1;
        as_mut_price_feed(&mut feed2).price *= 2;
        let msg = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed1, &feed3],
            false,
            false,
            None,
        );

        let msg2 = create_accumulator_message(
            &[&feed1, &feed2, &feed3],
            &[&feed2, &feed3],
            false,
            false,
            None,
        );
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into(), msg2.into()]);

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
        let mut msg = create_accumulator_message(&[&feed1], &[&feed1], false, false, None);
        msg[4] = 3; // major version
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
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
        let msg = create_accumulator_message(&[&feed1], &[&feed1], true, false, None);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
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
        // Although Twap Message is a valid message but it won't get stored on-chain via
        // `update_price_feeds` and (will be) used in other methods
        let feed1 = Message::TwapMessage(TwapMessage {
            feed_id: [0; 32],
            cumulative_price: 0,
            cumulative_conf: 0,
            num_down_slots: 0,
            exponent: 0,
            publish_time: 0,
            prev_publish_time: 0,
            publish_slot: 0,
        });
        let msg = create_accumulator_message(&[&feed1], &[&feed1], false, false, None);
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
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
            proof: proof1,
        });
        let msg = create_accumulator_message_from_updates(
            price_updates,
            tree,
            false,
            DEFAULT_DATA_SOURCE.address,
            DEFAULT_DATA_SOURCE.chain,
        );
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
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
            proof: proof1,
        });
        let msg = create_accumulator_message_from_updates(
            price_updates,
            tree,
            false,
            DEFAULT_DATA_SOURCE.address,
            DEFAULT_DATA_SOURCE.chain,
        );
        let info = mock_info("123", &[]);
        let result = update_price_feeds(deps.as_mut(), env, info, &[msg.into()]);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            StdError::from(PythContractError::InvalidAccumulatorMessage)
        );
    }

    #[test]
    fn test_create_price_feed_from_price_attestation_status_trading() {
        let price_attestation = PriceAttestation {
            price_id: pythnet_sdk::legacy::Identifier::new([0u8; 32]),
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
            price_id: pythnet_sdk::legacy::Identifier::new([0u8; 32]),
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

    #[test]
    fn test_parse_batch_attestation_status_not_trading() {
        let (mut deps, env) = setup_test();

        let price_attestation = PriceAttestation {
            price_id: pythnet_sdk::legacy::Identifier::new([0u8; 32]),
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

        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();
        let msg = create_batch_price_update_msg_from_attestations(vec![price_attestation]);
        let feeds = parse_batch_attestation(&deps.as_ref(), &env, &msg).unwrap();
        assert_eq!(feeds.len(), 1);
        let price = feeds[0].get_price_unchecked();
        let ema_price = feeds[0].get_ema_price_unchecked();

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

    #[test]
    fn test_parse_batch_attestation_status_trading() {
        let (mut deps, env) = setup_test();

        let price_attestation = PriceAttestation {
            price_id: pythnet_sdk::legacy::Identifier::new([0u8; 32]),
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

        config(&mut deps.storage)
            .save(&default_config_info())
            .unwrap();
        let msg = create_batch_price_update_msg_from_attestations(vec![price_attestation]);
        let feeds = parse_batch_attestation(&deps.as_ref(), &env, &msg).unwrap();
        assert_eq!(feeds.len(), 1);
        let price = feeds[0].get_price_unchecked();
        let ema_price = feeds[0].get_ema_price_unchecked();

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
            DEFAULT_DATA_SOURCE.address,
            DEFAULT_DATA_SOURCE.chain,
            vec![PriceAttestation::default()],
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_vaa_sender_fail_wrong_emitter_address() {
        let result = apply_price_update(
            &default_config_info(),
            WRONG_SOURCE.address,
            DEFAULT_DATA_SOURCE.chain,
            vec![PriceAttestation::default()],
        );
        assert_eq!(result, Err(PythContractError::InvalidUpdateEmitter.into()));
    }

    #[test]
    fn test_verify_vaa_sender_fail_wrong_emitter_chain() {
        let result = apply_price_update(
            &default_config_info(),
            DEFAULT_DATA_SOURCE.address,
            WRONG_SOURCE.chain,
            vec![PriceAttestation::default()],
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
                price: 300,
                conf: 301,
                expo: 302,
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

        let updates = [Binary::from([1u8]), Binary::from([2u8])];

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
        vaa: &Vaa<Box<RawMessage>>,
    ) -> StdResult<(Response<MsgWrapper>, ConfigInfo)> {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage).save(initial_config).unwrap();

        let info = mock_info("123", &[]);

        let result = execute_governance_instruction(
            deps.as_mut(),
            env,
            info,
            &serde_wormhole::to_vec(vaa).unwrap().into(),
        );

        result.and_then(|response| config_read(&deps.storage).load().map(|c| (response, c)))
    }

    fn governance_test_config() -> ConfigInfo {
        ConfigInfo {
            wormhole_contract: Addr::unchecked(WORMHOLE_ADDR),
            governance_source: PythDataSource {
                emitter: Binary(DEFAULT_GOVERNANCE_SOURCE.address.0.to_vec()),
                chain_id: DEFAULT_GOVERNANCE_SOURCE.chain.into(),
            },
            governance_sequence_number: 4,
            chain_id: DEFAULT_CHAIN_ID.into(),
            ..create_zero_config_info()
        }
    }

    fn governance_vaa(instruction: &GovernanceInstruction) -> Vaa<Box<RawMessage>> {
        create_vaa_from_payload(
            &instruction.serialize().unwrap(),
            DEFAULT_GOVERNANCE_SOURCE.address,
            DEFAULT_GOVERNANCE_SOURCE.chain,
            7,
        )
    }

    #[test]
    fn test_governance_authorization() {
        let test_config = governance_test_config();

        let test_instruction = GovernanceInstruction {
            module: Target,
            target_chain_id: DEFAULT_CHAIN_ID.into(),
            action: SetFee { val: 6, expo: 0 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        // First check that a valid VAA is accepted (to ensure that no one accidentally breaks the following test cases).
        assert!(apply_governance_vaa(&test_config, &test_vaa).is_ok());

        // Wrong emitter address
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.emitter_address = WRONG_SOURCE.address;
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // wrong source chain
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.emitter_chain = WRONG_SOURCE.chain;
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // sequence number too low
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.sequence = 4;
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // wrong magic number
        let mut vaa_copy = test_vaa.clone();
        let mut new_payload = vaa_copy.payload.to_vec();
        new_payload[0] = 0;
        vaa_copy.payload = <Box<RawMessage>>::from(new_payload);
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // wrong target chain
        let mut instruction_copy = test_instruction.clone();
        instruction_copy.target_chain_id = WRONG_CHAIN_ID.into();
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.payload = <Box<RawMessage>>::from(instruction_copy.serialize().unwrap());
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // target chain == 0 is allowed
        let mut instruction_copy = test_instruction.clone();
        instruction_copy.target_chain_id = 0;
        let mut vaa_copy = test_vaa.clone();
        vaa_copy.payload = <Box<RawMessage>>::from(instruction_copy.serialize().unwrap());
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_ok());

        // wrong module
        let mut instruction_copy = test_instruction;
        instruction_copy.module = Executor;
        let mut vaa_copy = test_vaa;
        vaa_copy.payload = <Box<RawMessage>>::from(instruction_copy.serialize().unwrap());
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());

        // invalid action index
        let mut new_payload = vaa_copy.payload.to_vec();
        new_payload[9] = 100;
        vaa_copy.payload = <Box<RawMessage>>::from(new_payload);
        assert!(apply_governance_vaa(&test_config, &vaa_copy).is_err());
    }

    #[test]
    fn test_authorize_governance_transfer_success() {
        let source_2 = PythDataSource {
            emitter: Binary::from(SECONDARY_GOVERNANCE_SOURCE.address.0),
            chain_id: SECONDARY_GOVERNANCE_SOURCE.chain.into(),
        };

        let test_config = governance_test_config();

        let claim_vaa = create_vaa_from_payload(
            &GovernanceInstruction {
                module: Target,
                target_chain_id: test_config.chain_id,
                action: RequestGovernanceDataSourceTransfer {
                    governance_data_source_index: 1,
                },
            }
            .serialize()
            .unwrap(),
            SECONDARY_GOVERNANCE_SOURCE.address,
            SECONDARY_GOVERNANCE_SOURCE.chain,
            12,
        );

        let test_instruction = GovernanceInstruction {
            module: Target,
            target_chain_id: test_config.chain_id,
            action: AuthorizeGovernanceDataSourceTransfer {
                claim_vaa: serde_wormhole::to_vec(&claim_vaa).unwrap().into(),
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
        let mut test_config = governance_test_config();
        test_config.governance_source_index = 10;

        let claim_vaa = create_vaa_from_payload(
            &GovernanceInstruction {
                module: Target,
                target_chain_id: test_config.chain_id,
                action: RequestGovernanceDataSourceTransfer {
                    governance_data_source_index: 10,
                },
            }
            .serialize()
            .unwrap(),
            SECONDARY_GOVERNANCE_SOURCE.address,
            SECONDARY_GOVERNANCE_SOURCE.chain,
            12,
        );

        let test_instruction = GovernanceInstruction {
            module: Target,
            target_chain_id: test_config.chain_id,
            action: AuthorizeGovernanceDataSourceTransfer {
                claim_vaa: serde_wormhole::to_vec(&claim_vaa).unwrap().into(),
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
        let test_config = governance_test_config();

        let claim_vaa = create_vaa_from_payload(
            &GovernanceInstruction {
                module: Target,
                target_chain_id: WRONG_CHAIN_ID.into(),
                action: RequestGovernanceDataSourceTransfer {
                    governance_data_source_index: 11,
                },
            }
            .serialize()
            .unwrap(),
            SECONDARY_GOVERNANCE_SOURCE.address,
            SECONDARY_GOVERNANCE_SOURCE.chain,
            12,
        );

        let test_instruction = GovernanceInstruction {
            module: Target,
            target_chain_id: test_config.chain_id,
            action: AuthorizeGovernanceDataSourceTransfer {
                claim_vaa: serde_wormhole::to_vec(&claim_vaa).unwrap().into(),
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
            emitter: Binary::from([1u8; 32]),
            chain_id: 2,
        };
        let source_2 = PythDataSource {
            emitter: Binary::from([2u8; 32]),
            chain_id: 4,
        };
        let source_3 = PythDataSource {
            emitter: Binary::from([3u8; 32]),
            chain_id: 6,
        };

        let mut test_config = governance_test_config();
        test_config.data_sources = HashSet::from([source_1]);

        let test_instruction = GovernanceInstruction {
            module: Target,
            target_chain_id: test_config.chain_id,
            action: SetDataSources {
                data_sources: vec![source_2.clone(), source_3.clone()],
            },
        };
        let test_vaa = governance_vaa(&test_instruction);
        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.data_sources),
            Ok([source_2, source_3].iter().cloned().collect())
        );

        let test_instruction = GovernanceInstruction {
            module: Target,
            target_chain_id: test_config.chain_id,
            action: SetDataSources {
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
            module: Target,
            target_chain_id: DEFAULT_CHAIN_ID.into(),
            action: SetFee { val: 6, expo: 1 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.fee.amount),
            Ok(Uint128::new(60))
        );

        let test_instruction = GovernanceInstruction {
            module: Target,
            target_chain_id: DEFAULT_CHAIN_ID.into(),
            action: SetFee { val: 6, expo: 0 },
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
            module: Target,
            target_chain_id: DEFAULT_CHAIN_ID.into(),
            action: SetValidPeriod { valid_seconds: 20 },
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
            module: Target,
            target_chain_id: test_config.chain_id,
            action: RequestGovernanceDataSourceTransfer {
                governance_data_source_index: 7,
            },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert!(apply_governance_vaa(&test_config, &test_vaa).is_err());
    }
}
