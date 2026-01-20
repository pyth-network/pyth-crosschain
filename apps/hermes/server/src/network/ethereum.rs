//! This module provides functionality to fetch the Wormhole guardian set from
//! Ethereum mainnet.
//!
//! Uses `alloy-sol-types` for type-safe ABI encoding/decoding of Wormhole
//! contract calls.

use {
    crate::network::wormhole::GuardianSet,
    alloy_primitives::Address,
    alloy_sol_types::{sol, SolCall},
    anyhow::{anyhow, Context, Result},
    serde::{Deserialize, Serialize},
    serde_json::json,
};

// Define the Wormhole contract interface using alloy's sol! macro
sol! {
    struct WormholeGuardianSet {
        address[] keys;
        uint32 expirationTime;
    }

    function getCurrentGuardianSetIndex() external view returns (uint32);

    function getGuardianSet(uint32 index) external view returns (WormholeGuardianSet);
}

/// JSON-RPC request structure
#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: &'static str,
    params: serde_json::Value,
    id: u64,
}

/// JSON-RPC response structure
#[derive(Deserialize)]
struct JsonRpcResponse {
    result: Option<String>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize, Debug)]
struct JsonRpcError {
    code: i64,
    message: String,
}

/// Makes an eth_call to a contract and returns the raw bytes
async fn eth_call(
    client: &reqwest::Client,
    rpc_url: &str,
    to: &str,
    data: &[u8],
) -> Result<Vec<u8>> {
    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: json!([
            {
                "to": to,
                "data": format!("0x{}", hex::encode(data))
            },
            "latest"
        ]),
        id: 1,
    };

    let response = client
        .post(rpc_url)
        .json(&request)
        .send()
        .await
        .context("Failed to send request to Ethereum RPC")?;

    let json_response: JsonRpcResponse = response
        .json()
        .await
        .context("Failed to parse Ethereum RPC response")?;

    if let Some(error) = json_response.error {
        return Err(anyhow!(
            "Ethereum RPC error ({}): {}",
            error.code,
            error.message
        ));
    }

    let hex_result = json_response
        .result
        .ok_or_else(|| anyhow!("Empty result from Ethereum RPC"))?;

    let hex_data = hex_result.strip_prefix("0x").unwrap_or(&hex_result);
    hex::decode(hex_data).context("Failed to decode hex response")
}

/// Fetches the current guardian set index from the Ethereum Wormhole contract.
async fn fetch_current_guardian_set_index(
    client: &reqwest::Client,
    ethereum_rpc_url: &str,
    wormhole_contract_addr: &str,
) -> Result<u32> {
    // Encode the function call using alloy-sol-types
    let call = getCurrentGuardianSetIndexCall {};
    let encoded = call.encode();

    let result = eth_call(client, ethereum_rpc_url, wormhole_contract_addr, &encoded).await?;

    // Decode the return value using alloy-sol-types
    let decoded = getCurrentGuardianSetIndexCall::decode_returns(&result, true)
        .context("Failed to decode getCurrentGuardianSetIndex return value")?;

    Ok(decoded._0)
}

/// Fetches a specific guardian set by index from the Ethereum Wormhole contract.
async fn fetch_guardian_set_by_index(
    client: &reqwest::Client,
    ethereum_rpc_url: &str,
    wormhole_contract_addr: &str,
    guardian_set_index: u32,
) -> Result<GuardianSet> {
    // Encode the function call using alloy-sol-types
    let call = getGuardianSetCall {
        index: guardian_set_index,
    };
    let encoded = call.encode();

    let result = eth_call(client, ethereum_rpc_url, wormhole_contract_addr, &encoded).await?;

    // Decode the return value using alloy-sol-types
    let decoded = getGuardianSetCall::decode_returns(&result, true)
        .context("Failed to decode getGuardianSet return value")?;

    // Convert alloy Address array to our GuardianSet format
    let keys: Vec<[u8; 20]> = decoded
        ._0
        .keys
        .iter()
        .map(|addr: &Address| addr.0 .0)
        .collect();

    Ok(GuardianSet { keys })
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

    let client = reqwest::Client::new();

    // Fetch current guardian set index
    let current_index =
        fetch_current_guardian_set_index(&client, ethereum_rpc_url, wormhole_contract_addr).await?;

    tracing::info!(
        guardian_set_index = current_index,
        "Fetching guardian set from Ethereum..."
    );

    // Fetch current guardian set
    let current_set = fetch_guardian_set_by_index(
        &client,
        ethereum_rpc_url,
        wormhole_contract_addr,
        current_index,
    )
    .await?;

    tracing::info!(
        guardian_set_index = current_index,
        %current_set,
        "Retrieved Current GuardianSet from Ethereum.",
    );

    // Fetch previous guardian set if it exists
    let previous = if current_index >= 1 {
        match fetch_guardian_set_by_index(
            &client,
            ethereum_rpc_url,
            wormhole_contract_addr,
            current_index - 1,
        )
        .await
        {
            Ok(prev_set) => {
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

    #[test]
    fn test_sol_call_encoding() {
        // Verify that alloy-sol-types generates the correct function selector
        // for getCurrentGuardianSetIndex()
        let call = getCurrentGuardianSetIndexCall {};
        let encoded = call.encode();
        // Function selector should be 0x1cfe7951
        assert_eq!(hex::encode(&encoded[0..4]), "1cfe7951");
    }

    #[test]
    fn test_get_guardian_set_call_encoding() {
        // Verify that getGuardianSet(uint32) encoding is correct
        let call = getGuardianSetCall { index: 4 };
        let encoded = call.encode();
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
        // Test decoding a guardian set response using alloy-sol-types
        let data = hex::decode(concat!(
            "0000000000000000000000000000000000000000000000000000000000000020", // offset to struct
            "0000000000000000000000000000000000000000000000000000000000000040", // offset to keys
            "0000000000000000000000000000000000000000000000000000000000000000", // expiration
            "0000000000000000000000000000000000000000000000000000000000000002", // length
            "0000000000000000000000001111111111111111111111111111111111111111", // addr 1
            "0000000000000000000000002222222222222222222222222222222222222222"  // addr 2
        ))
        .unwrap();

        let decoded = getGuardianSetCall::decode_returns(&data, true).unwrap();
        assert_eq!(decoded._0.keys.len(), 2);
        assert_eq!(
            hex::encode(decoded._0.keys[0]),
            "1111111111111111111111111111111111111111"
        );
        assert_eq!(
            hex::encode(decoded._0.keys[1]),
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
