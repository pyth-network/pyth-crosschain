use std::process::Command;

use alloy::{
    primitives::Address,
    rpc::types::{serde_helpers::WithOtherFields, AnyReceiptEnvelope, Log, TransactionReceipt},
};
use alloy_primitives::U128;
use e2e::{Account, ReceiptExt};
use eyre::WrapErr;
use koba::config::{Deploy, Generate, PrivateKey};
use serde::Deserialize;

pub mod extend_pyth_example;
pub mod report;

#[derive(Debug, Deserialize)]
struct ArbOtherFields {
    #[serde(rename = "gasUsedForL1")]
    gas_used_for_l1: U128,
    #[allow(dead_code)]
    #[serde(rename = "l1BlockNumber")]
    l1_block_number: String,
}

/// Cache options for the contract.
/// `Bid(0)` will likely cache the contract on the nitro test node.
pub enum CacheOpt {
    None,
    Bid(u32),
}

type ArbTxReceipt = WithOtherFields<TransactionReceipt<AnyReceiptEnvelope<Log>>>;

async fn deploy(
    account: &Account,
    contract_name: &str,
    args: Option<String>,
    cache_opt: CacheOpt,
) -> eyre::Result<Address> {
    let manifest_dir = std::env::current_dir().context("should get current dir from env")?;

    let wasm_path = manifest_dir
        .join("target")
        .join("wasm32-unknown-unknown")
        .join("release")
        .join(format!("{}_example.wasm", contract_name.replace('-', "_")));
    let sol_path = args.as_ref().map(|_| {
        manifest_dir
            .join("examples")
            .join(format!("{}-example", contract_name))
            .join("src")
            .join("constructor.sol")
    });
    let pk = account.pk();
    let config = Deploy {
        generate_config: Generate {
            wasm: wasm_path.clone(),
            sol: sol_path,
            args,
            legacy: false,
        },
        auth: PrivateKey {
            private_key_path: None,
            private_key: Some(pk),
            keystore_path: None,
            keystore_password_path: None,
        },
        endpoint: env("RPC_URL")?,
        deploy_only: false,
        quiet: true,
    };

    let address = koba::deploy(&config)
        .await
        .expect("should deploy contract")
        .address()?;

    if let CacheOpt::Bid(bid) = cache_opt {
        cache_contract(account, address, bid)?;
    }

    Ok(address)
}

/// Try to cache a contract on the stylus network.
/// Already cached contracts won't be cached, and this function will not return
/// an error.
/// Output will be forwarded to the child process.
fn cache_contract(account: &Account, contract_addr: Address, bid: u32) -> eyre::Result<()> {
    // We don't need a status code.
    // Since it is not zero when the contract is already cached.
    let _ = Command::new("cargo")
        .args(["stylus", "cache", "bid"])
        .args(["-e", &env("RPC_URL")?])
        .args(["--private-key", &format!("0x{}", account.pk())])
        .arg(contract_addr.to_string())
        .arg(bid.to_string())
        .status()
        .context("failed to execute `cargo stylus cache bid` command")?;
    Ok(())
}

/// Load the `name` environment variable.
fn env(name: &str) -> eyre::Result<String> {
    std::env::var(name).wrap_err(format!("failed to load {name}"))
}
