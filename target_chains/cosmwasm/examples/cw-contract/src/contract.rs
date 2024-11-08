#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use {
    crate::{
        msg::{ExecuteMsg, FetchPriceResponse, InstantiateMsg, MigrateMsg, QueryMsg},
        state::{State, STATE},
    },
    cosmwasm_std::{
        to_binary, Binary, Coin, Deps, DepsMut, Env, MessageInfo, Response, StdError, StdResult,
    },
    pyth_sdk_cw::{get_update_fee, get_valid_time_period, query_price_feed, PriceFeedResponse},
    std::time::Duration,
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
        price_feed_id: msg.price_feed_id,
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
        query_price_feed(&deps.querier, state.pyth_contract_addr, state.price_feed_id)?;
    let price_feed = price_feed_response.price_feed;

    // Get the current price and confidence interval from the price feed.
    // This function returns None if the price is not currently available.
    // This condition can happen for various reasons. For example, some products only trade at
    // specific times, or network outages may prevent the price feed from updating.
    //
    // The example code below throws an error if the price is not available. It is recommended that
    // you handle this scenario more carefully. Consult the [consumer best practices](https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices)
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
    let coin = get_update_fee(&deps.querier, state.pyth_contract_addr, vaas.as_slice())?;
    Ok(coin)
}

fn query_fetch_valid_time_period(deps: Deps) -> StdResult<Duration> {
    let state = STATE.load(deps.storage)?;
    let duration = get_valid_time_period(&deps.querier, state.pyth_contract_addr)?;
    Ok(duration)
}

#[cfg(test)]
mod test {
    use {
        super::*,
        cosmwasm_std::{
            from_binary,
            testing::{mock_dependencies, mock_env, MockApi, MockQuerier, MockStorage},
            Addr, Coin, OwnedDeps, QuerierResult, SystemError, SystemResult, Timestamp, WasmQuery,
        },
        pyth_sdk_cw::{testing::MockPyth, Price, PriceFeed, PriceIdentifier, UnixTimestamp},
        std::{convert::TryFrom, time::Duration},
    };

    // Dummy contract address for testing.
    // For real deployments, see list of contract addresses here https://docs.pyth.network/documentation/pythnet-price-feeds/cosmwasm
    const PYTH_CONTRACT_ADDR: &str = "pyth_contract_addr";
    // For real deployments, see list of price feed ids here https://pyth.network/developers/price-feed-ids
    const PRICE_ID: &str = "63f341689d98a12ef60a5cff1d7f85c70a9e17bf1575f0e7c0b2512d48b1c8b3";

    fn default_state() -> State {
        State {
            pyth_contract_addr: Addr::unchecked(PYTH_CONTRACT_ADDR),
            price_feed_id: PriceIdentifier::from_hex(PRICE_ID).unwrap(),
        }
    }

    fn setup_test(
        state: &State,
        mock_pyth: &MockPyth,
        block_timestamp: UnixTimestamp,
    ) -> (OwnedDeps<MockStorage, MockApi, MockQuerier>, Env) {
        let mut dependencies = mock_dependencies();

        let mock_pyth_copy = (*mock_pyth).clone();
        dependencies
            .querier
            .update_wasm(move |x| handle_wasm_query(&mock_pyth_copy, x));

        STATE.save(dependencies.as_mut().storage, state).unwrap();

        let mut env = mock_env();
        env.block.time = Timestamp::from_seconds(u64::try_from(block_timestamp).unwrap());

        (dependencies, env)
    }

    // Create a handler like this in your test to handle pyth queries. If needed, other contracts
    // can be configured in this handler via additional cases.
    fn handle_wasm_query(pyth: &MockPyth, wasm_query: &WasmQuery) -> QuerierResult {
        match wasm_query {
            WasmQuery::Smart { contract_addr, msg } if *contract_addr == PYTH_CONTRACT_ADDR => {
                pyth.handle_wasm_query(msg)
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

    #[test]
    fn test_get_price() {
        // Arbitrary unix timestamp to coordinate the price feed timestamp and the block time.
        let current_unix_time = 10_000_000;

        let mut mock_pyth = MockPyth::new(Duration::from_secs(60), Coin::new(1, "foo"), &[]);
        let price_feed = PriceFeed::new(
            PriceIdentifier::from_hex(PRICE_ID).unwrap(),
            Price {
                price: 100,
                conf: 10,
                expo: -1,
                publish_time: current_unix_time,
            },
            Price {
                price: 200,
                conf: 20,
                expo: -1,
                publish_time: current_unix_time,
            },
        );

        mock_pyth.add_feed(price_feed);

        let (deps, env) = setup_test(&default_state(), &mock_pyth, current_unix_time);

        let msg = QueryMsg::FetchPrice {};
        let result = query(deps.as_ref(), env, msg)
            .and_then(|binary| from_binary::<FetchPriceResponse>(&binary));

        assert_eq!(result.map(|r| r.current_price.price), Ok(100));
    }

    #[test]
    fn test_query_fetch_valid_time_period() {
        // Arbitrary unix timestamp to coordinate the price feed timestamp and the block time.
        let current_unix_time = 10_000_000;

        let mock_pyth = MockPyth::new(Duration::from_secs(60), Coin::new(1, "foo"), &[]);
        let (deps, env) = setup_test(&default_state(), &mock_pyth, current_unix_time);

        let msg = QueryMsg::FetchValidTimePeriod {};
        let result =
            query(deps.as_ref(), env, msg).and_then(|binary| from_binary::<Duration>(&binary));

        assert_eq!(result.map(|r| r.as_secs()), Ok(60));
    }

    #[test]
    fn test_query_fetch_update_fee() {
        // Arbitrary unix timestamp to coordinate the price feed timestamp and the block time.
        let current_unix_time = 10_000_000;

        let mock_pyth = MockPyth::new(Duration::from_secs(60), Coin::new(1, "foo"), &[]);
        let (deps, env) = setup_test(&default_state(), &mock_pyth, current_unix_time);

        let msg = QueryMsg::FetchUpdateFee {
            vaas: vec![Binary(vec![1, 2, 3])],
        };
        let result = query(deps.as_ref(), env, msg).and_then(|binary| from_binary::<Coin>(&binary));
        assert_eq!(result.map(|r| r.to_string()), Ok(String::from("1foo")))
    }
}
