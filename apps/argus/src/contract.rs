use {
    alloy::{
        contract::{Contract, ContractInstance},
        primitives::{Address, Bytes, U256},
        providers::Provider,
        signers::Signer,
    },
    anyhow::Result,
    std::sync::Arc,
};

// Contract ABI definition
abigen!(Pulse, "target_chains/ethereum/contracts/contracts/pulse/IPulse.sol");

pub struct PulseContract<P: Provider> {
    instance: ContractInstance<Arc<P>, Pulse>,
}

impl<P: Provider> PulseContract<P> {
    pub fn new(address: Address, provider: Arc<P>) -> Self {
        Self {
            instance: ContractInstance::new(address, Arc::new(Pulse::new()), provider),
        }
    }

    pub async fn execute_callback(
        &self,
        provider: Address,
        sequence_number: U64,
        price_ids: Vec<[u8; 32]>,
        update_data: Vec<Bytes>,
        callback_gas_limit: U256,
    ) -> Result<TxHash> {
        let tx = self.instance
            .execute_callback(provider, sequence_number, price_ids, update_data, callback_gas_limit)
            .send()
            .await?;

        Ok(tx.tx_hash())
    }
}
