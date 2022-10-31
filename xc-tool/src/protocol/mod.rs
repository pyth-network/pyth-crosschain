//! Abstractions for the top-level designations of different blockchain types

use clap::ValueEnum;
use strum::EnumIter;

use crate::util::ErrBox;

#[derive(Debug, EnumIter, Eq, PartialEq)]
pub enum Protocol {
    Aptos,
    Ethereum,
    Solana,
    Terra
}

/// For most chains, we pick a production blockchain network and a
/// testing one, closely following Wormhole's choices. Additionally, a
/// local development network can be named
#[derive(Eq, PartialEq, ValueEnum, Clone)]
pub enum Net {
    Mainnet,
    Testnet,
    LocalDevnet,
}


/// The basic Chain abstraction. It provides info about contracts and
/// individual addresses generically. 
pub trait Chain<const NET: Net> {
    type Address;
    type ContractDetails;
    type AccountDetails; // Let's not clash with Solana's AccountInfo!
    fn get_contract(&self, addr: Self::Address) -> Result<Self::ContractDetails, ErrBox>; /// Retrieve chain-specific information about a contract on this chain.
    fn get_account(&self, addr: Self::Address) -> Result<Self::AccountDetails, ErrBox>;
}


/// The basic contract abstraction. It provides contract-specific config contents generically
pub trait Contract<const NET: Net, C: Chain<NET>> {
    type ContractConfig;
    type ContractUpgradeDetails;
    fn get_address() -> C::Address;
    fn get_config() -> Result<Self::ContractConfig, ErrBox>;
    fn set_config(cfg: Self::ContractConfig) -> Result<(), ErrBox>;
    fn upgrade(upgrade_details: Self::ContractUpgradeDetails) -> Result<(), ErrBox>;
}

pub struct EVMChain {
    rpc_url: String,
}

impl Chain<{Net::Testnet}> for EVMChain {
    type Address = [u8; 32];
    type ContractDetails = String;
    type AccountDetails = String;
    fn get_contract(&self, addr: Self::Address) -> Result<String, ErrBox> {
        Ok(format!("This is a mock contract at {:?} on {}", addr, self.rpc_url))
    }
    fn get_account(&self, addr: Self::Address) -> Result<String, ErrBox> {
        Ok(format!("This is a mock account at {:?} on {}", addr, self.rpc_url))
    }
}

