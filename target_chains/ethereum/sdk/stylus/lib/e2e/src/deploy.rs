use std::path::Path;

use alloy::{rpc::types::TransactionReceipt, sol_types::SolConstructor};
use koba::config::Deploy;

use crate::project::Crate;

/// A basic smart contract deployer.
pub struct Deployer {
    rpc_url: String,
    private_key: String,
    ctr_args: Option<String>,
}

impl Deployer {
    pub fn new(rpc_url: String, private_key: String) -> Self {
        Self { rpc_url, private_key, ctr_args: None }
    }

    /// Add solidity constructor to the deployer.
    pub fn with_constructor<C: SolConstructor + Send>(
        mut self,
        constructor: C,
    ) -> Deployer {
        self.ctr_args = Some(alloy::hex::encode(constructor.abi_encode()));
        self
    }

    /// Add the default constructor to the deployer.
    pub fn with_default_constructor<C: SolConstructor + Send + Default>(
        self,
    ) -> Deployer {
        self.with_constructor(C::default())
    }

    /// Deploy and activate the contract implemented as `#[entrypoint]` in the
    /// current crate.
    /// Consumes currently configured deployer.
    ///
    /// # Errors
    ///
    /// May error if:
    ///
    /// - Unable to collect information about the crate required for deployment.
    /// - [`koba::deploy`] errors.
    pub async fn deploy(self) -> eyre::Result<TransactionReceipt> {
        let pkg = Crate::new()?;
        let wasm_path = pkg.wasm;
        let sol_path = pkg.manifest_dir.join("src/constructor.sol");
        let sol =
            if Path::new(&sol_path).exists() { Some(sol_path) } else { None };

        let config = Deploy {
            generate_config: koba::config::Generate {
                wasm: wasm_path.clone(),
                sol,
                args: self.ctr_args,
                legacy: false,
            },
            auth: koba::config::PrivateKey {
                private_key_path: None,
                private_key: Some(self.private_key),
                keystore_path: None,
                keystore_password_path: None,
            },
            endpoint: self.rpc_url,
            deploy_only: false,
            quiet: false,
        };
        koba::deploy(&config).await
    }
}
