use alloy::{
    network::EthereumWallet,
    node_bindings::Anvil,
    primitives::{keccak256, Bytes, FixedBytes, U256},
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
    sol,
};
use benchmarks_keeper::{config::Config, run};
use eyre::Result;

sol! {
    #[allow(missing_docs)]
    #[sol(rpc, bytecode="6080604052348015600e575f5ffd5b5061021c8061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610029575f3560e01c806324bc28721461002d575b5f5ffd5b61004061003b3660046100cd565b610042565b005b7fea6087dafb6d127da18a7efbde783b637e5c563c484625a08baea861c0e1126f8585858585604051610079959493929190610178565b60405180910390a15050505050565b5f5f83601f840112610098575f5ffd5b50813567ffffffffffffffff8111156100af575f5ffd5b6020830191508360208285010111156100c6575f5ffd5b9250929050565b5f5f5f5f5f606086880312156100e1575f5ffd5b85359450602086013567ffffffffffffffff8111156100fe575f5ffd5b8601601f8101881361010e575f5ffd5b803567ffffffffffffffff811115610124575f5ffd5b8860208260051b8401011115610138575f5ffd5b60209190910194509250604086013567ffffffffffffffff81111561015b575f5ffd5b61016788828901610088565b969995985093965092949392505050565b85815260606020820181905281018490525f6001600160fb1b0385111561019d575f5ffd5b8460051b808760808501378201828103608090810160408501528101849052838560a08301375f60a0828601810191909152601f909401601f191601909201969550505050505056fea2646970667358221220ec4c42d1ad8911b34a9c08d18645330581e77c9ac53379fb226ecf35ae9cbb7e64736f6c634300081c0033")]
    contract PriceUpdater {
        event PriceUpdate(uint256 publish_time, bytes32[] price_ids, bytes metadata);
        function emitPriceUpdate(uint256 publish_time, bytes32[] calldata price_ids, bytes calldata metadata) external;
    }
}

#[tokio::test]
async fn test_price_update_events() -> Result<()> {
    // Spin up a local Anvil node
    let anvil = Anvil::new().block_time(1).try_spawn()?;
    let ws_endpoint = anvil.ws_endpoint_url().to_string();
    println!("ws_endpoint: {}", ws_endpoint);

    // sleep for 10 seconds to allow the keeper to start
    tokio::time::sleep(std::time::Duration::from_secs(10)).await;

    // Set up signer from the first default Anvil account
    let signer: PrivateKeySigner = anvil.keys()[0].clone().into();
    let wallet = EthereumWallet::from(signer.clone());

    // Set up the provider
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_http(anvil.endpoint_url());

    // Deploy the contract
    let contract = match PriceUpdater::deploy(provider.clone()).await {
        Ok(contract) => {
            println!("Contract deployed successfully at: {}", contract.address());
            contract
        }
        Err(e) => {
            eprintln!("Failed to deploy contract: {:?}", e);
            return Err(e.into());
        }
    };

    // Create a config for the benchmarks keeper
    let config = Config {
        rpc_url: ws_endpoint,
        contract_address: *contract.address(),
    };

    // Run the benchmarks keeper in a separate task
    let keeper_handle = tokio::spawn({
        let config = config.clone();
        async move { run(config).await }
    });

    // Emit a PriceUpdate event
    let publish_time = U256::from(1634567890);
    let price_ids: Vec<FixedBytes<32>> = vec![1u64, 2u64, 3u64]
        .into_iter()
        .map(|n| {
            let mut bytes = [0u8; 32];
            bytes[24..].copy_from_slice(&n.to_be_bytes());
            FixedBytes::from(bytes)
        })
        .collect();
    let metadata = Bytes::from(vec![1, 2, 3, 4, 5]);
    let tx = contract.emitPriceUpdate(publish_time, price_ids.clone(), metadata.clone());
    match tx.send().await {
        Ok(pending_tx) => {
            let receipt = pending_tx.get_receipt().await?;

            // Check if the event was emitted
            let event_signature = keccak256("PriceUpdate(uint256,bytes32[],bytes)");
            let event_emitted = receipt.inner.logs().iter().any(|log| {
                log.topics()
                    .get(0)
                    .map_or(false, |topic| topic.as_slice() == event_signature)
            });

            if event_emitted {
                println!("PriceUpdate event was successfully emitted");
            } else {
                eprintln!("PriceUpdate event was not found in the transaction logs");
                return Err(eyre::eyre!("PriceUpdate event not emitted"));
            }
        }
        Err(e) => {
            eprintln!("Failed to send transaction: {:?}", e);
            return Err(e.into());
        }
    }

    // Wait for the event to be processed
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // Stop the keeper
    keeper_handle.abort();

    // TODO: Assert the events are correct

    Ok(())
}
