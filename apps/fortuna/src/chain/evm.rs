use {
    super::{
        chain::{
            ChainBlockNumber,
            ChainReader,
            ChainWriter,
            RequestWithCallbackData,
            RevealError,
        },
        reader::BlockStatus,
    },
    crate::config::EthereumConfig,
    anyhow::Result,
    ethers::{
        contract::abigen,
        middleware::{
            transformer::{
                Transformer,
                TransformerError,
                TransformerMiddleware,
            },
            NonceManagerMiddleware,
            SignerMiddleware,
        },
        prelude::TransactionRequest,
        providers::{
            Http,
            Middleware,
            Provider,
        },
        signers::{
            LocalWallet,
            Signer,
        },
        types::{
            transaction::eip2718::TypedTransaction,
            Address,
        },
    },
    std::sync::Arc,
};

// TODO: Programmatically generate this so we don't have to keep committed ABI in sync with the
// contract in the same repo.
abigen!(
    PythRandom,
    "../../target_chains/ethereum/entropy_sdk/solidity/abis/IEntropy.json"
);

/// Transformer that converts a transaction into a legacy transaction if use_legacy_tx is true.
#[derive(Clone, Debug)]
pub struct LegacyTxTransformer {
    use_legacy_tx: bool,
}

impl Transformer for LegacyTxTransformer {
    fn transform(&self, tx: &mut TypedTransaction) -> Result<(), TransformerError> {
        if self.use_legacy_tx {
            let legacy_request: TransactionRequest = (*tx).clone().into();
            *tx = legacy_request.into();
            Ok(())
        } else {
            Ok(())
        }
    }
}

pub type SignablePythContract = PythRandom<
    TransformerMiddleware<
        NonceManagerMiddleware<SignerMiddleware<Provider<Http>, LocalWallet>>,
        LegacyTxTransformer,
    >,
>;

impl EthereumConfig {
    pub async fn get_writer(
        &self,
        provider_addr: Address,
        private_key: &str,
    ) -> Result<Box<dyn ChainWriter>> {
        let provider = Provider::<Http>::try_from(&self.geth_rpc_addr)?;
        let chain_id = provider.get_chainid().await?;

        let transformer = LegacyTxTransformer {
            use_legacy_tx: self.legacy_tx,
        };

        let wallet__ = private_key
            .parse::<LocalWallet>()?
            .with_chain_id(chain_id.as_u64());

        let address = wallet__.address();

        let contract = PythRandom::new(
            self.contract_addr,
            Arc::new(TransformerMiddleware::new(
                NonceManagerMiddleware::new(SignerMiddleware::new(provider, wallet__), address),
                transformer,
            )),
        );

        Ok(Box::new(EvmWriterContract {
            provider_addr,
            confirmed_block_status: self.confirmed_block_status,
            reveal_delay_blocks: self.reveal_delay_blocks,
            contract,
        }))
    }
}


pub struct EvmWriterContract {
    provider_addr:          Address,
    confirmed_block_status: BlockStatus,
    reveal_delay_blocks:    ChainBlockNumber,
    contract:               SignablePythContract,
}

impl ChainReader for EvmWriterContract {
    #[doc = " Returns data of all the requests with callback made on chain between"]
    #[doc = " the given block numbers."]
    #[must_use]
    #[allow(clippy::type_complexity, clippy::type_repetition_in_bounds)]
    fn get_requests_with_callback_data<'life0, 'async_trait>(
        &'life0 self,
        from_block: ChainBlockNumber,
        to_block: ChainBlockNumber,
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = Result<Vec<RequestWithCallbackData>>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        Self: 'async_trait,
    {
        todo!()
    }

    #[doc = " Returns the latest block which we consider to be included into the chain and"]
    #[doc = " is safe from reorgs."]
    #[must_use]
    #[allow(clippy::type_complexity, clippy::type_repetition_in_bounds)]
    fn get_latest_safe_block<'life0, 'async_trait>(
        &'life0 self,
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = Result<ChainBlockNumber>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        Self: 'async_trait,
    {
        todo!()
    }
}

impl ChainWriter for EvmWriterContract {
    #[doc = " Fulfill the given request on chain with the given provider revelation."]
    #[must_use]
    #[allow(clippy::type_complexity, clippy::type_repetition_in_bounds)]
    fn reveal_with_callback<'life0, 'async_trait>(
        &'life0 self,
        request_with_callback_data: RequestWithCallbackData,
        provider_revelation: [u8; 32],
    ) -> ::core::pin::Pin<
        Box<
            dyn ::core::future::Future<Output = Result<(), RevealError>>
                + ::core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        Self: 'async_trait,
    {
        todo!()
    }
}
