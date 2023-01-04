use {
    near_sdk::json_types::U128,
    p2w_sdk::{
        BatchPriceAttestation,
        Identifier,
        PriceAttestation,
        PriceStatus,
    },
    pyth::{
        governance::{
            GovernanceAction,
            GovernanceInstruction,
            GovernanceModule,
        },
        state::{
            Chain,
            Price,
            PriceIdentifier,
            Source,
        },
    },
    serde_json::json,
    std::io::{
        Cursor,
        Write,
    },
    wormhole::Chain as WormholeChain,
};

async fn initialize_chain() -> (
    workspaces::Worker<workspaces::network::Sandbox>,
    workspaces::Contract,
    workspaces::Contract,
) {
    let worker = workspaces::sandbox().await.expect("Workspaces Failed");

    // Deploy Pyth
    let contract = worker
        .dev_deploy(&std::fs::read("pyth.wasm").expect("Failed to find pyth.wasm"))
        .await
        .expect("Failed to deploy pyth.wasm");

    // Deploy Wormhole Stub, this is a dummy contract that always verifies VAA's correctly so we
    // can test the ext_wormhole API.
    let wormhole = worker
        .dev_deploy(
            &std::fs::read("wormhole_stub.wasm").expect("Failed to find wormhole_stub.wasm"),
        )
        .await
        .expect("Failed to deploy wormhole_stub.wasm");

    // Initialize Wormhole.
    wormhole
        .call("new")
        .args_json(&json!({}))
        .gas(300_000_000_000_000)
        .transact()
        .await
        .expect("Failed to initialize Wormhole")
        .unwrap();

    // Initialize Pyth, one time operation that sets the Wormhole contract address.
    let codehash = [0u8; 32];

    contract
        .call("new")
        .args_json(&json!({
            "wormhole":        wormhole.id(),
            "codehash":        codehash,
            "initial_source":  Source::default(),
            "gov_source":      Source::default(),
            "update_fee":      U128::from(1u128),
            "stale_threshold": 32,
        }))
        .gas(300_000_000_000_000)
        .transact()
        .await
        .expect("Failed to initialize Pyth")
        .unwrap();

    (worker, contract, wormhole)
}

#[tokio::test]
async fn test_source_add() {
    let (_, contract, _) = initialize_chain().await;

    // Submit a new Source to the contract, this will trigger a cross-contract call to wormhole
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        sequence: 1,
        payload: (),
        ..Default::default()
    };

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
        cur.write_all(
            &GovernanceInstruction {
                target: Chain::from(WormholeChain::Any),
                module: GovernanceModule::Target,
                action: GovernanceAction::SetDataSources {
                    data_sources: vec![
                        Source::default(),
                        Source {
                            emitter: [1; 32],
                            chain:   Chain::from(WormholeChain::Solana),
                        },
                    ],
                },
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // There should now be a two sources in the contract state.
    assert_eq!(
        serde_json::from_slice::<Vec<Source>>(&contract.view("get_sources").await.unwrap().result)
            .unwrap(),
        &[
            Source::default(),
            Source {
                emitter: [1; 32],
                chain:   Chain::from(WormholeChain::Solana),
            },
        ]
    );
}

#[tokio::test]
async fn test_set_governance_source() {
    let (_, contract, _) = initialize_chain().await;

    // Submit a new Source to the contract, this will trigger a cross-contract call to wormhole
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        payload: (),
        sequence: 1,
        ..Default::default()
    };

    let vaa = {
        // Data Source Upgrades are submitted with an embedded VAA, generate that one here first
        // before we embed it.
        let vaa = {
            let mut cur = Cursor::new(Vec::new());
            serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
            cur.write_all(
                &GovernanceInstruction {
                    target: Chain::from(WormholeChain::Near),
                    module: GovernanceModule::Target,
                    action: GovernanceAction::RequestGovernanceDataSourceTransfer {
                        governance_data_source_index: 1,
                    },
                }
                .serialize()
                .unwrap(),
            )
            .expect("Failed to write Payload");
            cur.into_inner()
        };

        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
        cur.write_all(
            &GovernanceInstruction {
                target: Chain::from(WormholeChain::Near),
                module: GovernanceModule::Target,
                action: GovernanceAction::AuthorizeGovernanceDataSourceTransfer { claim_vaa: vaa },
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // An action from the new source should now be accepted.
    let vaa = wormhole::Vaa {
        sequence: 2, // NOTE: Incremented Governance Sequence
        emitter_chain: wormhole::Chain::Solana,
        emitter_address: wormhole::Address([1; 32]),
        payload: (),
        ..Default::default()
    };

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
        cur.write_all(
            &GovernanceInstruction {
                target: Chain::from(WormholeChain::Near),
                module: GovernanceModule::Target,
                action: GovernanceAction::SetDataSources {
                    data_sources: vec![
                        Source::default(),
                        Source {
                            emitter: [2; 32],
                            chain:   Chain::from(WormholeChain::Solana),
                        },
                    ],
                },
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // But not from the old source.
    let vaa = wormhole::Vaa {
        sequence: 3, // NOTE: Incremented Governance Sequence
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        payload: (),
        ..Default::default()
    };

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
        cur.write_all(
            &GovernanceInstruction {
                target: Chain::from(WormholeChain::Near),
                module: GovernanceModule::Target,
                action: GovernanceAction::SetDataSources {
                    data_sources: vec![
                        Source::default(),
                        Source {
                            emitter: [2; 32],
                            chain:   Chain::from(WormholeChain::Solana),
                        },
                    ],
                },
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    assert!(!contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_failure());
}

#[tokio::test]
async fn test_stale_threshold() {
    let (_, contract, _) = initialize_chain().await;

    // Submit a Price Attestation to the contract.
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        payload: (),
        sequence: 1,
        ..Default::default()
    };

    // Get current UNIX timestamp and subtract a minute from it to place the price attestation in
    // the past. This should be accepted but untrusted.
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Failed to get UNIX timestamp")
        .as_secs()
        - 60;

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
        cur.write_all(
            &BatchPriceAttestation {
                price_attestations: vec![PriceAttestation {
                    product_id:         Identifier::default(),
                    price_id:           Identifier::default(),
                    price:              100,
                    conf:               1,
                    expo:               8,
                    ema_price:          100,
                    ema_conf:           1,
                    status:             PriceStatus::Trading,
                    num_publishers:     8,
                    max_num_publishers: 8,
                    attestation_time:   now.try_into().unwrap(),
                    publish_time:       now.try_into().unwrap(),
                    prev_publish_time:  now.try_into().unwrap(),
                    prev_price:         100,
                    prev_conf:          1,
                }],
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    let update_fee = serde_json::from_slice::<U128>(
        &contract
            .view("get_update_fee_estimate")
            .args(vec![])
            .await
            .unwrap()
            .result,
    )
    .unwrap();

    assert!(contract
        .call("update_price_feed")
        .gas(300_000_000_000_000)
        .deposit(update_fee.into())
        .args_json(&json!({
            "vaa_hex": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // Assert Price cannot be requested, 60 seconds in the past should be considered stale.
    // [tag:failed_price_check]
    assert_eq!(
        None,
        serde_json::from_slice::<Option<Price>>(
            &contract
                .view("get_price")
                .args_json(&json!({ "price_identifier": PriceIdentifier([0; 32]) }))
                .await
                .unwrap()
                .result
        )
        .unwrap(),
    );

    // Submit another Price Attestation to the contract with an even older timestamp.
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        sequence: 2,
        payload: (),
        ..Default::default()
    };

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
        cur.write_all(
            &BatchPriceAttestation {
                price_attestations: vec![PriceAttestation {
                    product_id:         Identifier::default(),
                    price_id:           Identifier::default(),
                    price:              1000,
                    conf:               1,
                    expo:               8,
                    ema_price:          1000,
                    ema_conf:           1,
                    status:             PriceStatus::Trading,
                    num_publishers:     8,
                    max_num_publishers: 8,
                    attestation_time:   (now - 1024).try_into().unwrap(),
                    publish_time:       (now - 1024).try_into().unwrap(),
                    prev_publish_time:  (now - 1024).try_into().unwrap(),
                    prev_price:         90,
                    prev_conf:          1,
                }],
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    // The update handler should succeed even if price is old, but simply not update the price.
    assert!(contract
        .call("update_price_feed")
        .gas(300_000_000_000_000)
        .deposit(update_fee.into())
        .args_json(&json!({
            "vaa_hex": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // The price however should _not_ have updated and if we check the unsafe stored price the
    // timestamp and price should be unchanged.
    assert_eq!(
        Price {
            price:     100,
            conf:      1,
            expo:      8,
            timestamp: now,
        },
        serde_json::from_slice::<Price>(
            &contract
                .view("get_price_unsafe")
                .args_json(&json!({ "price_identifier": PriceIdentifier([0; 32]) }))
                .await
                .unwrap()
                .result
        )
        .unwrap(),
    );

    // Now we extend the staleness threshold with a Governance VAA.
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        sequence: 3,
        payload: (),
        ..Default::default()
    };

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).unwrap();
        cur.write_all(
            &GovernanceInstruction {
                target: Chain::from(WormholeChain::Near),
                module: GovernanceModule::Target,
                action: GovernanceAction::SetValidPeriod { valid_seconds: 256 },
            }
            .serialize()
            .unwrap(),
        )
        .unwrap();
        hex::encode(cur.into_inner())
    };

    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // It should now be possible to request the price that previously returned None.
    // [ref:failed_price_check]
    assert_eq!(
        Some(Price {
            price:     100,
            conf:      1,
            expo:      8,
            timestamp: now,
        }),
        serde_json::from_slice::<Option<Price>>(
            &contract
                .view("get_price")
                .args_json(&json!({ "price_identifier": PriceIdentifier([0; 32]) }))
                .await
                .unwrap()
                .result
        )
        .unwrap(),
    );
}

#[tokio::test]
async fn test_contract_fees() {
    let (_, contract, _) = initialize_chain().await;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Failed to get UNIX timestamp")
        .as_secs();

    // Fetch Update fee before changing it.
    let update_fee = serde_json::from_slice::<U128>(
        &contract
            .view("get_update_fee_estimate")
            .args(vec![])
            .await
            .unwrap()
            .result,
    )
    .unwrap();

    // Set a high fee for the contract needed to submit a price.
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        payload: (),
        sequence: 1,
        ..Default::default()
    };

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).unwrap();
        cur.write_all(
            &GovernanceInstruction {
                target: Chain::from(WormholeChain::Near),
                module: GovernanceModule::Target,
                action: GovernanceAction::SetFee { base: 128, expo: 8 },
            }
            .serialize()
            .unwrap(),
        )
        .unwrap();
        hex::encode(cur.into_inner())
    };

    // Now set the update_fee so that it is too high for the deposit to cover.
    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // Check the state has actually changed before we try and execute another VAA.
    assert_ne!(
        u128::from(update_fee),
        u128::from(
            serde_json::from_slice::<U128>(
                &contract
                    .view("get_update_fee_estimate")
                    .args(vec![])
                    .await
                    .unwrap()
                    .result,
            )
            .unwrap()
        )
    );

    // Attempt to update the price feed with a now too low deposit.
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        sequence: 2,
        payload: (),
        ..Default::default()
    };

    let vaa = {
        let mut cur = Cursor::new(Vec::new());
        serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
        cur.write_all(
            &BatchPriceAttestation {
                price_attestations: vec![PriceAttestation {
                    product_id:         Identifier::default(),
                    price_id:           Identifier::default(),
                    price:              1000,
                    conf:               1,
                    expo:               8,
                    ema_price:          1000,
                    ema_conf:           1,
                    status:             PriceStatus::Trading,
                    num_publishers:     8,
                    max_num_publishers: 8,
                    attestation_time:   (now - 1024).try_into().unwrap(),
                    publish_time:       (now - 1024).try_into().unwrap(),
                    prev_publish_time:  (now - 1024).try_into().unwrap(),
                    prev_price:         90,
                    prev_conf:          1,
                }],
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    assert!(contract
        .call("update_price_feed")
        .gas(300_000_000_000_000)
        .deposit(update_fee.into())
        .args_json(&json!({
            "vaa_hex": vaa,
        }))
        .transact()
        .await
        .expect("Failed to submit VAA")
        .outcome()
        .is_success());

    // Submitting a Price should have failed because the fee was not enough.
    assert_eq!(
        None,
        serde_json::from_slice::<Option<Price>>(
            &contract
                .view("get_price")
                .args_json(&json!({ "price_identifier": PriceIdentifier([0; 32]) }))
                .await
                .unwrap()
                .result
        )
        .unwrap(),
    );
}
