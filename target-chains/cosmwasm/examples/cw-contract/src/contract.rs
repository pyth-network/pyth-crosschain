use std::time::Duration;

#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
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
    WasmQuery, Coin,
};

use pyth_cosmwasm::msg::{
    PriceFeedResponse,
    QueryMsg as PythQueryMsg,
};

use crate::msg::{
    ExecuteMsg,
    FetchPriceResponse,
    InstantiateMsg,
    MigrateMsg,
    QueryMsg,
};
use crate::state::{
    State,
    STATE,
};

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> StdResult<Response> {
    Ok(Response::new().add_attribute("method", "migrate"))
}

/// The instantiate function is invoked when the contract is first deployed.
/// This function sets configuration values that are used by the query function.
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    // It is a good practice that your contract stores the pyth contract address and ids of the
    // price feeds it needs upon instantiation or by an authorized approach. This will ensure
    // that a wrong address won't be used.
    let state = State {
        pyth_contract_addr: deps.api.addr_validate(msg.pyth_contract_addr.as_ref())?,
        price_feed_id:      msg.price_feed_id,
    };
    STATE.save(deps.storage, &state)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("price_id", format!("{}", msg.price_feed_id)))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    _msg: ExecuteMsg,
) -> StdResult<Response> {
    Ok(Response::new().add_attribute("method", "execute"))
}

/// Query the Pyth contract the current price of the configured price feed.
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::FetchPrice {} => to_binary(&query_fetch_price(deps, env)?),
        QueryMsg::FetchUpdateFee { vaas } => to_binary(&query_fetch_update_fee(deps, vaas)?),
        QueryMsg::FetchValidTimePeriod => to_binary(&query_fetch_valid_time_period(deps)?),
    }
}

fn query_fetch_price(deps: Deps, env: Env) -> StdResult<FetchPriceResponse> {
    let state = STATE.load(deps.storage)?;

    // query_price_feed is the standard way to read the current price from a Pyth price feed.
    // It takes the address of the Pyth contract (which is fixed for each network) and the id of the
    // price feed. The result is a PriceFeed object with fields for the current price and other
    // useful information. The function will fail if the contract address or price feed id are
    // invalid.
    let price_feed_response: PriceFeedResponse =
        deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
            contract_addr: state.pyth_contract_addr.into_string(),
            msg:           to_binary(&PythQueryMsg::PriceFeed {
                id: state.price_feed_id,
            })?,
        }))?;

    let price_feed = price_feed_response.price_feed;

    // Get the current price and confidence interval from the price feed.
    // This function returns None if the price is not currently available.
    // This condition can happen for various reasons. For example, some products only trade at
    // specific times, or network outages may prevent the price feed from updating.
    //
    // The example code below throws an error if the price is not available. It is recommended that
    // you handle this scenario more carefully. Consult the [consumer best practices](https://docs.pyth.network/consumers/best-practices)
    // for recommendations.
    let current_price = price_feed
        .get_price_no_older_than(env.block.time.seconds() as i64, 60)
        .ok_or_else(|| StdError::not_found("Current price is not available"))?;

    // Get an exponentially-weighted moving average price and confidence interval.
    // The same notes about availability apply to this price.
    let ema_price = price_feed
        .get_ema_price_no_older_than(env.block.time.seconds() as i64, 60)
        .ok_or_else(|| StdError::not_found("EMA price is not available"))?;

    Ok(FetchPriceResponse {
        current_price,
        ema_price,
    })
}

fn query_fetch_update_fee(deps: Deps, vaas: Vec<Binary>) -> StdResult<Coin> {
    let state = STATE.load(deps.storage)?;
    let contract_addr = state.pyth_contract_addr.into_string();

    let msg = to_binary(&PythQueryMsg::GetUpdateFee { vaas })?;

    let coin: Coin = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart { contract_addr, msg }))?;
    Ok(coin)
}

fn query_fetch_valid_time_period(deps: Deps) -> StdResult<Duration> {
    let state = STATE.load(deps.storage)?;
    let contract_addr = state.pyth_contract_addr.into_string();

    let msg = to_binary(&PythQueryMsg::GetValidTimePeriod)?;

    let duration: Duration = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart { contract_addr, msg }))?;
    Ok(duration)
}
