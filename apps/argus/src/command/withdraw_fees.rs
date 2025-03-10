use {
    crate::{
        chain::ethereum::SignablePythContract,
        config::{Config, WithdrawFeesOptions},
    },
    anyhow::{anyhow, Result},
    ethers::{signers::Signer, types::Address},
};

pub async fn withdraw_fees(opts: &WithdrawFeesOptions) -> Result<()> {
    let config = Config::load(&opts.config.config)?;

    let private_key_string = if opts.keeper {
        config.keeper.private_key.load()?.ok_or(anyhow!("Please specify a keeper private key in the config or omit the --keeper option to use the provider private key"))?
    } else {
        config.provider.private_key.load()?.ok_or(anyhow!(
            "Please specify a provider private key in the config or provide the --keeper option to use the keeper private key instead."
        ))?
    };

    match opts.chain_id.clone() {
        Some(chain_id) => {
            let chain_config = &config.get_chain_config(&chain_id)?;
            let contract =
                SignablePythContract::from_config(chain_config, &private_key_string).await?;

            withdraw_fees_for_chain(
                contract,
                config.provider.address,
                opts.keeper,
                opts.retain_balance_wei,
            )
            .await?;
        }
        None => {
            for (chain_id, chain_config) in config.chains.iter() {
                tracing::info!("Withdrawing fees for chain: {}", chain_id);
                let contract =
                    SignablePythContract::from_config(chain_config, &private_key_string).await?;

                withdraw_fees_for_chain(
                    contract,
                    config.provider.address,
                    opts.keeper,
                    opts.retain_balance_wei,
                )
                .await?;
            }
        }
    }
    Ok(())
}

pub async fn withdraw_fees_for_chain(
    contract: SignablePythContract,
    provider_address: Address,
    is_fee_manager: bool,
    retained_balance: u128,
) -> Result<()> {
    tracing::info!("Fetching fees for provider: {:?}", provider_address);
    let provider_info = contract.get_provider_info(provider_address).call().await?;
    let fees = provider_info.accrued_fees_in_wei;
    tracing::info!("Accrued fees: {} wei", fees);

    let withdrawal_amount_wei = fees.saturating_sub(retained_balance);
    if withdrawal_amount_wei > 0 {
        tracing::info!(
            "Withdrawing {} wei to {}...",
            withdrawal_amount_wei,
            contract.wallet().address()
        );

        let call = match is_fee_manager {
            true => contract.withdraw_as_fee_manager(provider_address, withdrawal_amount_wei),
            false => contract.withdraw(withdrawal_amount_wei),
        };
        let tx_result = call.send().await?.await?;

        match &tx_result {
            Some(receipt) => {
                tracing::info!("Withdrawal transaction hash {:?}", receipt.transaction_hash);
            }
            None => {
                tracing::warn!("No transaction receipt. Unclear what happened to the transaction");
            }
        }
    }

    Ok(())
}
