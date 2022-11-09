//! This module houses the file-based config

use serde::{Deserialize, Serialize};

use crate::{
    evm::EvmConfig,
    network::{LocalDevnetConfig, MainnetConfig, TestnetConfig},
};

/// Top-level configuration struct. It contains many nested
/// members. See the `Default` implementation for full overview of the
/// hierarchy.
#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(default)]
pub struct ConfigSchema {
    /// Flag to mark whether config diverges from defaults, enforced
    /// in runtime
    pub is_tainted: bool,
    pub mainnet: MainnetConfig,
    pub testnet: TestnetConfig,
    pub local_devnet: LocalDevnetConfig,
}

impl Default for ConfigSchema {
    fn default() -> Self {
        Self {
            is_tainted: false,
            mainnet: MainnetConfig,
            testnet: TestnetConfig {
                ethereum: EvmConfig {
                    rpc_url: "https://rpc.goerli.mudit.blog/".to_owned(),
                    target_chain_contract: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C"
                        .parse()
                        .unwrap(),
                },
                aurora: EvmConfig {
                    rpc_url: "https://testnet.aurora.dev".to_owned(),
                    target_chain_contract: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6"
                        .parse()
                        .unwrap(),
                },
                bnb: EvmConfig {
                    rpc_url: "https://bsctestapi.terminet.io/rpc".to_owned(),
                    target_chain_contract: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA"
                        .parse()
                        .unwrap(),
                },
            },
            local_devnet: LocalDevnetConfig {
                ethereum: EvmConfig {
                    rpc_url: "http://localhost:8545".to_owned(),
                    target_chain_contract: "0xe982E462b094850F12AF94d21D470e21bE9D0E9C"
                        .parse()
                        .unwrap(),
                },
            },
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::util::ErrBoxSend;
    #[test]
    /// Some of the defaults unwrap a const parse() result, let's make
    /// sure they don't crash and handle a null config gracefully.
    fn test_defaults_dont_panic() -> Result<(), ErrBoxSend> {
        let _c: ConfigSchema = serde_yaml::from_str("")?;
        Ok(())
    }

    #[test]
    /// Make sure the custom serialization is symmetrical and can be
    /// understood by deserialization code.
    fn test_sanity_serde() -> Result<(), ErrBoxSend> {
        let c: ConfigSchema = Default::default();

        let serialized = serde_yaml::to_string(&c)?;
        let c2: ConfigSchema = serde_yaml::from_str(&serialized)?;
        assert_eq!(c2, c);

        Ok(())
    }
}
