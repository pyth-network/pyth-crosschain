use {
    crate::{
        error::PythContractError,
        governance::{
            GovernanceAction::SetFee,
            GovernanceInstruction,
        },
        msg::{
            ExecuteMsg,
            InstantiateMsg,
            MigrateMsg,
            PriceFeedResponse,
            QueryMsg,
        },
        state::{
            config,
            config_read,
            price_info,
            price_info_read,
            ConfigInfo,
            PriceInfo,
            PythDataSource,
        },
    },
    cosmwasm_std::{
        entry_point,
        has_coins,
        to_binary,
        Binary,
        Coin,
        Deps,
        DepsMut,
        Env,
        MessageInfo,
        QueryRequest,
        Response,
        StdResult,
        Timestamp,
        Uint128,
        WasmQuery,
    },
    p2w_sdk::BatchPriceAttestation,
    pyth_sdk_cw::{
        PriceFeed,
        PriceIdentifier,
        PriceStatus,
        ProductIdentifier,
    },
    std::{
        collections::HashSet,
        convert::TryFrom,
        time::Duration,
    },
    wormhole::{
        msg::QueryMsg as WormholeQueryMsg,
        state::ParsedVAA,
    },
};

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // Save general wormhole and pyth info
    let state = ConfigInfo {
        owner:                      info.sender,
        wormhole_contract:          deps.api.addr_validate(msg.wormhole_contract.as_ref())?,
        data_sources:               HashSet::from([PythDataSource {
            emitter:            msg.pyth_emitter,
            pyth_emitter_chain: msg.pyth_emitter_chain,
        }]),
        chain_id:                   msg.chain_id,
        governance_source:          PythDataSource {
            emitter:            msg.governance_emitter,
            pyth_emitter_chain: msg.governance_emitter_chain,
        },
        governance_sequence_number: msg.governance_sequence_number,
        valid_time_period:          Duration::from_secs(msg.valid_time_period_secs as u64),
        fee:                        msg.fee,
        fee_denom:                  msg.fee_denom,
    };
    config(deps.storage).save(&state)?;

    Ok(Response::default())
}

pub fn parse_vaa(deps: DepsMut, block_time: u64, data: &Binary) -> StdResult<ParsedVAA> {
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
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    match msg {
        ExecuteMsg::UpdatePriceFeeds { data } => update_price_feeds(deps, env, info, &data),
        ExecuteMsg::ExecuteGovernanceInstruction { data } => {
            execute_governance_instruction(deps, env, info, &data)
        }
        // TODO: remove these and invoke via governance
        ExecuteMsg::AddDataSource { data_source } => add_data_source(deps, env, info, data_source),
        ExecuteMsg::RemoveDataSource { data_source } => {
            remove_data_source(deps, env, info, data_source)
        }
    }
}

fn update_price_feeds(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    data: &Binary,
) -> StdResult<Response> {
    let state = config_read(deps.storage).load()?;

    println!("Checking fee");
    let fee = Coin::new(state.fee.u128(), state.fee_denom.clone());
    if fee.amount.u128() > 0 && !has_coins(info.funds.as_ref(), &fee) {
        return Err(PythContractError::InsufficientFee.into());
    }

    println!("Parsing VAA");
    let vaa = parse_vaa(deps.branch(), env.block.time.seconds(), data)?;

    println!("checking data source");
    verify_vaa_from_data_source(&state, &vaa)?;

    println!("processing batch attestation");
    let data = &vaa.payload;
    let batch_attestation = BatchPriceAttestation::deserialize(&data[..])
        .map_err(|_| PythContractError::InvalidUpdatePayload)?;

    process_batch_attestation(deps, env, &batch_attestation)
}

fn execute_governance_instruction(
    mut deps: DepsMut,
    env: Env,
    info: MessageInfo,
    data: &Binary,
) -> StdResult<Response> {
    let vaa = parse_vaa(deps.branch(), env.block.time.seconds(), data)?;

    execute_governance_instruction_from_vaa(deps, env, info, &vaa)
}

/// Helper function to improve testability of governance instructions (so we can unit test without wormhole).
fn execute_governance_instruction_from_vaa(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    vaa: &ParsedVAA,
) -> StdResult<Response> {
    let state = config_read(deps.storage).load()?;

    // store updates to the config as a result of this action in here.
    let mut updated_config: ConfigInfo = state.clone();
    verify_vaa_from_governance_source(&state, vaa)?;

    if vaa.sequence <= state.governance_sequence_number {
        return Err(PythContractError::OldGovernanceMessage)?;
    } else {
        updated_config.governance_sequence_number = vaa.sequence;
    }

    let data = &vaa.payload;
    let instruction = GovernanceInstruction::deserialize(&data[..])
        .map_err(|_| PythContractError::InvalidGovernancePayload)?;

    if instruction.target_chain_id != state.chain_id && instruction.target_chain_id != 0 {
        return Err(PythContractError::InvalidGovernancePayload)?;
    }

    let response = match instruction.action {
        SetFee { val, expo } => {
            updated_config.fee = Uint128::new(
                (val as u128)
                    .checked_mul(
                        10_u128
                            .checked_pow(
                                u32::try_from(expo)
                                    .map_err(|_| PythContractError::InvalidGovernancePayload)?,
                            )
                            .ok_or(PythContractError::InvalidGovernancePayload)?,
                    )
                    .ok_or(PythContractError::InvalidGovernancePayload)?,
            );

            Response::new()
                .add_attribute("action", "set_fee")
                .add_attribute("new_fee", format!("{}", updated_config.fee))
        }
        _ => Err(PythContractError::InvalidGovernancePayload)?,
    };

    config(deps.storage).save(&updated_config)?;

    Ok(response)
}

fn add_data_source(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    data_source: PythDataSource,
) -> StdResult<Response> {
    let mut state = config_read(deps.storage).load()?;

    if state.owner != info.sender {
        return Err(PythContractError::PermissionDenied)?;
    }

    if !state.data_sources.insert(data_source.clone()) {
        return Err(PythContractError::DataSourceAlreadyExists)?;
    }

    config(deps.storage).save(&state)?;

    Ok(Response::new()
        .add_attribute("action", "add_data_source")
        .add_attribute("data_source_emitter", format!("{}", data_source.emitter))
        .add_attribute(
            "data_source_emitter_chain",
            format!("{}", data_source.pyth_emitter_chain),
        ))
}

fn remove_data_source(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    data_source: PythDataSource,
) -> StdResult<Response> {
    let mut state = config_read(deps.storage).load()?;

    if state.owner != info.sender {
        return Err(PythContractError::PermissionDenied)?;
    }

    if !state.data_sources.remove(&data_source) {
        return Err(PythContractError::DataSourceDoesNotExists)?;
    }

    config(deps.storage).save(&state)?;

    Ok(Response::new()
        .add_attribute("action", "remove_data_source")
        .add_attribute("data_source_emitter", format!("{}", data_source.emitter))
        .add_attribute(
            "data_source_emitter_chain",
            format!("{}", data_source.pyth_emitter_chain),
        ))
}


/// Check that `vaa` is from a valid data source (and hence is a legitimate price update message).
fn verify_vaa_from_data_source(state: &ConfigInfo, vaa: &ParsedVAA) -> StdResult<()> {
    let vaa_data_source = PythDataSource {
        emitter:            vaa.emitter_address.clone().into(),
        pyth_emitter_chain: vaa.emitter_chain,
    };
    if !state.data_sources.contains(&vaa_data_source) {
        return Err(PythContractError::InvalidUpdateEmitter)?;
    }
    Ok(())
}

/// Check that `vaa` is from a valid governance source (and hence is a legitimate governance instruction).
fn verify_vaa_from_governance_source(state: &ConfigInfo, vaa: &ParsedVAA) -> StdResult<()> {
    let vaa_data_source = PythDataSource {
        emitter:            vaa.emitter_address.clone().into(),
        pyth_emitter_chain: vaa.emitter_chain,
    };
    if state.governance_source != vaa_data_source {
        return Err(PythContractError::InvalidUpdateEmitter)?;
    }
    Ok(())
}

fn process_batch_attestation(
    mut deps: DepsMut,
    env: Env,
    batch_attestation: &BatchPriceAttestation,
) -> StdResult<Response> {
    let mut new_attestations_cnt: u8 = 0;

    // Update prices
    for price_attestation in batch_attestation.price_attestations.iter() {
        let price_feed = PriceFeed::new(
            PriceIdentifier::new(price_attestation.price_id.to_bytes()),
            price_attestation.status,
            price_attestation.publish_time,
            price_attestation.expo,
            price_attestation.max_num_publishers,
            price_attestation.num_publishers,
            ProductIdentifier::new(price_attestation.product_id.to_bytes()),
            price_attestation.price,
            price_attestation.conf,
            price_attestation.ema_price,
            price_attestation.ema_conf,
            price_attestation.prev_price,
            price_attestation.prev_conf,
            price_attestation.prev_publish_time,
        );

        let attestation_time = Timestamp::from_seconds(price_attestation.attestation_time as u64);

        if update_price_feed_if_new(&mut deps, &env, price_feed, attestation_time)? {
            new_attestations_cnt += 1;
        }
    }

    Ok(Response::new()
        .add_attribute("action", "price_update")
        .add_attribute(
            "batch_size",
            format!("{}", batch_attestation.price_attestations.len()),
        )
        .add_attribute("num_updates", format!("{new_attestations_cnt}")))
}

/// Returns true if the price_feed is newer than the stored one.
///
/// This function returns error only if there be issues in ser/de when it reads from the bucket.
/// Such an example would be upgrades which migration is not handled carefully so the binary stored
/// in the bucket won't be parsed.
fn update_price_feed_if_new(
    deps: &mut DepsMut,
    env: &Env,
    price_feed: PriceFeed,
    attestation_time: Timestamp,
) -> StdResult<bool> {
    let mut is_new_price = true;
    price_info(deps.storage).update(
        price_feed.id.as_ref(),
        |maybe_price_info| -> StdResult<PriceInfo> {
            match maybe_price_info {
                Some(price_info) => {
                    // This check ensures that a price won't be updated with the same or older
                    // message. Attestation_time is guaranteed increasing in
                    // solana
                    if price_info.attestation_time < attestation_time {
                        Ok(PriceInfo {
                            arrival_time: env.block.time,
                            arrival_block: env.block.height,
                            price_feed,
                            attestation_time,
                        })
                    } else {
                        is_new_price = false;
                        Ok(price_info)
                    }
                }
                None => Ok(PriceInfo {
                    arrival_time: env.block.time,
                    arrival_block: env.block.height,
                    price_feed,
                    attestation_time,
                }),
            }
        },
    )?;
    Ok(is_new_price)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::PriceFeed { id } => to_binary(&query_price_feed(deps, env, id.as_ref())?),
        // TODO: implement queries for the update fee and valid time period along the following lines:
        // QueryMsg::GetUpdateFee { data: bytes[] } => ???,
        // QueryMsg::GetValidTimePeriod => ???
    }
}

pub fn query_price_feed(deps: Deps, env: Env, address: &[u8]) -> StdResult<PriceFeedResponse> {
    let config = config_read(deps.storage).load()?;
    match price_info_read(deps.storage).load(address) {
        Ok(mut price_info) => {
            let env_time_sec = env.block.time.seconds();
            let price_pub_time_sec = price_info.price_feed.publish_time as u64;

            // Cases that it will cover:
            // - This will ensure to set status unknown if the price has become very old and hasn't
            //   updated yet.
            // - If a price has arrived very late to this chain it will set the status to unknown.
            // - If a price is coming from future it's tolerated up to VALID_TIME_PERIOD seconds
            //   (using abs diff) but more than that is set to unknown, the reason could be the
            //   clock time drift between the source and target chains.
            let time_abs_diff = if env_time_sec > price_pub_time_sec {
                env_time_sec - price_pub_time_sec
            } else {
                price_pub_time_sec - env_time_sec
            };

            if time_abs_diff > config.valid_time_period.as_secs() {
                price_info.price_feed.status = PriceStatus::Unknown;
            }

            Ok(PriceFeedResponse {
                price_feed: price_info.price_feed,
            })
        }
        Err(_) => Err(PythContractError::PriceFeedNotFound)?,
    }
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
        },
        std::time::Duration,
    };

    /// Default valid time period for testing purposes.
    const VALID_TIME_PERIOD: Duration = Duration::from_secs(3 * 60);
    const WORMHOLE_ADDR: &str = "Wormhole";
    const EMITTER_CHAIN: u16 = 3;

    fn default_emitter_addr() -> Vec<u8> {
        let mut addr_vec: Vec<u8> = vec![0; 32];
        addr_vec[0] = 77;
        addr_vec[12] = 80;
        addr_vec
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
            emitter_address:    vec![0; 32],
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
            owner:                      Addr::unchecked(String::default()),
            wormhole_contract:          Addr::unchecked(String::default()),
            data_sources:               HashSet::default(),
            governance_source:          PythDataSource {
                emitter:            Binary(vec![]),
                pyth_emitter_chain: 0,
            },
            governance_sequence_number: 0,
            chain_id:                   0,
            valid_time_period:          Duration::new(0, 0),
            fee:                        Uint128::new(0),
            fee_denom:                  "".into(),
        }
    }

    fn create_price_feed(expo: i32) -> PriceFeed {
        let mut price_feed = PriceFeed::default();
        price_feed.expo = expo;
        price_feed
    }

    fn create_data_sources(
        pyth_emitter: Vec<u8>,
        pyth_emitter_chain: u16,
    ) -> HashSet<PythDataSource> {
        HashSet::from([PythDataSource {
            emitter: pyth_emitter.into(),
            pyth_emitter_chain,
        }])
    }

    /// Updates the price feed with the given attestation time stamp and
    /// returns the update status (true means updated, false means ignored)
    fn do_update_price_feed(
        deps: &mut DepsMut,
        env: &Env,
        price_feed: PriceFeed,
        attestation_time_seconds: u64,
    ) -> bool {
        update_price_feed_if_new(
            deps,
            env,
            price_feed,
            Timestamp::from_seconds(attestation_time_seconds),
        )
        .unwrap()
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
        update_price_feeds(deps.as_mut(), env, info, &msg)
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
        let emitter_address = [0; 32];
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
        config_info.fee = Uint128::new(100);
        config_info.fee_denom = "foo".into();

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
        let price_feed = create_price_feed(3);

        let changed = do_update_price_feed(&mut deps.as_mut(), &env, price_feed, 100);
        assert!(changed);

        let stored_price_feed = price_info(&mut deps.storage)
            .load(price_feed.id.as_ref())
            .unwrap()
            .price_feed;

        assert_eq!(stored_price_feed, price_feed);
    }

    #[test]
    fn test_update_price_feed_if_new_ignore_duplicate_time() {
        let (mut deps, env) = setup_test();
        let time = 100;

        let first_price_feed = create_price_feed(3);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, first_price_feed, time);
        assert!(changed);

        let second_price_feed = create_price_feed(4);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, second_price_feed, time);
        assert!(!changed);

        let stored_price_feed = price_info(&mut deps.storage)
            .load(first_price_feed.id.as_ref())
            .unwrap()
            .price_feed;
        assert_eq!(stored_price_feed, first_price_feed);
    }

    #[test]
    fn test_update_price_feed_if_new_ignore_older() {
        let (mut deps, env) = setup_test();

        let first_price_feed = create_price_feed(3);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, first_price_feed, 100);
        assert!(changed);

        let second_price_feed = create_price_feed(4);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, second_price_feed, 90);
        assert!(!changed);

        let stored_price_feed = price_info(&mut deps.storage)
            .load(first_price_feed.id.as_ref())
            .unwrap()
            .price_feed;
        assert_eq!(stored_price_feed, first_price_feed);
    }

    #[test]
    fn test_update_price_feed_if_new_accept_newer() {
        let (mut deps, env) = setup_test();

        let first_price_feed = create_price_feed(3);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, first_price_feed, 100);
        assert!(changed);

        let second_price_feed = create_price_feed(4);
        let changed = do_update_price_feed(&mut deps.as_mut(), &env, second_price_feed, 110);
        assert!(changed);

        let stored_price_feed = price_info(&mut deps.storage)
            .load(first_price_feed.id.as_ref())
            .unwrap()
            .price_feed;
        assert_eq!(stored_price_feed, second_price_feed);
    }

    #[test]
    fn test_query_price_info_ok_trading() {
        let (mut deps, mut env) = setup_test();

        let address = b"123".as_ref();

        let mut dummy_price_info = PriceInfo::default();
        dummy_price_info.price_feed.publish_time = 80;
        dummy_price_info.price_feed.status = PriceStatus::Trading;

        price_info(&mut deps.storage)
            .save(address, &dummy_price_info)
            .unwrap();

        env.block.time = Timestamp::from_seconds(80 + VALID_TIME_PERIOD.as_secs());

        let price_feed = query_price_feed(deps.as_ref(), env, address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.status, PriceStatus::Trading);
    }

    #[test]
    fn test_query_price_info_ok_stale_past() {
        let (mut deps, mut env) = setup_test();
        let address = b"123".as_ref();

        let mut dummy_price_info = PriceInfo::default();
        dummy_price_info.price_feed.publish_time = 500;
        dummy_price_info.price_feed.status = PriceStatus::Trading;

        price_info(&mut deps.storage)
            .save(address, &dummy_price_info)
            .unwrap();

        env.block.time = Timestamp::from_seconds(500 + VALID_TIME_PERIOD.as_secs() + 1);

        let price_feed = query_price_feed(deps.as_ref(), env, address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.status, PriceStatus::Unknown);
    }

    #[test]
    fn test_query_price_info_ok_trading_future() {
        let (mut deps, mut env) = setup_test();

        let address = b"123".as_ref();

        let mut dummy_price_info = PriceInfo::default();
        dummy_price_info.price_feed.publish_time = 500;
        dummy_price_info.price_feed.status = PriceStatus::Trading;

        price_info(&mut deps.storage)
            .save(address, &dummy_price_info)
            .unwrap();

        env.block.time = Timestamp::from_seconds(500 - VALID_TIME_PERIOD.as_secs());

        let price_feed = query_price_feed(deps.as_ref(), env, address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.status, PriceStatus::Trading);
    }

    #[test]
    fn test_query_price_info_ok_stale_future() {
        let (mut deps, mut env) = setup_test();

        let address = b"123".as_ref();

        let mut dummy_price_info = PriceInfo::default();
        dummy_price_info.price_feed.publish_time = 500;
        dummy_price_info.price_feed.status = PriceStatus::Trading;

        price_info(&mut deps.storage)
            .save(address, &dummy_price_info)
            .unwrap();

        env.block.time = Timestamp::from_seconds(500 - VALID_TIME_PERIOD.as_secs() - 1);

        let price_feed = query_price_feed(deps.as_ref(), env, address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.status, PriceStatus::Unknown);
    }

    #[test]
    fn test_query_price_info_err_not_found() {
        let (deps, env) = setup_test();

        assert_eq!(
            query_price_feed(deps.as_ref(), env, b"123".as_ref()),
            Err(PythContractError::PriceFeedNotFound.into())
        );
    }

    #[test]
    fn test_add_data_source_ok_with_owner() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                owner: Addr::unchecked("123"),
                ..create_zero_config_info()
            })
            .unwrap();

        let data_source = PythDataSource {
            emitter:            vec![1u8].into(),
            pyth_emitter_chain: 1,
        };

        assert!(add_data_source(
            deps.as_mut(),
            env.clone(),
            mock_info("123", &[]),
            data_source.clone()
        )
        .is_ok());

        // Adding an existing data source should result an error
        assert!(add_data_source(deps.as_mut(), env, mock_info("123", &[]), data_source).is_err());
    }

    #[test]
    fn test_add_data_source_err_without_owner() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                owner: Addr::unchecked("123"),
                ..create_zero_config_info()
            })
            .unwrap();

        let data_source = PythDataSource {
            emitter:            vec![1u8].into(),
            pyth_emitter_chain: 1,
        };

        assert!(add_data_source(deps.as_mut(), env, mock_info("321", &[]), data_source).is_err());
    }

    #[test]
    fn test_remove_data_source_ok_with_owner() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                owner: Addr::unchecked("123"),
                data_sources: create_data_sources(vec![1u8], 1),
                ..create_zero_config_info()
            })
            .unwrap();

        let data_source = PythDataSource {
            emitter:            vec![1u8].into(),
            pyth_emitter_chain: 1,
        };

        assert!(remove_data_source(
            deps.as_mut(),
            env.clone(),
            mock_info("123", &[]),
            data_source.clone()
        )
        .is_ok());

        // Removing a non existent data source should result an error
        assert!(
            remove_data_source(deps.as_mut(), env, mock_info("123", &[]), data_source).is_err()
        );
    }

    #[test]
    fn test_remove_data_source_err_without_owner() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                owner: Addr::unchecked("123"),
                data_sources: create_data_sources(vec![1u8], 1),
                ..create_zero_config_info()
            })
            .unwrap();

        let data_source = PythDataSource {
            emitter:            vec![1u8].into(),
            pyth_emitter_chain: 1,
        };

        assert!(
            remove_data_source(deps.as_mut(), env, mock_info("321", &[]), data_source).is_err()
        );
    }

    #[test]
    fn test_verify_vaa_works_after_adding_data_source() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                owner: Addr::unchecked("123"),
                ..create_zero_config_info()
            })
            .unwrap();

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = vec![1u8];
        vaa.emitter_chain = 3;

        // Should result an error because there is no data source
        assert_eq!(
            verify_vaa_from_data_source(&config_read(&deps.storage).load().unwrap(), &vaa),
            Err(PythContractError::InvalidUpdateEmitter.into())
        );

        let data_source = PythDataSource {
            emitter:            vec![1u8].into(),
            pyth_emitter_chain: 3,
        };
        assert!(add_data_source(deps.as_mut(), env, mock_info("123", &[]), data_source).is_ok());

        assert_eq!(
            verify_vaa_from_data_source(&config_read(&deps.storage).load().unwrap(), &vaa),
            Ok(())
        );
    }

    #[test]
    fn test_verify_vaa_err_after_removing_data_source() {
        let (mut deps, env) = setup_test();
        config(&mut deps.storage)
            .save(&ConfigInfo {
                owner: Addr::unchecked("123"),
                data_sources: create_data_sources(vec![1u8], 3),
                ..create_zero_config_info()
            })
            .unwrap();

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = vec![1u8];
        vaa.emitter_chain = 3;

        assert_eq!(
            verify_vaa_from_data_source(&config_read(&deps.storage).load().unwrap(), &vaa),
            Ok(())
        );

        let data_source = PythDataSource {
            emitter:            vec![1u8].into(),
            pyth_emitter_chain: 3,
        };
        assert!(remove_data_source(deps.as_mut(), env, mock_info("123", &[]), data_source).is_ok());

        // Should result an error because data source should not exist anymore
        assert_eq!(
            verify_vaa_from_data_source(&config_read(&deps.storage).load().unwrap(), &vaa),
            Err(PythContractError::InvalidUpdateEmitter.into())
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

        let result = execute_governance_instruction_from_vaa(deps.as_mut(), env, info, vaa);

        result.and_then(|response| config_read(&deps.storage).load().map(|c| (response, c)))
    }

    fn governance_test_config() -> ConfigInfo {
        ConfigInfo {
            governance_source: PythDataSource {
                emitter:            Binary(vec![1u8, 2u8]),
                pyth_emitter_chain: 3,
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
    fn test_set_fee() {
        let mut test_config = governance_test_config();
        test_config.fee = Uint128::new(1);

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: 5,
            action:          SetFee { val: 6, expo: 1 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.fee),
            Ok(Uint128::new(60))
        );

        let test_instruction = GovernanceInstruction {
            module:          Target,
            target_chain_id: 5,
            action:          SetFee { val: 6, expo: 0 },
        };
        let test_vaa = governance_vaa(&test_instruction);

        assert_eq!(
            apply_governance_vaa(&test_config, &test_vaa).map(|(_r, c)| c.fee),
            Ok(Uint128::new(6))
        );
    }
}
