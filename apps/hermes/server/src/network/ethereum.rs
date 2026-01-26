//! This module provides functionality to fetch the Wormhole guardian set from
//! Ethereum mainnet.
//!
//! Uses the `alloy` crate for type-safe Ethereum RPC calls and ABI encoding/decoding.

use {
    crate::network::wormhole::GuardianSet,
    alloy::{primitives::Address, providers::ProviderBuilder, sol},
    anyhow::{anyhow, Context, Result},
};

// Define the Wormhole contract interface using alloy's sol! macro
// This generates type-safe Rust types for ABI encoding/decoding and contract calls
sol! {
    #[sol(rpc)]
    contract IWormhole {
        struct GuardianSet {
            address[] keys;
            uint32 expirationTime;
        }

        function getCurrentGuardianSetIndex() external view returns (uint32);
        function getGuardianSet(uint32 index) external view returns (GuardianSet);
    }
}

/// Fetches the current and previous guardian sets from Ethereum.
///
/// This function mirrors the behavior of `fetch_guardian_sets_from_pythnet` in pythnet.rs
/// but sources the data from Ethereum instead.
pub async fn fetch_guardian_sets_from_ethereum(
    ethereum_rpc_url: &str,
    wormhole_contract_addr: &str,
) -> Result<(u32, GuardianSet, Option<(u32, GuardianSet)>)> {
    // Validate that we have a valid RPC URL
    if ethereum_rpc_url.is_empty() {
        return Err(anyhow!(
            "Ethereum RPC URL is required when using ethereum as guardian set source"
        ));
    }

    // Create an alloy provider for Ethereum RPC
    let provider = ProviderBuilder::new()
        .connect(ethereum_rpc_url)
        .await
        .context("Failed to create Ethereum provider")?;

    // Parse the contract address
    let contract_addr: Address = wormhole_contract_addr
        .parse()
        .context("Failed to parse Wormhole contract address")?;

    // Create contract instance
    let wormhole = IWormhole::new(contract_addr, &provider);

    // Fetch current guardian set index
    let current_index = wormhole
        .getCurrentGuardianSetIndex()
        .call()
        .await
        .context("Failed to call getCurrentGuardianSetIndex")?;

    tracing::info!(
        guardian_set_index = current_index,
        "Fetching guardian set from Ethereum..."
    );

    // Fetch current guardian set
    let current_guardian_set = wormhole
        .getGuardianSet(current_index)
        .call()
        .await
        .context("Failed to call getGuardianSet for current index")?;

    // Convert to our GuardianSet format
    let current_set = GuardianSet {
        keys: current_guardian_set
            .keys
            .iter()
            .map(|addr| addr.0 .0)
            .collect(),
    };

    tracing::info!(
        guardian_set_index = current_index,
        %current_set,
        "Retrieved Current GuardianSet from Ethereum.",
    );

    // Fetch previous guardian set if it exists
    let previous = if current_index >= 1 {
        match wormhole.getGuardianSet(current_index - 1).call().await {
            Ok(result) => {
                let prev_set = GuardianSet {
                    keys: result.keys.iter().map(|addr| addr.0 .0).collect(),
                };
                tracing::info!(
                    previous_guardian_set_index = current_index - 1,
                    %prev_set,
                    "Retrieved Previous GuardianSet from Ethereum.",
                );
                Some((current_index - 1, prev_set))
            }
            Err(err) => {
                // Previous guardian set might not exist or be expired
                tracing::warn!(
                    error = ?err,
                    previous_guardian_set_index = current_index - 1,
                    "Could not fetch previous guardian set from Ethereum (may be expired)."
                );
                None
            }
        }
    } else {
        None
    };

    Ok((current_index, current_set, previous))
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::sol_types::SolCall;

    #[test]
    fn test_sol_call_encoding() {
        // Verify that alloy generates the correct function selector
        // for getCurrentGuardianSetIndex()
        let call = IWormhole::getCurrentGuardianSetIndexCall {};
        let encoded = call.abi_encode();
        // Function selector should be 0x1cfe7951
        assert_eq!(hex::encode(&encoded[0..4]), "1cfe7951");
    }

    #[test]
    fn test_get_guardian_set_call_encoding() {
        // Verify that getGuardianSet(uint32) encoding is correct
        let call = IWormhole::getGuardianSetCall { index: 4 };
        let encoded = call.abi_encode();
        // Function selector should be 0xf951975a
        assert_eq!(hex::encode(&encoded[0..4]), "f951975a");
        // Followed by uint32 value 4 encoded as 32 bytes
        assert_eq!(
            hex::encode(&encoded[4..]),
            "0000000000000000000000000000000000000000000000000000000000000004"
        );
    }

    #[test]
    fn test_guardian_set_decoding() {
        // Test decoding a guardian set response using alloy
        let data = hex::decode(concat!(
            "0000000000000000000000000000000000000000000000000000000000000020", // offset to struct
            "0000000000000000000000000000000000000000000000000000000000000040", // offset to keys
            "0000000000000000000000000000000000000000000000000000000000000000", // expiration
            "0000000000000000000000000000000000000000000000000000000000000002", // length
            "0000000000000000000000001111111111111111111111111111111111111111", // addr 1
            "0000000000000000000000002222222222222222222222222222222222222222"  // addr 2
        ))
        .unwrap();

        let decoded = IWormhole::getGuardianSetCall::abi_decode_returns(&data).unwrap();
        assert_eq!(decoded.keys.len(), 2);
        assert_eq!(
            hex::encode(decoded.keys[0]),
            "1111111111111111111111111111111111111111"
        );
        assert_eq!(
            hex::encode(decoded.keys[1]),
            "2222222222222222222222222222222222222222"
        );
    }

    // Integration test - requires a valid Ethereum RPC endpoint
    // Run with: ETHEREUM_RPC_URL=<your_url> cargo test --package hermes -- --no-capture --ignored ethereum
    #[tokio::test]
    #[ignore = "requires live Ethereum RPC endpoint"]
    async fn test_fetch_guardian_set_from_ethereum() {
        let rpc_url =
            std::env::var("ETHEREUM_RPC_URL").expect("ETHEREUM_RPC_URL must be set for this test");
        let contract_addr = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";

        let (index, current, previous) = fetch_guardian_sets_from_ethereum(&rpc_url, contract_addr)
            .await
            .expect("Failed to fetch guardian sets");

        println!("Current guardian set index: {index}");
        println!("Current guardian set: {current}");
        if let Some((prev_idx, prev_set)) = previous {
            println!("Previous guardian set index: {prev_idx}");
            println!("Previous guardian set: {prev_set}");
        }

        // Verify we got valid data
        assert!(!current.keys.is_empty(), "Guardian set should have keys");
    }
}
