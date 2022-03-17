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
    StdError,
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
        MAX_INGESTION_TIME_PERIOD,
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
    let data = vaa.payload;

    let message = BatchPriceAttestation::deserialize(&data[..])
        .map_err(|_| ContractError::InvalidVAA.std())?;
    if vaa.emitter_address != state.pyth_emitter || vaa.emitter_chain != state.pyth_emitter_chain {
        return ContractError::InvalidVAA.std_err();
    }
    
    let mut new_attestations_cnt: u8 = 0;

    // Update prices
    for price_attestation in message.price_attestations.iter() {
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

        if env.block.time.seconds() - attestation_time.seconds() > MAX_INGESTION_TIME_PERIOD.as_secs() {
            return Err(StdError::generic_err(
                format!("Attestation is very old. Current timestamp: {} Attestation timestamp: {}",
                        env.block.time.seconds(), attestation_time.seconds())
                    )
            );
        }

        price_info(deps.storage).update(
            &price_attestation.price_id.to_bytes()[..],
        |maybe_price_info| -> StdResult<PriceInfo> {
            match maybe_price_info {
                Some(price_info) => {
                    if price_info.attestation_time < attestation_time {
                        new_attestations_cnt += 1;
                        Ok(PriceInfo {
                            arrival_time: env.block.time,
                            arrival_block: env.block.height,
                            price_feed,
                            attestation_time
                        })
                    } else {
                        Ok(price_info)
                    }
                },
                None => {
                    new_attestations_cnt += 1;
                    Ok(PriceInfo {
                        arrival_time: env.block.time,
                        arrival_block: env.block.height,
                        price_feed,
                        attestation_time
                    })
                }
            }
        })?;
    }

    Ok(Response::new()
        .add_attribute("action", "price_update")
        .add_attribute(
            "num_price_feeds",
            format!("{}", message.price_attestations.len()),
        )
        .add_attribute(
            "num_new_price_feeds",
            format!("{}", new_attestations_cnt),
        )
    )
}


#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::PriceFeed { price_id } => {
            to_binary(&query_price_info(deps, env, price_id.as_slice())?)
        }
    }
}

pub fn query_price_info(deps: Deps, env: Env, address: &[u8]) -> StdResult<PriceFeedResponse> {
    match price_info_read(deps.storage).load(address) {
        Ok(mut terra_price_info) => {
            if env.block.time.seconds() - terra_price_info.arrival_time.seconds() > VALID_TIME_PERIOD.as_secs() {
                terra_price_info.price_feed.status = PriceStatus::Unknown;
            }

            Ok(
                PriceFeedResponse {
                    price_feed: terra_price_info.price_feed,
                }
            )
        },
        Err(_) => ContractError::AssetNotFound.std_err(),
    }
}
