module pyth::governance_action {
    use pyth::error;

    const CONTRACT_UPGRADE: u8 = 0;
    const SET_GOVERNANCE_DATA_SOURCE: u8 = 1;
    const SET_DATA_SOURCES: u8 = 2;
    const SET_UPDATE_FEE: u8 = 3;
    const SET_STALE_PRICE_THRESHOLD: u8 = 4;

    struct GovernanceAction has copy, drop {
        value: u8,
    }

    #[lint::skip(unnecessary_numerical_extreme_comparison)]
    public fun from_u8(value: u8): GovernanceAction {
        assert!(CONTRACT_UPGRADE <= value && value <= SET_STALE_PRICE_THRESHOLD, error::invalid_governance_action());
        GovernanceAction { value }
    }

    public fun new_contract_upgrade(): GovernanceAction {
        GovernanceAction { value: CONTRACT_UPGRADE }
    }

    public fun new_set_governance_data_source(): GovernanceAction {
        GovernanceAction { value: SET_GOVERNANCE_DATA_SOURCE }
    }

    public fun new_set_data_sources(): GovernanceAction {
        GovernanceAction { value: SET_DATA_SOURCES }
    }

    public fun new_set_update_fee(): GovernanceAction {
        GovernanceAction { value: SET_UPDATE_FEE }
    }

    public fun new_set_stale_price_threshold(): GovernanceAction {
        GovernanceAction { value: SET_STALE_PRICE_THRESHOLD }
    }
}
