use {
    crate::{
        api::BlockchainState, chain::ethereum::InstrumentedSignablePythContract,
        keeper::block::get_latest_safe_block,
    },
    anyhow::{anyhow, Result},
    fortuna::eth_utils::utils::send_and_confirm,
    std::sync::Arc,
    tokio::time::{self, Duration},
    tracing::{self, Instrument},
};

/// Check whether we need to manually update the commitments to reduce numHashes for future
/// requests and reduce the gas cost of the reveal.
const UPDATE_COMMITMENTS_INTERVAL: Duration = Duration::from_secs(30);
const UPDATE_COMMITMENTS_THRESHOLD_FACTOR: f64 = 0.95;

#[tracing::instrument(name = "update_commitments", skip_all)]
pub async fn update_commitments_loop(
    contract: Arc<InstrumentedSignablePythContract>,
    chain_state: BlockchainState,
) {
    loop {
        if let Err(e) = update_commitments_if_necessary(contract.clone(), &chain_state)
            .in_current_span()
            .await
        {
            tracing::error!("Update commitments. error: {:?}", e);
        }
        time::sleep(UPDATE_COMMITMENTS_INTERVAL).await;
    }
}

pub async fn update_commitments_if_necessary(
    contract: Arc<InstrumentedSignablePythContract>,
    chain_state: &BlockchainState,
) -> Result<()> {
    //TODO: we can reuse the result from the last call from the watch_blocks thread to reduce RPCs
    let latest_safe_block = get_latest_safe_block(chain_state).in_current_span().await;
    let provider_address = chain_state.provider_address;
    let provider_info = contract
        .get_provider_info(provider_address)
        .block(latest_safe_block) // To ensure we are not revealing sooner than we should
        .call()
        .await
        .map_err(|e| anyhow!("Error while getting provider info. error: {:?}", e))?;
    if provider_info.max_num_hashes == 0 {
        return Ok(());
    }
    let threshold =
        ((provider_info.max_num_hashes as f64) * UPDATE_COMMITMENTS_THRESHOLD_FACTOR) as u64;
    if provider_info.sequence_number - provider_info.current_commitment_sequence_number > threshold
    {
        let seq_number = provider_info.sequence_number - 1;
        let provider_revelation = chain_state
            .state
            .reveal(seq_number)
            .map_err(|e| anyhow!("Error revealing: {:?}", e))?;
        let contract_call =
            contract.advance_provider_commitment(provider_address, seq_number, provider_revelation);
        send_and_confirm(contract_call).await?;
    }
    Ok(())
}
