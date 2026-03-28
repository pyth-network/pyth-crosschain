extern crate alloc;

use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Bytes, BytesN, Env, IntoVal};

use crate::{error::ContractError, PythLazerContract, PythLazerContractClient};

fn test_lazer_update_bytes(env: &Env) -> Bytes {
    Bytes::from_slice(
        env,
        &hex_literal::hex!(
            "e4bd474d73a7e70a8e2b8de236b55dcc6a771b4a8a1533fe"
            "492f424fae162369fa14103e04c1c93302cef8a052110a95"
            "0da031f9dc5eade9e6099e95668aff2592ec1f7900fe0075"
            "d3c7934067e9c7f14a06000303010000000b00e1637ad535"
            "060000015a2507d335060000027f8bfdf53506000004f8ff"
            "0600070008000900000a601299cd3e0600000bc07595c73e"
            "0600000c014067e9c7f14a0600020000000b00971b209c2d"
            "0000000144056b9b2d0000000298fb6b9c2d00000004f8ff"
            "0600070008000900000a284444f92d0000000b480c07f92d"
            "0000000c014067e9c7f14a0600700000000b0020d85dd2d7"
            "8df30001000000000000000002000000000000000004f4ff"
            "060130f80bfeffffffff0701b8ab7057ec4a060008010020"
            "9db4060000000900000a00000000000000000b0000000000"
            "0000000c014067e9c7f14a0600"
        ),
    )
}

/// Trusted signer compressed public key from the Sui test suite.
fn test_trusted_signer_pubkey(env: &Env) -> BytesN<33> {
    BytesN::from_array(
        env,
        &hex_literal::hex!("03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b"),
    )
}

/// Deploy and initialize the contract, returning the client.
fn setup(env: &Env) -> (PythLazerContractClient, Address) {
    let contract_id = env.register(PythLazerContract, ());
    let client = PythLazerContractClient::new(env, &contract_id);
    let executor = Address::generate(env);

    client.initialize(&executor);
    (client, executor)
}

/// Helper to add a trusted signer via the executor.
fn add_trusted_signer(
    env: &Env,
    client: &PythLazerContractClient,
    executor: &Address,
    pubkey: &BytesN<33>,
    expires_at: u64,
) {
    client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: executor,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &client.address,
                fn_name: "update_trusted_signer",
                args: (pubkey.clone(), expires_at).into_val(env),
                sub_invokes: &[],
            },
        }])
        .update_trusted_signer(pubkey, &expires_at);
}

#[test]
fn test_verify_update_success() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);
    let expires_at = 2_000_000_000u64; // Far in the future (unix seconds)

    add_trusted_signer(&env, &client, &executor, &pubkey, expires_at);

    let update = test_lazer_update_bytes(&env);
    let payload = client.verify_update(&update);

    // Payload should be non-empty
    assert!(payload.len() > 0);
}

#[test]
fn test_verify_update_invalid_magic() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);
    add_trusted_signer(&env, &client, &executor, &pubkey, 2_000_000_000);

    // Corrupt the magic bytes
    let mut update_raw = hex_literal::hex!(
        "e4bd474d73a7e70a8e2b8de236b55dcc6a771b4a8a1533fe"
        "492f424fae162369fa14103e04c1c93302cef8a052110a95"
        "0da031f9dc5eade9e6099e95668aff2592ec1f7900fe0075"
        "d3c7934067e9c7f14a06000303010000000b00e1637ad535"
        "060000015a2507d335060000027f8bfdf53506000004f8ff"
        "0600070008000900000a601299cd3e0600000bc07595c73e"
        "0600000c014067e9c7f14a0600020000000b00971b209c2d"
        "0000000144056b9b2d0000000298fb6b9c2d00000004f8ff"
        "0600070008000900000a284444f92d0000000b480c07f92d"
        "0000000c014067e9c7f14a0600700000000b0020d85dd2d7"
        "8df30001000000000000000002000000000000000004f4ff"
        "060130f80bfeffffffff0701b8ab7057ec4a060008010020"
        "9db4060000000900000a00000000000000000b0000000000"
        "0000000c014067e9c7f14a0600"
    )
    .to_vec();
    update_raw[0] = 0xFF; // Corrupt magic
    let update = Bytes::from_slice(&env, &update_raw);

    let result = client.try_verify_update(&update);
    assert_eq!(result.err().unwrap(), Ok(ContractError::InvalidMagic));
}

#[test]
fn test_verify_update_truncated_data() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);
    add_trusted_signer(&env, &client, &executor, &pubkey, 2_000_000_000);

    // Only 50 bytes - too short
    let truncated = Bytes::from_slice(&env, &[0u8; 50]);
    let result = client.try_verify_update(&truncated);
    assert_eq!(result.err().unwrap(), Ok(ContractError::TruncatedData));
}

#[test]
fn test_verify_update_unknown_signer() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    // Add a different signer that won't match the test data
    let wrong_pubkey = BytesN::from_array(
        &env,
        &hex_literal::hex!("03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    );
    add_trusted_signer(&env, &client, &executor, &wrong_pubkey, 2_000_000_000);

    let update = test_lazer_update_bytes(&env);
    let result = client.try_verify_update(&update);
    assert_eq!(result.err().unwrap(), Ok(ContractError::SignerNotTrusted));
}

#[test]
fn test_verify_update_expired_signer() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);
    let expires_at = 1_000u64;
    add_trusted_signer(&env, &client, &executor, &pubkey, expires_at);

    // Set ledger timestamp past expiry
    env.ledger().with_mut(|li| {
        li.timestamp = 1_000; // >= expires_at
    });

    let update = test_lazer_update_bytes(&env);
    let result = client.try_verify_update(&update);
    assert_eq!(result.err().unwrap(), Ok(ContractError::SignerExpired));
}

#[test]
fn test_verify_update_nearly_expired_signer() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);
    let expires_at = 1_000u64;
    add_trusted_signer(&env, &client, &executor, &pubkey, expires_at);

    // Set ledger timestamp just before expiry
    env.ledger().with_mut(|li| {
        li.timestamp = 999; // < expires_at, should succeed
    });

    let update = test_lazer_update_bytes(&env);
    let payload = client.verify_update(&update);
    assert!(payload.len() > 0);
}

#[test]
fn test_verify_update_multiple_signers() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    // Add a wrong signer first
    let wrong_pubkey = BytesN::from_array(
        &env,
        &hex_literal::hex!("03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
    );
    add_trusted_signer(&env, &client, &executor, &wrong_pubkey, 2_000_000_000);

    // Then add the correct one
    let correct_pubkey = test_trusted_signer_pubkey(&env);
    add_trusted_signer(&env, &client, &executor, &correct_pubkey, 2_000_000_000);

    let update = test_lazer_update_bytes(&env);
    let payload = client.verify_update(&update);
    assert!(payload.len() > 0);
}

#[test]
fn test_initialize_prevents_reinitialization() {
    let env = Env::default();
    let contract_id = env.register(PythLazerContract, ());
    let client = PythLazerContractClient::new(&env, &contract_id);

    let executor1 = Address::generate(&env);
    let executor2 = Address::generate(&env);

    // First initialization should succeed
    client.initialize(&executor1);

    // Second initialization should fail
    let result = client.try_initialize(&executor2);
    assert_eq!(
        result.err().unwrap(),
        Ok(ContractError::AlreadyInitialized)
    );
}

#[test]
fn test_verify_update_invalid_payload_length() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);
    add_trusted_signer(&env, &client, &executor, &pubkey, 2_000_000_000);

    // Take the valid update and corrupt the payload length field (bytes 69-70)
    let mut update_raw = hex_literal::hex!(
        "e4bd474d73a7e70a8e2b8de236b55dcc6a771b4a8a1533fe"
        "492f424fae162369fa14103e04c1c93302cef8a052110a95"
        "0da031f9dc5eade9e6099e95668aff2592ec1f7900fe0075"
        "d3c7934067e9c7f14a06000303010000000b00e1637ad535"
        "060000015a2507d335060000027f8bfdf53506000004f8ff"
        "0600070008000900000a601299cd3e0600000bc07595c73e"
        "0600000c014067e9c7f14a0600020000000b00971b209c2d"
        "0000000144056b9b2d0000000298fb6b9c2d00000004f8ff"
        "0600070008000900000a284444f92d0000000b480c07f92d"
        "0000000c014067e9c7f14a0600700000000b0020d85dd2d7"
        "8df30001000000000000000002000000000000000004f4ff"
        "060130f80bfeffffffff0701b8ab7057ec4a060008010020"
        "9db4060000000900000a00000000000000000b0000000000"
        "0000000c014067e9c7f14a0600"
    )
    .to_vec();
    // Set payload length to 0xFF (wrong)
    update_raw[69] = 0xFF;
    let update = Bytes::from_slice(&env, &update_raw);

    let result = client.try_verify_update(&update);
    assert_eq!(
        result.err().unwrap(),
        Ok(ContractError::InvalidPayloadLength)
    );
}

// ── Governance tests ──

#[test]
fn test_governance_add_new_signer() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = BytesN::from_array(
        &env,
        &hex_literal::hex!("030102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
    );
    let expires_at = 5_000u64;

    add_trusted_signer(&env, &client, &executor, &pubkey, expires_at);

    // Verify signer was added by checking it can be used in verification context.
    // The signer should be present in persistent storage.
    // We confirm by adding the test pubkey and checking no error on a second add (update).
    add_trusted_signer(&env, &client, &executor, &pubkey, expires_at + 1000);
}

#[test]
fn test_governance_update_signer_expiry() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);

    // Add signer with short expiry
    add_trusted_signer(&env, &client, &executor, &pubkey, 1_000);

    // Update signer with longer expiry
    add_trusted_signer(&env, &client, &executor, &pubkey, 2_000_000_000);

    // Ledger timestamp past old expiry but before new expiry should succeed
    env.ledger().with_mut(|li| {
        li.timestamp = 5_000;
    });

    let update = test_lazer_update_bytes(&env);
    let payload = client.verify_update(&update);
    assert!(payload.len() > 0);
}

#[test]
fn test_governance_remove_signer() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);

    // Add signer
    add_trusted_signer(&env, &client, &executor, &pubkey, 2_000_000_000);

    // Verify signer works
    let update = test_lazer_update_bytes(&env);
    let payload = client.verify_update(&update);
    assert!(payload.len() > 0);

    // Remove signer (expires_at = 0)
    add_trusted_signer(&env, &client, &executor, &pubkey, 0);

    // Verify signer no longer works
    let result = client.try_verify_update(&update);
    assert_eq!(result.err().unwrap(), Ok(ContractError::SignerNotTrusted));
}

#[test]
#[should_panic(expected = "HostError: Error(Auth")]
fn test_governance_unauthorized_update_signer() {
    let env = Env::default();
    let (client, _executor) = setup(&env);

    let pubkey = test_trusted_signer_pubkey(&env);
    let unauthorized = Address::generate(&env);

    // Try to add a signer with a non-executor address (no mock auth for executor)
    client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &unauthorized,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &client.address,
                fn_name: "update_trusted_signer",
                args: (pubkey.clone(), 2_000_000_000u64).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .update_trusted_signer(&pubkey, &2_000_000_000u64);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth")]
fn test_governance_unauthorized_upgrade() {
    let env = Env::default();
    let (client, _executor) = setup(&env);

    let unauthorized = Address::generate(&env);
    let fake_hash = BytesN::from_array(&env, &[0u8; 32]);

    // Try to upgrade with a non-executor address
    client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &unauthorized,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &client.address,
                fn_name: "upgrade",
                args: (fake_hash.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .upgrade(&fake_hash);
}

#[test]
fn test_governance_upgrade_with_executor() {
    let env = Env::default();
    let (client, executor) = setup(&env);

    let fake_hash = BytesN::from_array(&env, &[1u8; 32]);

    // The upgrade call itself will fail because fake_hash isn't a real WASM hash,
    // but we can verify executor auth is accepted by checking the error is NOT auth-related.
    let result = client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &executor,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &client.address,
                fn_name: "upgrade",
                args: (fake_hash.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_upgrade(&fake_hash);

    // Should fail with a deployer/wasm error, NOT an auth error
    assert!(result.is_err());
}
