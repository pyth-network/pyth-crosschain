use {
    byteorder::BigEndian,
    near_sdk::json_types::U128,
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
    pyth_wormhole_attester_sdk::{
        BatchPriceAttestation,
        Identifier,
        PriceAttestation,
        PriceStatus,
    },
    pythnet_sdk::{
        accumulators::{
            merkle::MerkleTree,
            Accumulator,
        },
        hashers::keccak256_160::Keccak160,
        messages::{
            Message,
            PriceFeedMessage,
        },
        wire::{
            to_vec,
            v1::{
                AccumulatorUpdateData,
                MerklePriceUpdate,
                Proof,
                WormholeMerkleRoot,
                WormholeMessage,
                WormholePayload,
            },
            PrefixedVec,
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
    let _ = wormhole
        .call("new")
        .args_json(&json!({}))
        .gas(300_000_000_000_000)
        .transact_async()
        .await
        .expect("Failed to initialize Wormhole")
        .await
        .unwrap();

    // Initialize Pyth, one time operation that sets the Wormhole contract address.
    let codehash = [0u8; 32];

    let _ = contract
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
        .transact_async()
        .await
        .expect("Failed to initialize Pyth")
        .await
        .unwrap();

    (worker, contract, wormhole)
}

#[tokio::test]
async fn test_set_sources() {
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
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

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
        sequence: 2,
        ..Default::default()
    };

    let vaa = {
        let request_vaa = wormhole::Vaa {
            emitter_chain: wormhole::Chain::Solana,
            emitter_address: wormhole::Address([1; 32]),
            payload: (),
            sequence: 1,
            ..Default::default()
        };

        // Data Source Upgrades are submitted with an embedded VAA, generate that one here first
        // before we embed it.
        let request_vaa = {
            let mut cur = Cursor::new(Vec::new());
            serde_wormhole::to_writer(&mut cur, &request_vaa).expect("Failed to serialize VAA");
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
                action: GovernanceAction::AuthorizeGovernanceDataSourceTransfer {
                    claim_vaa: request_vaa,
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
        .unwrap()
        .failures()
        .is_empty());

    // An action from the new source should now be accepted.
    let vaa = wormhole::Vaa {
        sequence: 3, // NOTE: Incremented Governance Sequence
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
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // But not from the old source.
    let vaa = wormhole::Vaa {
        sequence: 4, // NOTE: Incremented Governance Sequence
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

    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .outcome()
        .is_success());
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
                    product_id:                 Identifier::default(),
                    price_id:                   Identifier::default(),
                    price:                      100,
                    conf:                       1,
                    expo:                       8,
                    ema_price:                  100,
                    ema_conf:                   1,
                    status:                     PriceStatus::Trading,
                    num_publishers:             8,
                    max_num_publishers:         8,
                    attestation_time:           now.try_into().unwrap(),
                    publish_time:               now.try_into().unwrap(),
                    prev_publish_time:          now.try_into().unwrap(),
                    prev_price:                 100,
                    prev_conf:                  1,
                    last_attested_publish_time: now.try_into().unwrap(),
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
            .args_json(&json!({
                "data": vaa,
            }))
            .await
            .unwrap()
            .result,
    )
    .unwrap();

    // Submit price. As there are no prices this should succeed despite being old.
    assert!(contract
        .call("update_price_feeds")
        .gas(300_000_000_000_000)
        .deposit(update_fee.into())
        .args_json(&json!({
            "data": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // Despite succeeding, assert Price cannot be requested, 60 seconds in the past should be
    // considered stale. [tag:failed_price_check]
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

    // Submit another Price Attestation to the contract with an even older timestamp. Which
    // should now fail due to the existing newer price.
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
                    product_id:                 Identifier::default(),
                    price_id:                   Identifier::default(),
                    price:                      1000,
                    conf:                       1,
                    expo:                       8,
                    ema_price:                  1000,
                    ema_conf:                   1,
                    status:                     PriceStatus::Trading,
                    num_publishers:             8,
                    max_num_publishers:         8,
                    attestation_time:           (now - 1024).try_into().unwrap(),
                    publish_time:               (now - 1024).try_into().unwrap(),
                    prev_publish_time:          (now - 1024).try_into().unwrap(),
                    prev_price:                 90,
                    prev_conf:                  1,
                    last_attested_publish_time: (now - 1024).try_into().unwrap(),
                }],
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    // The update handler should now succeed even if price is old, but simply not update the price.
    assert!(contract
        .call("update_price_feeds")
        .gas(300_000_000_000_000)
        .deposit(update_fee.into())
        .args_json(&json!({
            "data": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // The price however should _not_ have updated and if we check the unsafe stored price the
    // timestamp and price should be unchanged.
    assert_eq!(
        Price {
            price:        100.into(),
            conf:         1.into(),
            expo:         8,
            publish_time: now as i64,
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
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // It should now be possible to request the price that previously returned None.
    // [ref:failed_price_check]
    assert_eq!(
        Some(Price {
            price:        100.into(),
            conf:         1.into(),
            expo:         8,
            publish_time: now as i64,
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

    // Fetch Update fee before changing it.
    let update_fee = serde_json::from_slice::<U128>(
        &contract
            .view("get_update_fee_estimate")
            .args_json(&json!({
                "data": vaa,
            }))
            .await
            .unwrap()
            .result,
    )
    .unwrap();

    // Now set the update_fee so that it is too high for the deposit to cover.
    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // Check the state has actually changed before we try and execute another VAA.
    assert_ne!(
        u128::from(update_fee),
        u128::from(
            serde_json::from_slice::<U128>(
                &contract
                    .view("get_update_fee_estimate")
                    .args_json(&json!({
                        "data": vaa,
                    }))
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
                    product_id:                 Identifier::default(),
                    price_id:                   Identifier::default(),
                    price:                      1000,
                    conf:                       1,
                    expo:                       8,
                    ema_price:                  1000,
                    ema_conf:                   1,
                    status:                     PriceStatus::Trading,
                    num_publishers:             8,
                    max_num_publishers:         8,
                    attestation_time:           (now - 1024).try_into().unwrap(),
                    publish_time:               (now - 1024).try_into().unwrap(),
                    prev_publish_time:          (now - 1024).try_into().unwrap(),
                    prev_price:                 90,
                    prev_conf:                  1,
                    last_attested_publish_time: (now - 1024).try_into().unwrap(),
                }],
            }
            .serialize()
            .unwrap(),
        )
        .expect("Failed to write Payload");
        hex::encode(cur.into_inner())
    };

    assert!(contract
        .call("update_price_feeds")
        .gas(300_000_000_000_000)
        .deposit(update_fee.into())
        .args_json(&json!({
            "data": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

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

// A test that attempts to SetFee twice with the same governance action, the first should succeed,
// the second should fail.
#[tokio::test]
async fn test_same_governance_sequence_fails() {
    let (_, contract, _) = initialize_chain().await;

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

    // Attempt our first SetFee.
    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // Attempt to run the same VAA again.
    assert!(!contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());
}

// A test that attempts to SetFee twice with the same governance action, the first should succeed,
// the second should fail.
#[tokio::test]
async fn test_out_of_order_sequences_fail() {
    let (_, contract, _) = initialize_chain().await;

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

    // Attempt our first SetFee.
    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // Generate another VAA with sequence 3.
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        payload: (),
        sequence: 3,
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

    // This should succeed.
    assert!(contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // Generate another VAA with sequence 2.
    let vaa = wormhole::Vaa {
        emitter_chain: wormhole::Chain::Any,
        emitter_address: wormhole::Address([0; 32]),
        payload: (),
        sequence: 2,
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

    // This should fail due to being out of order.
    assert!(!contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());
}

// A test that fails if the governance action payload target is not NEAR.
#[tokio::test]
async fn test_governance_target_fails_if_not_near() {
    let (_, contract, _) = initialize_chain().await;

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
                target: Chain::from(WormholeChain::Solana),
                module: GovernanceModule::Target,
                action: GovernanceAction::SetFee { base: 128, expo: 8 },
            }
            .serialize()
            .unwrap(),
        )
        .unwrap();
        hex::encode(cur.into_inner())
    };

    // This should fail as the target is Solana, when Near is expected.
    assert!(!contract
        .call("execute_governance_instruction")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "vaa": vaa,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());
}

// A test to check accumulator style updates work as intended.
#[tokio::test]
async fn test_accumulator_updates() {
    fn create_dummy_price_feed_message(value: i64) -> Message {
        let mut dummy_id = [0; 32];
        dummy_id[0] = value as u8;
        let msg = PriceFeedMessage {
            feed_id:           dummy_id,
            price:             value,
            conf:              value as u64,
            exponent:          value as i32,
            publish_time:      value,
            prev_publish_time: value,
            ema_price:         value,
            ema_conf:          value as u64,
        };
        Message::PriceFeedMessage(msg)
    }

    fn create_accumulator_message_from_updates(
        price_updates: Vec<MerklePriceUpdate>,
        tree: MerkleTree<Keccak160>,
        emitter_address: [u8; 32],
        emitter_chain: u16,
    ) -> Vec<u8> {
        let mut root_hash = [0u8; 20];
        root_hash.copy_from_slice(&to_vec::<_, BigEndian>(&tree.root).unwrap()[..20]);
        let wormhole_message = WormholeMessage::new(WormholePayload::Merkle(WormholeMerkleRoot {
            slot:      0,
            ring_size: 0,
            root:      root_hash,
        }));

        let vaa = wormhole::Vaa {
            emitter_chain: emitter_chain.into(),
            emitter_address: wormhole::Address(emitter_address),
            sequence: 2,
            payload: (),
            ..Default::default()
        };

        let vaa = {
            let mut cur = Cursor::new(Vec::new());
            serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
            cur.write_all(&to_vec::<_, BigEndian>(&wormhole_message).unwrap())
                .expect("Failed to write Payload");
            cur.into_inner()
        };

        let accumulator_update_data = AccumulatorUpdateData::new(Proof::WormholeMerkle {
            vaa:     PrefixedVec::from(vaa),
            updates: price_updates,
        });

        to_vec::<_, BigEndian>(&accumulator_update_data).unwrap()
    }

    fn create_accumulator_message(all_feeds: &[Message], updates: &[Message]) -> Vec<u8> {
        let all_feeds_bytes: Vec<_> = all_feeds
            .iter()
            .map(|f| to_vec::<_, BigEndian>(f).unwrap())
            .collect();
        let all_feeds_bytes_refs: Vec<_> = all_feeds_bytes.iter().map(|f| f.as_ref()).collect();
        let tree = MerkleTree::<Keccak160>::new(all_feeds_bytes_refs.as_slice()).unwrap();
        let mut price_updates: Vec<MerklePriceUpdate> = vec![];
        for update in updates {
            let proof = tree
                .prove(&to_vec::<_, BigEndian>(update).unwrap())
                .unwrap();
            price_updates.push(MerklePriceUpdate {
                message: PrefixedVec::from(to_vec::<_, BigEndian>(update).unwrap()),
                proof,
            });
        }
        create_accumulator_message_from_updates(
            price_updates,
            tree,
            [1; 32],
            wormhole::Chain::Any.into(),
        )
    }

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
                            chain:   Chain::from(WormholeChain::Any),
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
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // Create a couple of test feeds.
    let feed_1 = create_dummy_price_feed_message(100);
    let feed_2 = create_dummy_price_feed_message(200);
    let message = create_accumulator_message(&[feed_1, feed_2], &[feed_1]);
    let message = hex::encode(message);

    // Call the usual UpdatePriceFeed function.
    assert!(contract
        .call("update_price_feeds")
        .gas(300_000_000_000_000)
        .deposit(300_000_000_000_000_000_000_000)
        .args_json(&json!({
            "data": message,
        }))
        .transact_async()
        .await
        .expect("Failed to submit VAA")
        .await
        .unwrap()
        .failures()
        .is_empty());

    // Check the price feed actually updated. Check both types of serialized PriceIdentifier.
    let mut identifier = [0; 32];
    identifier[0] = 100;

    assert_eq!(
        Some(Price {
            price:        100.into(),
            conf:         100.into(),
            expo:         100,
            publish_time: 100,
        }),
        serde_json::from_slice::<Option<Price>>(
            &contract
                .view("get_price_unsafe")
                .args_json(&json!({ "price_identifier": PriceIdentifier(identifier) }))
                .await
                .unwrap()
                .result
        )
        .unwrap(),
    );
}

#[tokio::test]
async fn test_sdk_compat() {
    let price = pyth_sdk::Price {
        price:        i64::MAX,
        conf:         u64::MAX,
        expo:         100,
        publish_time: 100,
    };

    let encoded = serde_json::to_string(&price).unwrap();
    let decoded_price: Price = serde_json::from_str(&encoded).unwrap();
    assert_eq!(
        decoded_price,
        Price {
            price:        i64::MAX.into(),
            conf:         u64::MAX.into(),
            expo:         100,
            publish_time: 100,
        }
    );
}

#[tokio::test]
async fn test_borsh_field_cmopat() {
    use near_sdk::borsh::{
        self,
        BorshDeserialize,
        BorshSerialize,
    };

    let price = pyth_sdk::Price {
        price:        i64::MAX,
        conf:         u64::MAX,
        expo:         100,
        publish_time: 100,
    };

    // Verify that we can still BorshDeserialize a struct with a different field name. Confirms
    // we don't have to migrate the state.
    #[derive(Eq, PartialEq, Debug, BorshSerialize, BorshDeserialize)]
    struct PriceTester {
        price:          i64,
        conf:           u64,
        expo:           u32,
        bad_field_name: u64,
    }

    let encoded = near_sdk::borsh::BorshSerialize::try_to_vec(&price).unwrap();
    let decoded_price: PriceTester =
        near_sdk::borsh::BorshDeserialize::try_from_slice(&encoded).unwrap();
    assert_eq!(
        decoded_price,
        PriceTester {
            price:          i64::MAX.into(),
            conf:           u64::MAX.into(),
            expo:           100,
            bad_field_name: 100,
        }
    );
}
