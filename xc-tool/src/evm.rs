use crate::util::ErrBox;

use ethers::prelude::*;

use ethers::providers::Http;

/// Query the Pyth contract's configuration from an EVM chain
pub async fn query_pyth_receiver_evm(_addr: Vec<u8>, rpc_url: String) -> Result<(), ErrBox> {

    let p = Provider::<Http>::try_from(rpc_url)?;

    Ok(())
}
