use crate::util::ErrBox;

use ethers::{
    abi::Abi,
    contract::Contract,
    prelude::{JsonRpcClient, Provider},
    types::Address,
};

pub static PYTH_RECEIVER_ABI_JSON: &'static str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../ethereum/build/contracts/PythUpgradable.json"
));

pub async fn query_pyth_receiver_evm<C: JsonRpcClient + 'static>(
    client: Provider<C>,
    addr: Address,
) -> Result<(), ErrBox> {
    let mut json_value: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(PYTH_RECEIVER_ABI_JSON)?;
    let abi: Abi = serde_json::from_value(
        json_value
            .remove_entry("abi") // Takes by value as opposed to reference from get(). Needed for `from_value`
            .ok_or_else(|| -> ErrBox {
                "Could not find 'abi' key in EVM ABI JSON"
                    .to_string()
                    .into()
            })?
            .1,
    )?;
    let c = Contract::new(addr, abi, client);

    let data_sources = c.method::<_, Vec<(u32, [u8; 32])>>("validDataSources", ())?.call().await?;

    println!("EVM data sources for {}:", addr);

    for (idx, (chain, emitter)) in data_sources.iter().enumerate() {
        let no = idx + 1;
        println!("Data Source {}: source chain 0x{:02x}, emitter {}", no, chain, ethers::types::H256::from(emitter));
    }

    Ok(())
}
