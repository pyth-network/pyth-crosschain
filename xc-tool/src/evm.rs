use crate::util::ErrBoxSend;

use ethers::{
    abi::Abi,
    contract::Contract,
    prelude::{Http, Provider},
    types::{Address as EvmAddress},
};
use serde::{Deserialize, Serialize};

pub static PYTH_RECEIVER_ABI_JSON: &'static str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../ethereum/build/contracts/PythUpgradable.json"
));

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct EvmConfig {
    pub rpc_url: String,
    pub target_chain_contract: EvmAddress,
}

impl EvmConfig {
    /// The pinging method of choice is listing all valid data sources on all target chains
    pub async fn ping(&self) -> Result<Vec<(u32, [u8; 32])>, ErrBoxSend> {
        Ok(self.get_pyth_receiver_data_sources().await?)
    }

    /// List all currently set data sources on-chain
    pub async fn get_pyth_receiver_data_sources(&self) -> Result<Vec<(u32, [u8; 32])>, ErrBoxSend> {
        let client = Provider::<Http>::try_from(&self.rpc_url)
            .map_err(|e| -> ErrBoxSend { e.to_string().into() })?;
        let mut json_value: serde_json::Map<String, serde_json::Value> =
            serde_json::from_str(PYTH_RECEIVER_ABI_JSON)?;
        let abi: Abi = serde_json::from_value(
            json_value
                .remove_entry("abi") // Takes by value as opposed to reference from get(). Needed for `from_value`
                .ok_or_else(|| -> ErrBoxSend {
                    "Could not find 'abi' key in EVM ABI JSON"
                        .to_string()
                        .into()
                })?
                .1,
        )?;
        let c = Contract::new(self.target_chain_contract, abi, client);

        Ok(c.method::<_, Vec<(u32, [u8; 32])>>("validDataSources", ())?
            .call()
            .await?)
    }
}
