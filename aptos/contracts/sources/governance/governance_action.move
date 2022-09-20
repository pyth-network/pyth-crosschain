module pyth::governance_action {
    const CONTRACT_UPGRADE: u8 = 0;
    const SET_GOVERNANCE_DATA_SOURCE: u8 = 1;
    const SET_DATA_SOURCES: u8 = 2;
    const SET_UPDATE_FEE: u8 = 3;
    const SET_STALE_PRICE_THRESHOLD: u8 = 4;

    struct Action {
        value: u8,
    }

    public fun new_contract_upgrade(): Action {
        Action { value: CONTRACT_UPGRADE }
    }

    public fun new_set_governance_data_source(): Action {
        Action { value: SET_GOVERNANCE_DATA_SOURCE }
    }

    public fun new_set_data_sources(): Action {
        Action { value: SET_DATA_SOURCES }
    }

    public fun new_set_update_fee(): Action {
        Action { value: SET_UPDATE_FEE }
    }

    public fun new_set_stale_price_threshold(): Action {
        Action { value: SET_STALE_PRICE_THRESHOLD }
    }

    public fun destroy(action: Action): u8 {
        let Action { value } = action;
        value
    }
}
