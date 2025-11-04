#![allow(clippy::same_name_method, reason = "generated code")]

use {
    crate::{
        api::ChainId,
        chain::reader::{self, BlockNumber, BlockStatus, EntropyReader, RequestedV2Event},
        config::EthereumConfig,
        eth_utils::{
            eth_gas_oracle::EthProviderOracle,
            legacy_tx_middleware::LegacyTxMiddleware,
            nonce_manager::{NonceManaged, NonceManagerMiddleware},
            traced_client::{RpcMetrics, TracedClient},
            utils::{submit_tx_with_backoff, EscalationPolicy, SubmitTxError, SubmitTxResult},
        },
        keeper::contract::{
            KeeperProviderInfo, KeeperTxContract, KeeperTxError, KeeperTxResult,
            RevealWithCallbackData, TxExecutionOutcome, TxHash, Wei,
        },
    },
    anyhow::{anyhow, Error, Result},
    axum::async_trait,
    backoff::Error as BackoffError,
    ethers::abi::AbiDecode,
    ethers::{
        abi::RawLog,
        contract::{abigen, ContractCall, ContractError, EthLogDecode, LogMeta},
        core::types::Address,
        middleware::{gas_oracle::GasOracleMiddleware, SignerMiddleware},
        prelude::JsonRpcClient,
        providers::{Http, Middleware, Provider},
        signers::{LocalWallet, Signer},
        types::{
            transaction::eip2718::TypedTransaction, BlockNumber as EthersBlockNumber,
            TransactionReceipt, TransactionRequest, U256, U64,
        },
    },
    hex,
    sha3::{Digest, Keccak256},
    std::{
        convert::TryFrom,
        sync::Arc,
        time::{Duration, Instant},
    },
    tokio::time::timeout,
};

// TODO: Programmatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(
    PythRandom,
    "../../target_chains/ethereum/entropy_sdk/solidity/abis/IEntropy.json";
    PythRandomErrors,
    "../../target_chains/ethereum/entropy_sdk/solidity/abis/EntropyErrors.json"
);

pub type MiddlewaresWrapper<T> = LegacyTxMiddleware<
    GasOracleMiddleware<
        NonceManagerMiddleware<SignerMiddleware<Provider<T>, LocalWallet>>,
        EthProviderOracle<Provider<T>>,
    >,
>;

pub type SignablePythContractInner<T> = PythRandom<MiddlewaresWrapper<T>>;
pub type SignablePythContract = SignablePythContractInner<Http>;
pub type InstrumentedSignablePythContract = SignablePythContractInner<TracedClient>;

pub type PythContract = PythRandom<Provider<Http>>;
pub type InstrumentedPythContract = PythRandom<Provider<TracedClient>>;

impl<T: JsonRpcClient + 'static + Clone> SignablePythContractInner<T> {
    /// Get the wallet that signs transactions sent to this contract.
    pub fn wallet(&self) -> LocalWallet {
        self.client().inner().inner().inner().signer().clone()
    }

    /// Get the underlying provider that communicates with the blockchain.
    pub fn provider(&self) -> Provider<T> {
        self.client().inner().inner().inner().provider().clone()
    }

    /// Submit a request for a random number to the contract.
    ///
    /// This method is a version of the autogenned `request` method that parses the emitted logs
    /// to return the sequence number of the created Request.
    pub async fn request_wrapper(
        &self,
        provider: &Address,
        user_randomness: &[u8; 32],
        use_blockhash: bool,
    ) -> Result<u64> {
        let fee = self.get_fee(*provider).call().await?;

        let hashed_randomness: [u8; 32] = Keccak256::digest(user_randomness).into();

        if let Some(r) = self
            .request(*provider, hashed_randomness, use_blockhash)
            .value(fee)
            .send()
            .await?
            .await?
        {
            // Extract Log from TransactionReceipt.
            let l: RawLog = r.logs[0].clone().into();
            if let PythRandomEvents::Requested1Filter(r) = PythRandomEvents::decode_log(&l)? {
                Ok(r.request.sequence_number)
            } else {
                Err(anyhow!("No log with sequence number"))
            }
        } else {
            Err(anyhow!("Request failed"))
        }
    }

    /// Submit a request for a random number to the contract.
    ///
    /// This method is a version of the autogenned `request` method that parses the emitted logs
    /// to return the sequence number of the created Request.
    pub async fn request_with_callback_wrapper(
        &self,
        provider: &Address,
        user_randomness: &[u8; 32],
    ) -> Result<u64> {
        let fee = self.get_fee(*provider).call().await?;

        if let Some(r) = self
            .request_with_callback(*provider, *user_randomness)
            .value(fee)
            .send()
            .await?
            .await?
        {
            // Extract Log from TransactionReceipt.
            let l: RawLog = r.logs[0].clone().into();
            if let PythRandomEvents::RequestedWithCallbackFilter(r) =
                PythRandomEvents::decode_log(&l)?
            {
                Ok(r.request.sequence_number)
            } else {
                Err(anyhow!("No log with sequence number"))
            }
        } else {
            Err(anyhow!("Request failed"))
        }
    }

    /// Reveal the generated random number to the contract.
    ///
    /// This method is a version of the autogenned `reveal` method that parses the emitted logs
    /// to return the generated random number.
    pub async fn reveal_wrapper(
        &self,
        provider: &Address,
        sequence_number: u64,
        user_randomness: &[u8; 32],
        provider_randomness: &[u8; 32],
    ) -> Result<[u8; 32]> {
        if let Some(r) = self
            .reveal(
                *provider,
                sequence_number,
                *user_randomness,
                *provider_randomness,
            )
            .send()
            .await?
            .await?
        {
            if let PythRandomEvents::Revealed1Filter(r) =
                PythRandomEvents::decode_log(&r.logs[0].clone().into())?
            {
                Ok(r.random_number)
            } else {
                Err(anyhow!("No log with randomnumber"))
            }
        } else {
            Err(anyhow!("Request failed"))
        }
    }

    pub fn from_config_and_provider_and_network_id(
        chain_config: &EthereumConfig,
        private_key: &str,
        provider: Provider<T>,
        network_id: u64,
    ) -> Result<SignablePythContractInner<T>> {
        let gas_oracle =
            EthProviderOracle::new(provider.clone(), chain_config.priority_fee_multiplier_pct);
        let wallet__ = private_key
            .parse::<LocalWallet>()?
            .with_chain_id(network_id);

        let address = wallet__.address();

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(LegacyTxMiddleware::new(
                chain_config.legacy_tx,
                GasOracleMiddleware::new(
                    NonceManagerMiddleware::new(SignerMiddleware::new(provider, wallet__), address),
                    gas_oracle,
                ),
            )),
        ))
    }

    pub async fn from_config_and_provider(
        chain_config: &EthereumConfig,
        private_key: &str,
        provider: Provider<T>,
    ) -> Result<SignablePythContractInner<T>> {
        let network_id = provider.get_chainid().await?.as_u64();
        Self::from_config_and_provider_and_network_id(
            chain_config,
            private_key,
            provider,
            network_id,
        )
    }
}

impl SignablePythContract {
    pub async fn from_config(chain_config: &EthereumConfig, private_key: &str) -> Result<Self> {
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;
        Self::from_config_and_provider(chain_config, private_key, provider).await
    }
}

impl InstrumentedSignablePythContract {
    pub fn from_config(
        chain_config: &EthereumConfig,
        private_key: &str,
        chain_id: ChainId,
        metrics: Arc<RpcMetrics>,
        network_id: u64,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;
        Self::from_config_and_provider_and_network_id(
            chain_config,
            private_key,
            provider,
            network_id,
        )
    }
}

impl PythContract {
    pub fn from_config(chain_config: &EthereumConfig) -> Result<Self> {
        let provider = Provider::<Http>::try_from(&chain_config.geth_rpc_addr)?;

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(provider),
        ))
    }
}

impl InstrumentedPythContract {
    pub fn from_config(
        chain_config: &EthereumConfig,
        chain_id: ChainId,
        metrics: Arc<RpcMetrics>,
    ) -> Result<Self> {
        let provider = TracedClient::new(chain_id, &chain_config.geth_rpc_addr, metrics)?;

        Ok(PythRandom::new(
            chain_config.contract_addr,
            Arc::new(provider),
        ))
    }
}

impl<T: JsonRpcClient + 'static> PythRandom<Provider<T>> {
    pub async fn get_network_id(&self) -> Result<U256> {
        let chain_id = self.client().get_chainid().await?;
        Ok(chain_id)
    }
}

#[async_trait]
impl<T: JsonRpcClient + 'static> EntropyReader for PythRandom<Provider<T>> {
    async fn get_request_v2(
        &self,
        provider_address: Address,
        sequence_number: u64,
    ) -> Result<Option<reader::Request>> {
        let request = self
            .get_request_v2(provider_address, sequence_number)
            .call()
            .await?;
        if request.sequence_number == 0 {
            Ok(None)
        } else {
            Ok(Some(reader::Request {
                provider: request.provider,
                sequence_number: request.sequence_number,
                block_number: request.block_number,
                use_blockhash: request.use_blockhash,
                callback_status: reader::RequestCallbackStatus::try_from(request.callback_status)?,
                gas_limit_10k: request.gas_limit_1_0k,
            }))
        }
    }

    async fn get_block_number(&self, confirmed_block_status: BlockStatus) -> Result<BlockNumber> {
        let block_number: EthersBlockNumber = confirmed_block_status.into();
        let block = self
            .client()
            .get_block(block_number)
            .await?
            .ok_or_else(|| Error::msg("pending block confirmation"))?;

        Ok(block
            .number
            .ok_or_else(|| Error::msg("pending confirmation"))?
            .as_u64())
    }

    async fn get_request_with_callback_events(
        &self,
        from_block: BlockNumber,
        to_block: BlockNumber,
        provider: Address,
    ) -> Result<Vec<RequestedV2Event>> {
        let mut event = self.requested_2_filter();
        event.filter = event
            .filter
            .address(self.address())
            .from_block(from_block)
            .to_block(to_block)
            .topic1(provider);

        let res: Vec<(Requested2Filter, LogMeta)> = event.query_with_meta().await?;
        Ok(res
            .into_iter()
            .map(|(r, meta)| RequestedV2Event {
                sequence_number: r.sequence_number,
                user_random_number: r.user_contribution,
                provider_address: r.provider,
                sender: r.caller,
                gas_limit: r.gas_limit,
                log_meta: meta,
            })
            .filter(|r| r.provider_address == provider)
            .collect())
    }

    async fn estimate_reveal_with_callback_gas(
        &self,
        sender: Address,
        provider: Address,
        sequence_number: u64,
        user_random_number: [u8; 32],
        provider_revelation: [u8; 32],
    ) -> Result<U256> {
        let result = self
            .reveal_with_callback(
                provider,
                sequence_number,
                user_random_number,
                provider_revelation,
            )
            .from(sender)
            .estimate_gas()
            .await;

        result.map_err(|e| e.into())
    }
}

#[async_trait]
impl KeeperTxContract for InstrumentedSignablePythContract {
    fn keeper_address(&self) -> Address {
        self.wallet().address()
    }

    async fn get_balance(&self, address: Address) -> KeeperTxResult<Wei> {
        let balance = self
            .provider()
            .get_balance(address, None)
            .await
            .map_err(|e| KeeperTxError::Provider {
                reason: format!("failed to fetch balance for {address:?}: {e:?}"),
            })?;

        wei_from_u256(balance, "balance")
    }

    async fn estimate_tx_cost(&self, legacy_tx: bool, gas_limit: u64) -> KeeperTxResult<Wei> {
        crate::eth_utils::utils::estimate_tx_cost(self.client(), legacy_tx, gas_limit as u128)
            .await
            .map(Wei)
            .map_err(|e| KeeperTxError::Other {
                reason: format!("failed to estimate transaction cost: {e:?}"),
            })
    }

    async fn reveal_with_callback(
        &self,
        provider_address: Address,
        sequence_number: u64,
        user_random_number: [u8; 32],
        provider_revelation: [u8; 32],
        escalation_policy: EscalationPolicy,
    ) -> KeeperTxResult<TxExecutionOutcome<RevealWithCallbackData>> {
        let contract_call = self.reveal_with_callback(
            provider_address,
            sequence_number,
            user_random_number,
            provider_revelation,
        );

        let error_mapper =
            |num_retries: u64,
             error: BackoffError<SubmitTxError<MiddlewaresWrapper<TracedClient>>>| {
                if let BackoffError::Transient {
                    err: SubmitTxError::GasUsageEstimateError(tx, ContractError::Revert(revert)),
                    ..
                } = &error
                {
                    if let Ok(PythRandomErrorsErrors::NoSuchRequest(_)) =
                        PythRandomErrorsErrors::decode(revert)
                    {
                        let mapped_error = SubmitTxError::GasUsageEstimateError(
                            tx.clone(),
                            ContractError::Revert(revert.clone()),
                        );

                        if num_retries >= 5 {
                            return BackoffError::Permanent(mapped_error);
                        }

                        let retry_after_seconds = match num_retries {
                            0 => 5,
                            1 => 10,
                            _ => 60,
                        };

                        return BackoffError::Transient {
                            err: mapped_error,
                            retry_after: Some(Duration::from_secs(retry_after_seconds)),
                        };
                    }
                }

                error
            };

        let submit_result = submit_tx_with_backoff(
            self.client(),
            contract_call,
            escalation_policy,
            Some(error_mapper),
        )
        .await
        .map_err(map_submit_error)?;

        convert_submit_result(submit_result)
    }

    async fn withdraw_as_fee_manager(
        &self,
        provider_address: Address,
        amount: Wei,
    ) -> KeeperTxResult<TxExecutionOutcome<()>> {
        execute_simple_call(self.withdraw_as_fee_manager(provider_address, amount.0)).await
    }

    async fn set_provider_fee_as_fee_manager(
        &self,
        provider_address: Address,
        fee: Wei,
    ) -> KeeperTxResult<TxExecutionOutcome<()>> {
        execute_simple_call(self.set_provider_fee_as_fee_manager(provider_address, fee.0)).await
    }

    async fn transfer(
        &self,
        destination: Address,
        amount: Wei,
    ) -> KeeperTxResult<TxExecutionOutcome<()>> {
        transfer_funds(self.client(), self.keeper_address(), destination, amount).await
    }

    async fn get_provider_info(
        &self,
        provider_address: Address,
    ) -> KeeperTxResult<KeeperProviderInfo> {
        let info = self
            .get_provider_info_v2(provider_address)
            .call()
            .await
            .map_err(|e| KeeperTxError::Provider {
                reason: format!("failed to fetch provider info: {e:?}"),
            })?;

        Ok(KeeperProviderInfo {
            accrued_fees_in_wei: wei_from_u256(info.accrued_fees_in_wei.into(), "accrued_fees")?,
            fee_in_wei: wei_from_u256(info.fee_in_wei.into(), "fee")?,
            sequence_number: info.sequence_number,
            end_sequence_number: info.end_sequence_number,
            current_commitment_sequence_number: info.current_commitment_sequence_number,
            default_gas_limit: info.default_gas_limit.into(),
            fee_manager: info.fee_manager,
        })
    }
}

const SIMPLE_TX_NUM_RETRIES: u64 = 0;
const SIMPLE_TX_FEE_MULTIPLIER: u64 = 100;
const TRANSFER_CONFIRMATION_TIMEOUT_SECS: u64 = 30;

fn convert_submit_result(
    submit_result: SubmitTxResult,
) -> KeeperTxResult<TxExecutionOutcome<RevealWithCallbackData>> {
    let SubmitTxResult {
        num_retries,
        fee_multiplier,
        duration,
        receipt,
        revealed_event,
    } = submit_result;

    let outcome = receipt_to_outcome(receipt, duration, num_retries, fee_multiplier, ())?;

    let callback_gas_used =
        u256_to_u128(revealed_event.callback_gas_used.into(), "callback_gas_used")?;

    let callback_return_value = revealed_event.callback_return_value.to_vec();

    Ok(TxExecutionOutcome {
        tx_hash: outcome.tx_hash,
        block_number: outcome.block_number,
        gas_used: outcome.gas_used,
        effective_gas_price: outcome.effective_gas_price,
        duration: outcome.duration,
        num_retries: outcome.num_retries,
        fee_multiplier: outcome.fee_multiplier,
        result: RevealWithCallbackData {
            callback_failed: revealed_event.callback_failed,
            callback_return_value,
            callback_gas_used,
        },
    })
}

fn receipt_to_outcome<T>(
    receipt: TransactionReceipt,
    duration: Duration,
    num_retries: u64,
    fee_multiplier: u64,
    result: T,
) -> KeeperTxResult<TxExecutionOutcome<T>> {
    let tx_hash = TxHash(receipt.transaction_hash.to_fixed_bytes());
    let block_number = receipt.block_number.map(|b| b.as_u64());
    let gas_used = optional_u256_to_u128(receipt.gas_used, "gas_used")?;
    let effective_gas_price =
        optional_u256_to_u128(receipt.effective_gas_price, "effective_gas_price")?;

    Ok(TxExecutionOutcome {
        tx_hash,
        block_number,
        gas_used,
        effective_gas_price,
        duration,
        num_retries,
        fee_multiplier,
        result,
    })
}

fn optional_u256_to_u128(value: Option<U256>, context: &str) -> KeeperTxResult<Option<u128>> {
    match value {
        Some(v) => Ok(Some(u256_to_u128(v, context)?)),
        None => Ok(None),
    }
}

fn u256_to_u128(value: U256, context: &str) -> KeeperTxResult<u128> {
    value.try_into().map_err(|_| KeeperTxError::Other {
        reason: format!("{context} {value} exceeds supported range"),
    })
}

fn wei_from_u256(value: U256, context: &str) -> KeeperTxResult<Wei> {
    u256_to_u128(value, context).map(Wei)
}

fn map_submit_error<T>(error: SubmitTxError<T>) -> KeeperTxError
where
    T: Middleware + NonceManaged + 'static,
{
    match error {
        SubmitTxError::GasUsageEstimateError(_, ContractError::Revert(revert)) => {
            KeeperTxError::Reverted {
                reason: format!("0x{}", hex::encode(revert)),
            }
        }
        SubmitTxError::GasUsageEstimateError(_, other) => KeeperTxError::Other {
            reason: format!("gas usage estimate error: {other:?}"),
        },
        SubmitTxError::GasLimitExceeded { estimate, limit } => KeeperTxError::GasLimit {
            estimate: u256_to_u128(estimate, "gas_limit_estimate").unwrap_or(u128::MAX),
            limit: u256_to_u128(limit, "gas_limit_limit").unwrap_or(u128::MAX),
        },
        SubmitTxError::GasPriceEstimateError(_) => KeeperTxError::Provider {
            reason: "gas_price_estimate".to_string(),
        },
        SubmitTxError::SubmissionError(_, _) => KeeperTxError::Submission {
            reason: "Error submitting the transaction on-chain".to_string(),
        },
        SubmitTxError::ConfirmationTimeout(tx) => KeeperTxError::ConfirmationTimeout {
            reason: format!(
                "Transaction was submitted, but never confirmed. Hash: {}",
                format_typed_tx_hash(&tx)
            ),
        },
        SubmitTxError::ConfirmationError(tx, _) => KeeperTxError::Confirmation {
            reason: format!(
                "Transaction was submitted, but never confirmed. Hash: {}",
                format_typed_tx_hash(&tx)
            ),
        },
        SubmitTxError::ReceiptError(tx, _) => KeeperTxError::Receipt {
            reason: format!(
                "Reveal transaction failed on-chain. Hash: {}",
                format_typed_tx_hash(&tx)
            ),
        },
    }
}

fn format_typed_tx_hash(tx: &TypedTransaction) -> String {
    format!("{:#x}", tx.sighash())
}

async fn execute_simple_call(
    contract_call: ContractCall<MiddlewaresWrapper<TracedClient>, ()>,
) -> KeeperTxResult<TxExecutionOutcome<()>> {
    let call_name = contract_call.function.name.clone();
    let start = Instant::now();

    let pending_tx = contract_call
        .send()
        .await
        .map_err(|e| KeeperTxError::Submission {
            reason: format!("Error submitting transaction({call_name}) {e:?}"),
        })?;

    let receipt = pending_tx
        .await
        .map_err(|e| KeeperTxError::Confirmation {
            reason: format!("Error waiting for transaction({call_name}) receipt: {e:?}"),
        })?
        .ok_or_else(|| KeeperTxError::Other {
            reason: format!(
                "Can't verify the transaction({call_name}), probably dropped from mempool"
            ),
        })?;

    tracing::info!(
        transaction_hash = &receipt.transaction_hash.to_string(),
        "Confirmed transaction({call_name}). Receipt: {:?}",
        receipt
    );

    if receipt.status == Some(U64::from(0u64)) {
        return Err(KeeperTxError::Receipt {
            reason: format!(
                "Transaction({call_name}) reverted on-chain. Receipt: {:?}",
                receipt
            ),
        });
    }

    receipt_to_outcome(
        receipt,
        start.elapsed(),
        SIMPLE_TX_NUM_RETRIES,
        SIMPLE_TX_FEE_MULTIPLIER,
        (),
    )
}

async fn transfer_funds(
    client: Arc<MiddlewaresWrapper<TracedClient>>,
    source_wallet_address: Address,
    destination_address: Address,
    transfer_amount: Wei,
) -> KeeperTxResult<TxExecutionOutcome<()>> {
    let transfer_amount_u256 = U256::from(transfer_amount.0);
    tracing::info!(
        "Transferring {:?} from {:?} to {:?}",
        transfer_amount_u256,
        source_wallet_address,
        destination_address
    );

    let tx = TransactionRequest::new()
        .to(destination_address)
        .value(U256::from(transfer_amount.0))
        .from(source_wallet_address);

    let start = Instant::now();

    let pending_tx = client
        .send_transaction(tx.clone(), None)
        .await
        .map_err(|e| KeeperTxError::Submission {
            reason: format!("failed to submit transfer transaction: {e:?}"),
        })?;

    let receipt = timeout(
        Duration::from_secs(TRANSFER_CONFIRMATION_TIMEOUT_SECS),
        pending_tx,
    )
    .await
    .map_err(|_| KeeperTxError::ConfirmationTimeout {
        reason: "Transfer transaction confirmation timeout".to_string(),
    })?
    .map_err(|e| KeeperTxError::Confirmation {
        reason: format!("transfer transaction confirmation error: {e:?}"),
    })?
    .ok_or_else(|| KeeperTxError::Other {
        reason: "transfer transaction, probably dropped from mempool".to_string(),
    })?;

    if receipt.status == Some(U64::from(0u64)) {
        return Err(KeeperTxError::Receipt {
            reason: format!("Transfer transaction failed on-chain. Receipt: {receipt:?}"),
        });
    }

    tracing::info!(
        "Transfer transaction confirmed: {:?}",
        receipt.transaction_hash
    );

    receipt_to_outcome(
        receipt,
        start.elapsed(),
        SIMPLE_TX_NUM_RETRIES,
        SIMPLE_TX_FEE_MULTIPLIER,
        (),
    )
}
