use alloy::{
    hex,
    network::EthereumWallet,
    node_bindings::Anvil,
    primitives::{keccak256, Bytes, FixedBytes},
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
    sol,
};
use benchmarks_keeper::{config::Config, run};
use eyre::Result;

pub const HERMES_URL: &str = "https://hermes.pyth.network";
const BTC_PRICE_ID: &str = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

sol! {
    #[allow(missing_docs)]
    #[sol(rpc, bytecode="6080604052348015600e575f5ffd5b506103728061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610029575f3560e01c8063de40a3531461002d575b5f5ffd5b61004760048036038101906100429190610183565b610049565b005b7f07a0232d1a4e15d55c752e5d811c5242c2eb2b0cb9023064ae5c64328d6eeb2085858585856040516100809594939291906102f5565b60405180910390a15050505050565b5f5ffd5b5f5ffd5b5f8160070b9050919050565b6100ac81610097565b81146100b6575f5ffd5b50565b5f813590506100c7816100a3565b92915050565b5f5ffd5b5f5ffd5b5f5ffd5b5f5f83601f8401126100ee576100ed6100cd565b5b8235905067ffffffffffffffff81111561010b5761010a6100d1565b5b602083019150836020820283011115610127576101266100d5565b5b9250929050565b5f5f83601f840112610143576101426100cd565b5b8235905067ffffffffffffffff8111156101605761015f6100d1565b5b60208301915083600182028301111561017c5761017b6100d5565b5b9250929050565b5f5f5f5f5f6060868803121561019c5761019b61008f565b5b5f6101a9888289016100b9565b955050602086013567ffffffffffffffff8111156101ca576101c9610093565b5b6101d6888289016100d9565b9450945050604086013567ffffffffffffffff8111156101f9576101f8610093565b5b6102058882890161012e565b92509250509295509295909350565b61021d81610097565b82525050565b5f82825260208201905092915050565b5f5ffd5b82818337505050565b5f61024b8385610223565b93507f07ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff83111561027e5761027d610233565b5b60208302925061028f838584610237565b82840190509392505050565b5f82825260208201905092915050565b828183375f83830152505050565b5f601f19601f8301169050919050565b5f6102d4838561029b565b93506102e18385846102ab565b6102ea836102b9565b840190509392505050565b5f6060820190506103085f830188610214565b818103602083015261031b818688610240565b905081810360408301526103308184866102c9565b9050969550505050505056fea2646970667358221220cfc69b7ea9350aff1253329f2b8b95bec13042890f71e9c8599878c07d538c0964736f6c634300081c0033")]
    contract PriceUpdater {
        event PriceUpdate(int64 publish_time, bytes32[] price_ids, bytes client_context);
        function emitPriceUpdate(int64 publish_time, bytes32[] calldata price_ids, bytes calldata client_context) external;
    }
}

#[tokio::test]
async fn test_price_update_events() -> Result<()> {
    // Spin up a local Anvil node
    let anvil = Anvil::new().block_time(1).try_spawn()?;
    let ws_endpoint = anvil.ws_endpoint_url().to_string();
    println!("ws_endpoint: {}", ws_endpoint);

    // sleep for 2 seconds to allow the keeper to start
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

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
        hermes_url: HERMES_URL.to_string(),
    };

    // Run the benchmarks keeper in a separate task
    let keeper_handle = tokio::spawn({
        let config = config.clone();
        async move { run(config).await }
    });

    // Emit a PriceUpdate event
    let publish_time = i64::from(1729513000);
    let price_ids: Vec<FixedBytes<32>> = vec![BTC_PRICE_ID]
        .into_iter()
        .map(|id_str| {
            let bytes = hex::decode(id_str).expect("Invalid hex string");
            assert_eq!(bytes.len(), 32, "Hex string must represent 32 bytes");
            FixedBytes::from_slice(&bytes)
        })
        .collect();
    let client_context = Bytes::from(vec![1, 2, 3, 4, 5]);
    let tx = contract.emitPriceUpdate(publish_time, price_ids.clone(), client_context.clone());
    match tx.send().await {
        Ok(pending_tx) => {
            let receipt = pending_tx.get_receipt().await?;

            // Check if the event was emitted
            let event_signature = keccak256("PriceUpdate(int64,bytes32[],bytes)");
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

    assert!(false);

    // TODO: Assert the events are correct

    Ok(())
}
