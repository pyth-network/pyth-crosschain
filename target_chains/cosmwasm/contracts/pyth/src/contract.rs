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
            ConfigInfo,
            PythDataSource,
        },
    },
    cosmwasm_std::{
        coin,
        entry_point,
        has_coins,
        to_binary,
        Addr,
        Binary,
        Coin,
        CosmosMsg,
        Deps,
        DepsMut,
        Empty as MsgWrapper,
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
    std::{
        collections::HashSet,
        convert::TryFrom,
        iter::FromIterator,
        time::Duration,
    },
    wormhole::{
        msg::QueryMsg as WormholeQueryMsg,
        state::ParsedVAA,
    },
};
// #[cfg(target_chain = "injective")]
// use crate::injective::InjectiveMsgWrapper as MsgWrapper;

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
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    Ok(Response::default())
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

    // Check that a sufficient fee was sent with the message
    if state.fee.amount.u128() > 0
        && !has_coins(info.funds.as_ref(), &get_update_fee(&deps.as_ref(), data)?)
    {
        return Err(PythContractError::InsufficientFee.into());
    }

    let mut num_total_attestations: usize = 0;
    let mut total_new_attestations: Vec<PriceAttestation> = vec![];

    for datum in data {
        let vaa = parse_and_verify_vaa(deps.branch(), env.block.time.seconds(), datum)?;
        verify_vaa_from_data_source(&state, &vaa)?;

        let data = &vaa.payload;
        let batch_attestation = BatchPriceAttestation::deserialize(&data[..])
            .map_err(|_| PythContractError::InvalidUpdatePayload)?;

        let (num_attestations, new_attestations) =
            process_batch_attestation(&mut deps, &env, &batch_attestation)?;
        num_total_attestations += num_attestations;
        for new_attestation in new_attestations {
            total_new_attestations.push(new_attestation.to_owned());
        }
    }

    let num_total_new_attestations = total_new_attestations.len();

    Ok(Response::new()
        .add_attribute("action", "update_price_feeds")
        .add_attribute("num_attestations", format!("{num_total_attestations}"))
        .add_attribute("num_updated", format!("{num_total_new_attestations}")))
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
            if current_config.governance_source_index >= governance_data_source_index {
                Err(PythContractError::OldGovernanceMessage)?
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

/// Update the on-chain storage for any new price updates provided in `batch_attestation`.
fn process_batch_attestation<'a>(
    deps: &mut DepsMut,
    env: &Env,
    batch_attestation: &'a BatchPriceAttestation,
) -> StdResult<(usize, Vec<&'a PriceAttestation>)> {
    let mut new_attestations = vec![];

    // Update prices
    for price_attestation in batch_attestation.price_attestations.iter() {
        let price_feed = create_price_feed_from_price_attestation(price_attestation);

        if update_price_feed_if_new(deps, env, price_feed)? {
            new_attestations.push(price_attestation);
        }
    }

    Ok((batch_attestation.price_attestations.len(), new_attestations))
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

pub fn get_valid_time_period(deps: &Deps) -> StdResult<Duration> {
    Ok(config_read(deps.storage).load()?.valid_time_period)
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::governance::GovernanceModule::{
            Executor,
            Target,
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
            SystemError,
            SystemResult,
            Uint128,
        },
        pyth_sdk::UnixTimestamp,
        pyth_sdk_cw::PriceIdentifier,
        pyth_wormhole_attester_sdk::PriceAttestation,
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
            // TODO: pass these in
            price_attestations: vec![],
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
    ) -> StdResult<Response> {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage).save(config_info).unwrap();

        let info = mock_info("123", funds);
        let msg = create_price_update_msg(emitter_address, emitter_chain);
        update_price_feeds(deps.as_mut(), env, info, &[msg])
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
    fn test_update_price_feeds_insufficient_fee() {
        let mut config_info = default_config_info();
        config_info.fee = Coin::new(100, "foo");

        let result = apply_price_update(
            &config_info,
            default_emitter_addr().as_slice(),
            EMITTER_CHAIN,
            &[],
        );
        assert_eq!(result, Err(PythContractError::InsufficientFee.into()));

        let result = apply_price_update(
            &config_info,
            default_emitter_addr().as_slice(),
            EMITTER_CHAIN,
            coins(100, "foo").as_slice(),
        );
        assert!(result.is_ok());

        let result = apply_price_update(
            &config_info,
            default_emitter_addr().as_slice(),
            EMITTER_CHAIN,
            coins(99, "foo").as_slice(),
        );
        assert_eq!(result, Err(PythContractError::InsufficientFee.into()));

        let result = apply_price_update(
            &config_info,
            default_emitter_addr().as_slice(),
            EMITTER_CHAIN,
            coins(100, "bar").as_slice(),
        );
        assert_eq!(result, Err(PythContractError::InsufficientFee.into()));
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
            Price {
                ..Default::default()
            },
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
    ) -> StdResult<(Response, ConfigInfo)> {
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
        let (_response, result_config) = apply_governance_vaa(&test_config, &test_vaa).unwrap();
        assert_eq!(result_config.governance_source, source_2);
        assert_eq!(result_config.governance_source_index, 11);
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
            Err(PythContractError::OldGovernanceMessage.into())
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
