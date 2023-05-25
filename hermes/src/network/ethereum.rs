//! This module connects to Ethereum network to fetch the latest Wormhole Guardian set periodically
//! and sends the set to the store module for processing and storage. To have maximum security,
//! protocols should consider running their own Ethereum validator.
//!
//! We are not using ethers-rs because it has dependency conflict with our solana dependencies, and
//! the logic here is quite simple. The ABIs has been taken from the contract on Etherscan.
//!
//! TODO: We are polling the Ethereum network for the latest guardian set and this can cause a downtime
//! until the new guardian set is polled. We can instead subscribe to the contract events to get the
//! latest guardian set.

use {
    crate::store::Store,
    anyhow::{
        anyhow,
        Result,
    },
    ethabi::Function,
    reqwest::Client,
    std::{
        sync::Arc,
        time::Duration,
    },
    tokio::time::Instant,
    wormhole_sdk::GuardianAddress,
};

async fn query(
    rpc_endpoint: String,
    contract: String,
    method: Function,
    params: Vec<ethabi::Token>,
) -> Result<Vec<ethabi::Token>> {
    let client = Client::new();

    let res = client
        .post(rpc_endpoint.as_str())
        .json(&serde_json::json!({
            "method": "eth_call",
            "params": [
                {
                    "to": contract,
                    "data": "0x".to_owned() + hex::encode(method.encode_input(&params)?).as_str()
                },
                "latest"
            ],
            "id": 1,
            "jsonrpc": "2.0"
        }))
        .send()
        .await?;

    let res: serde_json::Value = res.json().await?;

    let res = res
        .get("result")
        .ok_or(anyhow!(
            "Invalid RPC Response, 'result' not found. {:?}",
            res
        ))?
        .as_str()
        .ok_or(anyhow!("Invalid result. {:?}", res))?;

    let res = hex::decode(&res[2..])?;
    let res = method.decode_output(&res)?;

    Ok(res)
}

async fn run(
    store: Arc<Store>,
    rpc_endpoint: String,
    wormhole_contract: String,
    polling_interval: Duration,
) -> Result<!> {
    loop {
        let get_current_index_method = serde_json::from_str::<Function>(
            r#"{"inputs":[],"name":"getCurrentGuardianSetIndex","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],
            "stateMutability":"view","type":"function"}"#,
        )?;

        let current_index = query(
            rpc_endpoint.clone(),
            wormhole_contract.clone(),
            get_current_index_method,
            vec![],
        )
        .await?;

        let current_index = match current_index.as_slice() {
            &[ethabi::Token::Uint(index)] => Ok(index),
            _ => Err(anyhow!(
                "Unexpected tokens {:?}. Expected a single uint",
                current_index
            )),
        }?;

        let get_guardian_set_method = serde_json::from_str::<Function>(
            r#"{"inputs":[{"internalType":"uint32","name":"index","type":"uint32"}],"name":"getGuardianSet",
            "outputs":[{"components":[{"internalType":"address[]","name":"keys","type":"address[]"},
            {"internalType":"uint32","name":"expirationTime","type":"uint32"}],"internalType":"struct Structs.GuardianSet",
            "name":"","type":"tuple"}],"stateMutability":"view","type":"function"}"#,
        )?;

        let guardian_set = query(
            rpc_endpoint.clone(),
            wormhole_contract.clone(),
            get_guardian_set_method,
            vec![ethabi::Token::Uint(current_index)],
        )
        .await?;

        let guardian_set = match guardian_set.as_slice() {
            [ethabi::Token::Tuple(guardian_set)] => Ok(guardian_set.clone()),
            _ => Err(anyhow!(
                "Unexpected tokens {:?}. Excepted a single tuple",
                guardian_set
            )),
        }?;

        let guardian_set = match guardian_set.as_slice() {
            [ethabi::Token::Array(guardian_set), _expiration_time] => Ok(guardian_set.clone()),
            _ => Err(anyhow!(
                "Unexpected tokens {:?}. Expected a tuple of (array, uint)",
                guardian_set
            )),
        }?;

        let guardian_set = guardian_set
            .into_iter()
            .map(|guardian| match guardian {
                ethabi::Token::Address(address) => Ok(address),
                _ => Err(anyhow!(
                    "Unexpected token {:?}. Expected a single address",
                    guardian
                )),
            })
            .collect::<Result<Vec<_>>>()?;

        log::info!("Guardian set: {:?}", guardian_set);

        let store = store.clone();
        tokio::spawn(async move {
            store
                .update_guardian_set(
                    guardian_set
                        .into_iter()
                        .map(|address| GuardianAddress(address.0))
                        .collect(),
                )
                .await;
        });

        tokio::time::sleep(polling_interval).await;
    }
}

pub async fn spawn(
    store: Arc<Store>,
    rpc_endpoint: String,
    wormhole_contract: String,
    polling_interval: Duration,
) -> Result<()> {
    tokio::spawn(async move {
        loop {
            let current_time = Instant::now();

            if let Err(ref e) = run(
                store.clone(),
                rpc_endpoint.clone(),
                wormhole_contract.clone(),
                polling_interval,
            )
            .await
            {
                log::error!("Error in Ethereum network listener: {:?}", e);
            }

            if current_time.elapsed() < Duration::from_secs(30) {
                log::error!("Ethereum network listener is restarting too quickly. Sleeping for 1s");
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    });

    Ok(())
}
