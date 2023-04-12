use {
    cosmwasm_std::Binary,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
};

type HumanAddr = String;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct ParsedVAA {
    pub version:            u8,
    pub guardian_set_index: u32,
    pub timestamp:          u32,
    pub nonce:              u32,
    pub len_signers:        u8,

    pub emitter_chain:     u16,
    pub emitter_address:   Vec<u8>,
    pub sequence:          u64,
    pub consistency_level: u8,
    pub payload:           Vec<u8>,

    pub hash: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WormholeQueryMsg {
    GuardianSetInfo {},
    VerifyVAA { vaa: Binary, block_time: u64 },
    GetState {},
    QueryAddressHex { address: HumanAddr },
}
