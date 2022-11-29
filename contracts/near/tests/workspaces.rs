use structs::Chain;

use {
    near_sdk::borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    p2w_sdk::{
        BatchPriceAttestation,
        PriceAttestation,
    },
    pyth::{
        state::Source,
        Action,
    },
    serde_json::json,
    std::io::Cursor,
};

#[tokio::test]
async fn test_source_add() {
    let worker = workspaces::sandbox().await.unwrap();

    // Deploy Pyth
    let contract = worker
        .dev_deploy(&std::fs::read("pyth.wasm").unwrap())
        .await
        .unwrap();

    // Deploy Wormhole Stub, this is a dummy contract that always verifies VAA's correctly so we
    // can test the ext_wormhole API.
    let wormhole = worker
        .dev_deploy(&std::fs::read("wormhole_stub.wasm").unwrap())
        .await
        .unwrap();

    // Initialize Pyth, one time operation that sets the Wormhole contract address.
    let code_hash = [0u8; 32];
    contract
        .call("new")
        .args_json(&json!({
            "wormhole": wormhole.id(),
            "codehash": code_hash,
        }))
        .transact()
        .await;


    // Submit a new Source to the contract, this will trigger a cross-contract call to wormhole
    let _vaa = structs::Vaa {
        version:            0,
        guardian_set_index: 0,
        signatures:         Vec::new(),
        timestamp:          0,
        nonce:              0,
        sequence:           0,
        consistency_level:  1,
        emitter_chain:      structs::Chain::Near,
        emitter_address:    structs::Address([0; 32]),
        payload:            (),
    };

    let mut _cur = Cursor::new(Vec::new());
    vaa_payload::to_writer(&mut _cur, &_vaa).unwrap();
    Action::AddSource(Source {
        emitter:            [0; 32],
        pyth_emitter_chain: Chain::Solana as u16,
    })
    .serialize(&mut _cur)
    .unwrap();

    contract
        .call("process_vaa")
        .args_json(&json!({
            "vaa": hex::encode(_cur.into_inner()),
        }))
        .transact()
        .await
        .unwrap();

    // There should now be a single source in the contract state.
    assert_eq!(
        serde_json::to_vec(&[Source {
            emitter:            [0; 32],
            pyth_emitter_chain: Chain::Solana as u16,
        }])
        .unwrap(),
        contract.view("get_sources", vec![]).await.unwrap().result,
    );
}

#[tokio::test]
async fn test_source_remove() {
    let worker = workspaces::sandbox().await.unwrap();

    // Deploy Pyth
    let contract = worker
        .dev_deploy(&std::fs::read("pyth.wasm").unwrap())
        .await
        .unwrap();

    // Deploy Wormhole Stub, this is a dummy contract that always verifies VAA's correctly so we
    // can test the ext_wormhole API.
    let wormhole = worker
        .dev_deploy(&std::fs::read("wormhole_stub.wasm").unwrap())
        .await
        .unwrap();

    // Initialize Pyth, one time operation that sets the Wormhole contract address.
    let code_hash = [0u8; 32];
    contract
        .call("new")
        .args_json(&json!({
            "wormhole": wormhole.id(),
            "codehash": code_hash,
        }))
        .transact()
        .await;


    // Submit a new Source to the contract, this will trigger a cross-contract call to wormhole
    let _vaa = structs::Vaa {
        version:            0,
        guardian_set_index: 0,
        signatures:         Vec::new(),
        timestamp:          0,
        nonce:              0,
        sequence:           0,
        consistency_level:  1,
        emitter_chain:      structs::Chain::Near,
        emitter_address:    structs::Address([0; 32]),
        payload:            (),
    };

    let mut _cur = Cursor::new(Vec::new());
    vaa_payload::to_writer(&mut _cur, &_vaa).unwrap();
    Action::AddSource(Source {
        emitter:            [0; 32],
        pyth_emitter_chain: Chain::Solana as u16,
    })
    .serialize(&mut _cur)
    .unwrap();

    contract
        .call("process_vaa")
        .args_json(&json!({
            "vaa": hex::encode(_cur.into_inner()),
        }))
        .transact()
        .await
        .unwrap();

    // Remove the Resource.
    let mut _cur = Cursor::new(Vec::new());
    Action::DelSource(Source {
        emitter:            [0; 32],
        pyth_emitter_chain: Chain::Solana as u16,
    })
    .serialize(&mut _cur)
    .unwrap();

    contract
        .call("process_vaa")
        .args_json(&json!({
            "vaa": hex::encode(_cur.into_inner()),
        }))
        .transact()
        .await
        .unwrap();

    println!("{:?}", contract.view("get_sources", vec![]).await.unwrap());

    // There should now be a single source in the contract state.
    assert_eq!(
        serde_json::to_vec(&vec![Source::default(); 0]).unwrap(),
        contract.view("get_sources", vec![]).await.unwrap().result,
    );
}

#[tokio::test]
async fn test_attest() {
    let worker = workspaces::sandbox().await.unwrap();

    // Deploy Pyth
    let contract = worker
        .dev_deploy(&std::fs::read("pyth.wasm").unwrap())
        .await
        .unwrap();

    // Deploy Wormhole Stub, this is a dummy contract that always verifies VAA's correctly so we
    // can test the ext_wormhole API.
    let wormhole = worker
        .dev_deploy(&std::fs::read("wormhole_stub.wasm").unwrap())
        .await
        .unwrap();

    // Initialize Pyth, one time operation that sets the Wormhole contract address.
    let code_hash = [0u8; 32];
    contract
        .call("new")
        .args_json(&json!({
            "wormhole": wormhole.id(),
            "codehash": code_hash,
        }))
        .transact()
        .await;


    // VAA Wrapper, re-used for each VAA sent.
    let _vaa = structs::Vaa {
        version:            0,
        guardian_set_index: 0,
        signatures:         Vec::new(),
        timestamp:          0,
        nonce:              0,
        sequence:           0,
        consistency_level:  1,
        emitter_chain:      structs::Chain::Near,
        emitter_address:    structs::Address([0; 32]),
        payload:            (),
    };

    // Submit a new Source to the contract.
    let mut _cur = Cursor::new(Vec::new());
    vaa_payload::to_writer(&mut _cur, &_vaa).unwrap();
    Action::AddSource(Source {
        emitter:            [0; 32],
        pyth_emitter_chain: Chain::Solana as u16,
    })
    .serialize(&mut _cur)
    .unwrap();

    contract
        .call("process_vaa")
        .args_json(&json!({
            "vaa": hex::encode(_cur.into_inner()),
        }))
        .transact()
        .await
        .unwrap();

    let mut _cur = Cursor::new(Vec::new());
    vaa_payload::to_writer(&mut _cur, &_vaa).unwrap();
    Action::BatchAttest(
        BatchPriceAttestation {
            price_attestations: vec![
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
            ],
        }
        .serialize()
        .unwrap(),
    )
    .serialize(&mut _cur)
    .unwrap();

    contract
        .call("process_vaa")
        .args_json(&json!({
            "vaa": hex::encode(_cur.into_inner()),
        }))
        .transact()
        .await
        .unwrap();
}

#[tokio::test]
async fn test_invalid_source() {
    let worker = workspaces::sandbox().await.unwrap();

    // Deploy Pyth
    let contract = worker
        .dev_deploy(&std::fs::read("pyth.wasm").unwrap())
        .await
        .unwrap();

    // Deploy Wormhole Stub, this is a dummy contract that always verifies VAA's correctly so we
    // can test the ext_wormhole API.
    let wormhole = worker
        .dev_deploy(&std::fs::read("wormhole_stub.wasm").unwrap())
        .await
        .unwrap();

    // Initialize Pyth, one time operation that sets the Wormhole contract address.
    let code_hash = [0u8; 32];
    contract
        .call("new")
        .args_json(&json!({
            "wormhole": wormhole.id(),
            "codehash": code_hash,
        }))
        .transact()
        .await;

    // VAA Wrapper, re-used for each VAA sent.
    let _vaa = structs::Vaa {
        version:            0,
        guardian_set_index: 0,
        signatures:         Vec::new(),
        timestamp:          0,
        nonce:              0,
        sequence:           0,
        consistency_level:  1,
        emitter_chain:      structs::Chain::Near,
        emitter_address:    structs::Address([0; 32]),
        payload:            (),
    };

    // Submit a new Source to the contract.
    let mut _cur = Cursor::new(Vec::new());
    vaa_payload::to_writer(&mut _cur, &_vaa).unwrap();
    Action::AddSource(Source {
        emitter:            [0; 32],
        pyth_emitter_chain: Chain::Solana as u16,
    })
    .serialize(&mut _cur)
    .unwrap();

    contract
        .call("process_vaa")
        .args_json(&json!({
            "vaa": hex::encode(_cur.into_inner()),
        }))
        .transact()
        .await
        .unwrap();

    // Batch Attest.
    let mut _cur = Cursor::new(Vec::new());
    vaa_payload::to_writer(&mut _cur, &_vaa).unwrap();
    Action::BatchAttest(
        BatchPriceAttestation {
            price_attestations: vec![
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
                PriceAttestation::default(),
            ],
        }
        .serialize()
        .unwrap(),
    )
    .serialize(&mut _cur)
    .unwrap();

    contract
        .call("process_vaa")
        .args_json(&json!({
            "vaa": hex::encode(_cur.into_inner()),
        }))
        .transact()
        .await
        .unwrap();
}
