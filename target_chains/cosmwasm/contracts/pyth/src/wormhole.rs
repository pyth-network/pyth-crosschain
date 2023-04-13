// These types are copied from the Wormhole contract. See the links with each type to see the original code
// The reason to do so was dependency conflict. Wormhole contracts were using a very old version of a dependency
// which is not compatible with the one used by osmosis-sdk. And since we weren't using anything else from
// the Wormhole contract the types are moved here.

use {
    cosmwasm_std::Binary,
    schemars::JsonSchema,
    serde::{
        Deserialize,
        Serialize,
    },
};

type HumanAddr = String;

// This type is copied from
// https://github.com/wormhole-foundation/wormhole/blob/main/cosmwasm/contracts/wormhole/src/state.rs#L75
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


// The type is copied from
// https://github.com/wormhole-foundation/wormhole/blob/main/cosmwasm/contracts/wormhole/src/msg.rs#L37
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum WormholeQueryMsg {
    GuardianSetInfo {},
    VerifyVAA { vaa: Binary, block_time: u64 },
    GetState {},
    QueryAddressHex { address: HumanAddr },
}
