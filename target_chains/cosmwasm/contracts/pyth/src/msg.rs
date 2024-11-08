use {crate::state::PythDataSource, cosmwasm_schema::cw_serde, cosmwasm_std::Coin};

// cw_serde attribute is equivalent to
// #[derive(Serialize, Deserialize, PartialEq, Debug, Clone, JsonSchema)]
// #[serde(rename_all = "snake_case")]

type HumanAddr = String;

#[cw_serde]
pub struct InstantiateMsg {
    pub wormhole_contract: HumanAddr,
    pub data_sources: Vec<PythDataSource>,

    pub governance_source: PythDataSource,
    pub governance_source_index: u32,
    pub governance_sequence_number: u64,

    pub chain_id: u16,
    pub valid_time_period_secs: u16,

    pub fee: Coin,
}

#[derive(Eq)]
#[cw_serde]
pub struct MigrateMsg {}
