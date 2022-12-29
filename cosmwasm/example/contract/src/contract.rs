use {
    crate::{
        msg::{
            ExecuteMsg,
            GetPriceResponse,
            InstantiateMsg,
            MigrateMsg,
            QueryMsg,
        },
        state::{
            config,
            config_read,
            ConfigInfo,
        },
    },
    cosmwasm_std::{
        entry_point,
        to_binary,
        Binary,
        Deps,
        DepsMut,
        Env,
        MessageInfo,
        Response,
        StdError::{self,},
        StdResult,
        WasmQuery,
    },
    pyth_sdk_cw::{
        query_price_feed,
        Price,
        PriceIdentifier,
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
    let state = ConfigInfo {
        // Store the pyth contract address and the id of the desired price feed in the config.
        // These fields will be used to query the pyth contract when we need the price.
        pyth_contract: msg.pyth_contract,
        price_feed_id: msg.price_feed_id,

        // TODO: fix the docs
        // Store the price of the token in usd.
        price_in_usd:    msg.price_in_usd,
        target_exponent: msg.target_exponent,
    };
    config(deps.storage).save(&state)?;

    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    _deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    _msg: ExecuteMsg,
) -> StdResult<Response> {
    // TODO
    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        // user wants to purchase `quantity` of the token. They need to pay
        QueryMsg::GetPrice { quantity } => {
            let cfg = config_read(deps.storage).load()?;
            let price_in_usd: Price = Price {
                price: i64::from(quantity) * i64::from(cfg.price_in_usd),
                conf:  0,
                expo:  0,
            };

            // Call the query_price_feed function from the Pyth SDK to get the current value of the
            // configured price feed.
            // FIXME: this function on the sdk needs some &'s to prevent copying
            let feed =
                query_price_feed(&deps.querier, cfg.pyth_contract.clone(), cfg.price_feed_id)?
                    .price_feed;

            // Value of token in USD, e.g, 1BTC = $10k
            let current_token_price = feed
                .get_current_price()
                .ok_or(StdError::generic_err("feed is not current"))?;

            // Price struct supports nice arithmetic
            let price_in_payment_token = price_in_usd
                .div(&current_token_price)
                .and_then(|p| p.scale_to_exponent(cfg.target_exponent))
                .ok_or(StdError::generic_err("division error"))?;

            to_binary(&GetPriceResponse {
                price:    price_in_payment_token.price,
                exponent: price_in_payment_token.expo,
            })
        }
    }
}

#[cfg(test)]
mod test {
    use {
        super::*,
        crate::test_utils::{
            make_feed,
            MockPyth,
        },
        cosmwasm_std::{
            from_binary,
            testing::{
                mock_dependencies,
                mock_env,
                MockApi,
                MockQuerier,
                MockStorage,
            },
            Addr,
            OwnedDeps,
            QuerierResult,
            SystemError,
            SystemResult,
        },
    };

    // TODO: point to documentation
    const PYTH_CONTRACT_ADDR: &str = "pyth_contract_addr";
    // See list of price feed ids here https://pyth.network/developers/price-feed-ids
    const PRICE_ID: &str = "63f341689d98a12ef60a5cff1d7f85c70a9e17bf1575f0e7c0b2512d48b1c8b3";

    fn default_emitter_addr() -> Vec<u8> {
        vec![0, 1, 80]
    }

    fn default_config_info() -> ConfigInfo {
        ConfigInfo {
            pyth_contract:   Addr::unchecked(PYTH_CONTRACT_ADDR),
            price_feed_id:   PriceIdentifier::from_hex(PRICE_ID).unwrap(),
            price_in_usd:    10,
            target_exponent: -2,
        }
    }

    fn setup_test(config_info: &ConfigInfo) -> (OwnedDeps<MockStorage, MockApi, MockQuerier>, Env) {
        let mock_pyth = MockPyth::new(&[make_feed(
            PriceIdentifier::from_hex(PRICE_ID).unwrap(),
        )]);

        let mut dependencies = mock_dependencies();
        dependencies
            .querier
            .update_wasm(move |x| handle_wasm_query(&mock_pyth, x));

        let mut config = config(dependencies.as_mut().storage);
        config.save(config_info).unwrap();
        (dependencies, mock_env())
    }


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

    fn query_get_price(config_info: &ConfigInfo, quantity: u32) -> StdResult<GetPriceResponse> {
        let (mut deps, env) = setup_test(config_info);
        config(&mut deps.storage).save(config_info).unwrap();

        let msg = QueryMsg::GetPrice { quantity };

        query(deps.as_ref(), env, msg).and_then(|binary| from_binary::<GetPriceResponse>(&binary))
    }

    #[test]
    fn test_get_price() {
        let result = query_get_price(&default_config_info(), 100);
        assert_eq!(result.map(|r| r.price), Ok(1000));
    }
}
