mod config;
mod hermes_client;
mod price_fetcher;
mod sdk;

use std::{sync::Arc, time::Duration};

use alloy::{
    network::{Ethereum, EthereumWallet},
    primitives::{address, Bytes},
    providers::{self, Provider},
    rpc::types::Filter,
    signers::{k256::ecdsa::SigningKey, local::LocalSigner},
    sol_types::SolEvent,
};
use config::{Config, HermesConfig};
use futures::{future::pending, StreamExt, TryStreamExt};
use hermes_client::HermesClient;
use log::{info, warn};
use price_fetcher::{PriceFetcher, PriceRequest};
use sdk::DelayedPythPriceReceiver::{self, RequestPythPrice};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // TODO: default to info, json, config
    env_logger::init();
    info!("started");

    let config = Config {
        contract_address: address!("5FbDB2315678afecb367f032d93F642f64180aa3"),
        hermes: HermesConfig {
            endpoint: "https://hermes.pyth.network/".parse()?,
            single_request_timeout: Duration::from_secs(10),
            total_retry_timeout: Duration::from_secs(30),
            stream_progress_timeout: Duration::from_secs(10),
            stream_disconnect_delay: Duration::from_secs(10),
        },
    };
    if false {
        let client = HermesClient::new(config.hermes.clone());

        let r = client
            .price_at(
                "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
                1726850340,
            )
            .await?;
        println!("OK {:?}", r);

        let mut stream = client
            .fetch_updates("0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43")
            .await?;
        while let Some(item) = stream.try_next().await? {
            println!("chunk {:?}", item);
        }
        return Ok(());
    }

    if true {
        let (f, mut responses) = PriceFetcher::new(
            "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
            config.clone(),
            Arc::new(HermesClient::new(config.hermes)),
        );
        f.handle(PriceRequest {
            price_feed_id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
                .into(),
            timestamp: 1729590018,
            context: [1, 2, 3].into(),
        })
        .await;
        while let Some(item) = responses.recv().await {
            info!("response: {item:?}");
        }
        pending::<()>().await;
    }

    let signer = LocalSigner::from_signing_key(SigningKey::from_slice(&hex::decode(
        "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    )?)?);
    let wallet = EthereumWallet::from(signer);

    let provider = providers::builder::<Ethereum>()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_builtin("http://127.0.0.1:8545/")
        .await?;
    let address = address!("5FbDB2315678afecb367f032d93F642f64180aa3");

    let contract = DelayedPythPriceReceiver::new(address, &provider);

    let filter = Filter::new()
        .address(address)
        .event(RequestPythPrice::SIGNATURE);

    // println!(
    //     "initial logs: {:#?}",
    //     provider.get_logs(&filter.clone().from_block(0)).await?
    // );
    let poller = provider.watch_logs(&filter).await?;
    let mut stream = poller.into_stream();
    while let Some(logs) = stream.next().await {
        if logs.is_empty() {
            continue;
        }
        println!("new logs: {logs:#?}");
        for log in logs {
            match log.log_decode::<RequestPythPrice>() {
                Ok(log) => {
                    println!("decoded: {:?}", log.data());

                    let call =
                        contract.notifyPythPrice(Bytes::from(&[0, 1, 2]), Bytes::from(&[3, 4, 5]));
                    let tx = call.send().await?;
                    println!("sent tx: {}", tx.tx_hash());
                    tx.with_required_confirmations(1)
                        .with_timeout(Some(std::time::Duration::from_secs(60)))
                        .watch()
                        .await?;
                    println!("confirmed tx!");
                }
                Err(err) => {
                    warn!("failed to decode event: {:?}; log: {:?}", err, log);
                }
            }
            // let data = &log.inner.data.data;
            // if data.len() < 64 {
            //     warn!(
            //         "expected event data with at least 64 bytes, got {}",
            //         data.len()
            //     );
            // }
            // let price_feed_id = U256::from_be_slice(&data[0..32]);
            // let delay_seconds = U256::from_be_slice(&data[32..64]);
            // println!("price_feed_id={price_feed_id}");
            // println!("delay_seconds={delay_seconds}");
        }
    }
    Ok(())
}

// 0x00a5ebB10DC797CAC828524e59A333d0A371443c3Aa5ebB10DC797CAC828524e59A333d0A3710001

// 0x0000000000000000000000000000000000000000000000000000000000000060
//   0000000000000000000000000000000000000000000000000000000000000002
//   0000000000000000000000000000000000000000000000000000000000000003
//   0000000000000000000000000000000000000000000000000000000000000028
//   00a5ebb10dc797cac828524e59a333d0a371443c3aa5ebb10dc797cac828524e
//   59a333d0a3710001000000000000000000000000000000000000000000000000
