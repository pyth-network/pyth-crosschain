//! This module holds abstraction over mainnet/testnet/local-devnet networks

use clap::ValueEnum;
use ethers::types::H256;
use futures::future::FutureExt;
use serde::{Deserialize, Serialize};

use crate::{evm::EvmConfig, util::ErrBoxSend};

/// For most chains, we pick a production blockchain network and a
/// testing one, closely following Wormhole's choices. Additionally,
/// local devnets can be defined.
#[derive(ValueEnum, Clone, Debug)]
pub enum NetKind {
    Mainnet,
    Testnet,
    LocalDevnet,
}

/// Generic mainnet/testnet/local-devnet abstraction
pub trait NetworkConfig {
    fn get_chains_evm<'a>(&'a self) -> Vec<(&'static str, &'a EvmConfig)>;
    fn net_kind(&self) -> NetKind;
}


/// This struct is empty on purpose. This tool is in very early
/// development and it's too soon to be confident about it doing the
/// right thing in production.
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct MainnetConfig;

impl NetworkConfig for MainnetConfig {
    fn get_chains_evm<'a>(&'a self) -> Vec<(&'static str, &'a EvmConfig)> {
        vec![]
    }
    fn net_kind(&self) -> NetKind {
        NetKind::Mainnet
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct TestnetConfig {
    pub ethereum: EvmConfig,
    pub aurora: EvmConfig,
    pub bnb: EvmConfig,
}

impl NetworkConfig for TestnetConfig {
    fn get_chains_evm<'a>(&'a self) -> Vec<(&'static str, &'a EvmConfig)> {
        vec![
            ("Ethereum", &self.ethereum),
            ("Aurora", &self.aurora),
            ("BNB", &self.bnb),
        ]
    }
    fn net_kind(&self) -> NetKind {
        NetKind::Testnet
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct LocalDevnetConfig {
    pub ethereum: EvmConfig,
}

impl NetworkConfig for LocalDevnetConfig {
    fn get_chains_evm<'a>(&'a self) -> Vec<(&'static str, &'a EvmConfig)> {
        vec![("Ethereum", &self.ethereum)]
    }
    fn net_kind(&self) -> NetKind {
        NetKind::LocalDevnet
    }
}

// This would work well as a provided trait method, but async_trait is not very happy to do that
pub async fn ping_all_evm(nc: &dyn NetworkConfig) -> Result<(), ErrBoxSend> {
    let chains = nc.get_chains_evm();
    let futs = chains.iter().map(|(ch_name, ch_cfg)| {
        ch_cfg.ping().then(move |res| async move {
            match res {
                Ok(data_sources) => {
                    println!("{} Pyth receiver validDataSources():", ch_name);
                    for (idx, (chain_id, emitter_id)) in data_sources.iter().enumerate() {
                        let no = idx + 1;
                        println!(
                            "\t{}: chain {}, emitter {}",
                            no,
                            chain_id,
                            H256::from(emitter_id),
                        );
                    }

                    if data_sources.is_empty() {
                        println!("\t<none>");
                    }
                    Ok(())
                }
                Err(e) => {
                    println!(
                        "{} Pyth receiver data source ping FAIL:\n{}",
                        ch_name,
                        e.to_string()
                    );
                    Err(e)
                }
            }
        })
    });

    let _results = futures::future::try_join_all(futs).await?;

    Ok(())
}
