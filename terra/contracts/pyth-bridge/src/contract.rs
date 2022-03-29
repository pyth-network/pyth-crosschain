use cosmwasm_std::{
    entry_point,
    to_binary,
    Binary,
    Deps,
    DepsMut,
    Env,
    MessageInfo,
    QueryRequest,
    Response,
    StdResult,
    WasmQuery,
    Timestamp,
};

use pyth_sdk::{
    PriceFeed,
    PriceStatus,
};

use crate::{
    msg::{
        ExecuteMsg,
        InstantiateMsg,
        MigrateMsg,
        QueryMsg,
        PriceFeedResponse,
    },
    state::{
        config,
        config_read,
        price_info,
        price_info_read,
        ConfigInfo,
        PriceInfo,
        VALID_TIME_PERIOD,
    },
};

use p2w_sdk::{
    BatchPriceAttestation,
};

use wormhole::{
    error::ContractError,
    msg::QueryMsg as WormholeQueryMsg,
    state::{
        ParsedVAA,
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
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // Save general wormhole and pyth info
    let state = ConfigInfo {
        wormhole_contract: msg.wormhole_contract,
        pyth_emitter: msg.pyth_emitter.as_slice().to_vec(),
        pyth_emitter_chain: msg.pyth_emitter_chain,
    };
    config(deps.storage).save(&state)?;

    Ok(Response::default())
}

pub fn parse_vaa(deps: DepsMut, block_time: u64, data: &Binary) -> StdResult<ParsedVAA> {
    let cfg = config_read(deps.storage).load()?;
    let vaa: ParsedVAA = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: cfg.wormhole_contract.clone(),
        msg: to_binary(&WormholeQueryMsg::VerifyVAA {
            vaa: data.clone(),
            block_time,
        })?,
    }))?;
    Ok(vaa)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    match msg {
        ExecuteMsg::SubmitVaa { data } => submit_vaa(deps, env, info, &data),
    }
}

fn submit_vaa(
    mut deps: DepsMut,
    env: Env,
    _info: MessageInfo,
    data: &Binary,
) -> StdResult<Response> {
    let state = config_read(deps.storage).load()?;

    let vaa = parse_vaa(deps.branch(), env.block.time.seconds(), data)?;

    verify_vaa_sender(&state, &vaa)?;

    let data = &vaa.payload;
    let batch_attestation = BatchPriceAttestation::deserialize(&data[..])
        .map_err(|_| ContractError::InvalidVAA.std())?;

    process_batch_attestation(deps, env, &batch_attestation)
}

// This checks the emitter to be the pyth emitter in wormhole and it comes from emitter chain (Solana)
fn verify_vaa_sender(state: &ConfigInfo, vaa: &ParsedVAA) -> StdResult<()> {
    if vaa.emitter_address != state.pyth_emitter || vaa.emitter_chain != state.pyth_emitter_chain {
        return ContractError::InvalidVAA.std_err();
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
            price_attestation.price_id.to_bytes(),
            price_attestation.status,
            price_attestation.expo,
            0, // max_num_publishers data is currently unavailable
            0, // num_publishers data is currently unavailable
            price_attestation.product_id.to_bytes(),
            price_attestation.price,
            price_attestation.confidence_interval,
            price_attestation.ema_price.val,
            price_attestation.ema_conf.val as u64,
        );

        let attestation_time = Timestamp::from_seconds(price_attestation.timestamp as u64);

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
        .add_attribute("num_updates", format!("{}", new_attestations_cnt)))
}

/// Returns true if the price_feed is newer than the stored one.
/// 
/// This function returns error only if there be issues in ser/de when it reads from the bucket. Such an example would be 
/// upgrades which migration is not handled carefully so the binary stored in the bucket won't be parsed.
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
                    // This check ensures that a price won't be updated with the same or older message.
                    // Attestation_time is guaranteed increasing in solana
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
        QueryMsg::PriceFeed { id } => {
            to_binary(&query_price_info(deps, env, id.as_ref())?)
        }
    }
}

pub fn query_price_info(deps: Deps, env: Env, address: &[u8]) -> StdResult<PriceFeedResponse> {
    match price_info_read(deps.storage).load(address) {
        Ok(mut terra_price_info) => {
            // Attestation time is very close to the actual price time (maybe a few seconds older).
            // Cases that it will cover:
            // - This will ensure to set status unknown if the price has become very old and hasn't updated yet.
            // - If a price has arrived very late to terra it will set the status to unknown.
            // - If a price is coming from future it's tolerated up to VALID_TIME_PERIOD seconds (using abs diff)
            //   but more than that is set to unknown, the reason is huge clock difference means there exists a
            //   problem in a either Terra or Solana blockchain and if it is Solana we don't want to propagate
            //   Solana internal problems to Terra
            let time_abs_diff = if env.block.time.seconds() > terra_price_info.attestation_time.seconds() {
                env.block.time.seconds() - terra_price_info.attestation_time.seconds()
            } else {
                terra_price_info.attestation_time.seconds() - env.block.time.seconds()
            };

            if time_abs_diff > VALID_TIME_PERIOD.as_secs() {
                terra_price_info.price_feed.status = PriceStatus::Unknown;
            }

            Ok(
                PriceFeedResponse {
                    price_feed: terra_price_info.price_feed,
                }
            )
        }
        Err(_) => ContractError::AssetNotFound.std_err(),
    }
}

#[cfg(test)]
mod test {
    use cosmwasm_std::{
        testing::{
            mock_dependencies,
            mock_env,
            MockApi,
            MockQuerier,
            MockStorage,
        },
        OwnedDeps,
    };

    use super::*;

    fn setup_test() -> (OwnedDeps<MockStorage, MockApi, MockQuerier>, Env) {
        (mock_dependencies(&[]), mock_env())
    }

    fn create_zero_vaa() -> ParsedVAA {
        ParsedVAA {
            version: 0,
            guardian_set_index: 0,
            timestamp: 0,
            nonce: 0,
            len_signers: 0,
            emitter_chain: 0,
            emitter_address: vec![],
            sequence: 0,
            consistency_level: 0,
            payload: vec![],
            hash: vec![],
        }
    }

    fn create_price_feed(expo: i32) -> PriceFeed {
        let mut price_feed = PriceFeed::default();
        price_feed.expo = expo;
        price_feed
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
            &env,
            price_feed,
            Timestamp::from_seconds(attestation_time_seconds),
        )
        .unwrap()
    }

    #[test]
    fn test_verify_vaa_sender_ok() {
        let mut config_info = ConfigInfo::default();
        config_info.pyth_emitter = vec![1u8];
        config_info.pyth_emitter_chain = 3;

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = vec![1u8];
        vaa.emitter_chain = 3;

        assert_eq!(verify_vaa_sender(&config_info, &vaa), Ok(()));
    }

    #[test]
    fn test_verify_vaa_sender_fail_wrong_emitter_address() {
        let mut config_info = ConfigInfo::default();
        config_info.pyth_emitter = vec![1u8];
        config_info.pyth_emitter_chain = 3;

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = vec![3u8, 4u8];
        vaa.emitter_chain = 3;
        assert_eq!(
            verify_vaa_sender(&config_info, &vaa),
            ContractError::InvalidVAA.std_err()
        );

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = vec![1u8];
        vaa.emitter_chain = 2;
        assert_eq!(
            verify_vaa_sender(&config_info, &vaa),
            ContractError::InvalidVAA.std_err()
        );
    }

    #[test]
    fn test_verify_vaa_sender_fail_wrong_emitter_chain() {
        let mut config_info = ConfigInfo::default();
        config_info.pyth_emitter = vec![1u8];
        config_info.pyth_emitter_chain = 3;

        let mut vaa = create_zero_vaa();
        vaa.emitter_address = vec![1u8];
        vaa.emitter_chain = 2;
        assert_eq!(
            verify_vaa_sender(&config_info, &vaa),
            ContractError::InvalidVAA.std_err()
        );
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
        dummy_price_info.attestation_time = Timestamp::from_seconds(80);
        dummy_price_info.price_feed.status = PriceStatus::Trading;

        price_info(&mut deps.storage)
            .save(address, &dummy_price_info)
            .unwrap();

        env.block.time = Timestamp::from_seconds(100);

        let price_feed = query_price_info(deps.as_ref(), env, address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.status, PriceStatus::Trading);
    }

    #[test]
    fn test_query_price_info_ok_stale_past() {
        let (mut deps, mut env) = setup_test();
        let address = b"123".as_ref();

        let mut dummy_price_info = PriceInfo::default();
        dummy_price_info.attestation_time = Timestamp::from_seconds(500);
        dummy_price_info.price_feed.status = PriceStatus::Trading;

        price_info(&mut deps.storage)
            .save(address, &dummy_price_info)
            .unwrap();

        env.block.time = Timestamp::from_seconds(500 + VALID_TIME_PERIOD.as_secs() + 1);

        let price_feed = query_price_info(deps.as_ref(), env, address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.status, PriceStatus::Unknown);
    }

    #[test]
    fn test_query_price_info_ok_stale_future() {
        let (mut deps, mut env) = setup_test();

        let address = b"123".as_ref();

        let mut dummy_price_info = PriceInfo::default();
        dummy_price_info.attestation_time = Timestamp::from_seconds(500);
        dummy_price_info.price_feed.status = PriceStatus::Trading;

        price_info(&mut deps.storage)
            .save(address, &dummy_price_info)
            .unwrap();

        env.block.time = Timestamp::from_seconds(500 - VALID_TIME_PERIOD.as_secs() - 1);

        let price_feed = query_price_info(deps.as_ref(), env, address)
            .unwrap()
            .price_feed;

        assert_eq!(price_feed.status, PriceStatus::Unknown);
    }

    #[test]
    fn test_query_price_info_err_not_found() {
        let (deps, env) = setup_test();

        assert_eq!(
            query_price_info(deps.as_ref(), env, b"123".as_ref()),
            ContractError::AssetNotFound.std_err()
        );
    }
}
