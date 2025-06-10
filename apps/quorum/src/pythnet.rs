use borsh::BorshDeserialize;
use solana_client::{client_error::reqwest::Url, nonblocking::rpc_client::RpcClient};
use solana_sdk::{commitment_config::CommitmentConfig, pubkey::Pubkey};
use wormhole_sdk::{GuardianAddress, GuardianSetInfo};

/// GuardianSetData extracted from wormhole bridge account, due to no API.
#[derive(BorshDeserialize)]
pub struct GuardianSetData {
    pub _index: u32,
    pub keys: Vec<[u8; 20]>,
    pub _creation_time: u32,
    pub _expiration_time: u32,
}

pub async fn fetch_guardian_set(
    pythnet_http_endpoint: Url,
    wormhole_contract_addr: Pubkey,
    guardian_set_index: u32,
) -> anyhow::Result<GuardianSetInfo> {
    let client = RpcClient::new(pythnet_http_endpoint.to_string());

    let guardian_set = client
        .get_account_with_commitment(
            &Pubkey::find_program_address(
                &[b"GuardianSet", &guardian_set_index.to_be_bytes()],
                &wormhole_contract_addr,
            )
            .0,
            CommitmentConfig::confirmed(),
        )
        .await
        .map_err(|err| anyhow::anyhow!("Failed to fetch GuardianSet account: {}", err))?
        .value
        .ok_or(anyhow::anyhow!(
            "GuardianSet account not found for index {}",
            guardian_set_index
        ))?;

    let deserialized_guardian_set =
        GuardianSetData::deserialize(&mut guardian_set.data.as_ref())
            .map_err(|err| anyhow::anyhow!("Failed to deserialize GuardianSet account: {}", err))?;
    Ok(GuardianSetInfo {
        addresses: deserialized_guardian_set
            .keys
            .into_iter()
            .map(GuardianAddress)
            .collect(),
    })
}
