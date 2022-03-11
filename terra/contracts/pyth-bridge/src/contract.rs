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
    Price,
    PriceStatus
};

use crate::{
    msg::{
        ExecuteMsg,
        InstantiateMsg,
        MigrateMsg,
        QueryMsg,
        PriceInfoResponse,
    },
    state::{
        config,
        config_read,
        price_info,
        price_info_read,
        ConfigInfo,
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
    // Save general wormhole info
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

    // IMPORTANT: VAA replay-protection is not implemented in this code-path
    // Sequences are used to prevent replay or price rollbacks

    let message = BatchPriceAttestation::deserialize(&data[..])
        .map_err(|_| ContractError::InvalidVAA.std())?;
    if vaa.emitter_address != state.pyth_emitter || vaa.emitter_chain != state.pyth_emitter_chain {
        return ContractError::InvalidVAA.std_err();
    }
    
    let mut new_attestations_cnt: u8 = 0;

    // Update prices
    for price_attestation in message.price_attestations.iter() {
        let price = Price {
            product_id: price_attestation.product_id.to_bytes(),
            // status: price_attestation.status, We should remove it soon when we get pyth-sdk released
            status: pyth_sdk::PriceStatus::Trading,
            price: price_attestation.price,
            conf: price_attestation.confidence_interval,
            ema_price: price_attestation.twap.val,
            ema_conf: price_attestation.twac.val as u64,
            expo: price_attestation.expo,
            num_publishers: 0, // This data is currently unavailable
            max_num_publishers: 0 // This data is currently unavailable
        };

        let attestation_time = Timestamp::from_seconds(price_attestation.timestamp as u64);

        if env.block.time.seconds() - attestation_time.seconds() > VALID_TIME_PERIOD.as_secs() {
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
                            price,
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
                        price,
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
        QueryMsg::PriceInfo { price_id } => {
            to_binary(&query_price_info(deps, env, price_id.as_slice())?)
        }
    }
}

pub fn query_price_info(deps: Deps, env: Env, address: &[u8]) -> StdResult<PriceInfoResponse> {
    match price_info_read(deps.storage).load(address) {
        Ok(mut terra_price_info) => {
            if env.block.time.seconds() - terra_price_info.arrival_time.seconds() > VALID_TIME_PERIOD.as_secs() {
                terra_price_info.price.status = PriceStatus::Unknown;
            }

            Ok(
                PriceInfoResponse {
                    arrival_time: terra_price_info.arrival_time,
                    price: terra_price_info.price,
                }
            )
        },
        Err(_) => ContractError::AssetNotFound.std_err(),
    }
}
