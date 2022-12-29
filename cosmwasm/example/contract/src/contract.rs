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
        PriceFeed,
        PriceFeedResponse,
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
    // Save general wormhole and pyth info
    let state = ConfigInfo {
        pyth_contract:   msg.pyth_contract,
        price_feed_id:   msg.price_feed_id,
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
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        // user wants to purchase `quantity` of the token. They need to pay
        QueryMsg::GetPrice { quantity } => {
            let cfg = config_read(deps.storage).load()?;
            let price_in_usd: Price = Price {
                price: i64::from(quantity) * i64::from(cfg.price_in_usd),
                conf:  0,
                expo:  0,
            };

            let feed = read_pyth_price(&deps, &env)?;
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

pub fn read_pyth_price(deps: &Deps, _env: &Env) -> StdResult<PriceFeed> {
    let cfg = config_read(deps.storage).load()?;
    query_price_feed(&deps.querier, cfg.pyth_contract, cfg.price_feed_id).map(|r| r.price_feed)
}

#[cfg(test)]
mod test {
    use {
        super::*,
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
            ContractResult,
            OwnedDeps,
            QuerierResult,
            SystemError,
            SystemResult,
        },
        p2w_sdk::PriceStatus,
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
        let mut dependencies = mock_dependencies();
        dependencies.querier.update_wasm(handle_wasm_query);

        let mut config = config(dependencies.as_mut().storage);
        config.save(config_info).unwrap();
        (dependencies, mock_env())
    }

    fn handle_wasm_query(wasm_query: &WasmQuery) -> QuerierResult {
        match wasm_query {
            WasmQuery::Smart { contract_addr, msg } if *contract_addr == PYTH_CONTRACT_ADDR => {
                let query_msg = from_binary::<pyth_sdk_cw::QueryMsg>(msg);
                match query_msg {
                    Ok(pyth_sdk_cw::QueryMsg::PriceFeed { id }) => {
                        if id.to_hex() == PRICE_ID {
                            let price_feed = PriceFeed::new(
                                id,
                                PriceStatus::Trading,
                                100,
                                -2,
                                32,
                                3,
                                id,
                                100 * 100,
                                100,
                                75 * 100,
                                100,
                                99 * 100,
                                100,
                                99,
                            );

                            SystemResult::Ok(ContractResult::Ok(
                                to_binary(&PriceFeedResponse { price_feed }).unwrap(),
                            ))
                        } else {
                            SystemResult::Ok(ContractResult::Err("unknown price feed".into()))
                        }
                    }
                    Err(_e) => SystemResult::Err(SystemError::InvalidRequest {
                        error:   "Invalid message".into(),
                        request: msg.clone(),
                    }),
                    // TODO: this error isn't right
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
