use {
    clap::{
        crate_authors,
        crate_description,
        crate_name,
        crate_version,
        Args,
        Parser,
    },
    ethers::types::Address,
};


mod generate;
mod get_request;
mod register_provider;
mod request_randomness;
mod run;

pub use {
    generate::GenerateOptions,
    get_request::GetRequestOptions,
    register_provider::RegisterProviderOptions,
    request_randomness::RequestRandomnessOptions,
    run::RunOptions,
};

const DEFAULT_RPC_ADDR: &str = "127.0.0.1:34000";
const DEFAULT_HTTP_ADDR: &str = "http://127.0.0.1:34000";

#[derive(Parser, Debug)]
#[command(name = crate_name!())]
#[command(author = crate_authors!())]
#[command(about = crate_description!())]
#[command(version = crate_version!())]
#[allow(clippy::large_enum_variant)]
pub enum Options {
    /// Run the Randomness Service.
    Run(RunOptions),

    /// Register a new provider with the Pyth Random oracle.
    RegisterProvider(RegisterProviderOptions),

    /// Request a random number from the contract.
    RequestRandomness(RequestRandomnessOptions),

    /// Generate a random number by running the entire protocol end-to-end
    Generate(GenerateOptions),

    GetRequest(GetRequestOptions),
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Ethereum Options")]
#[group(id = "Ethereum")]
pub struct EthereumOptions {
    /// A 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    #[arg(default_value = None)]
    pub private_key: Option<String>,

    /// URL of a Geth RPC endpoint to use for interacting with the blockchain.
    #[arg(long = "geth-rpc-addr")]
    #[arg(env = "GETH_RPC_ADDR")]
    #[arg(default_value = "https://goerli.optimism.io")]
    pub geth_rpc_addr: String,

    /// Address of a Pyth Randomness contract to interact with.
    #[arg(long = "pyth-contract-addr")]
    #[arg(env = "PYTH_CONTRACT_ADDR")]
    #[arg(default_value = "0x28F16Af4D87523910b843a801454AEde5F9B0459")]
    pub contract_addr: Address,
}

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Randomness Options")]
#[group(id = "Randomness")]
pub struct RandomnessOptions {
    /// A secret used for generating new hash chains. A 64-char hex string.
    #[arg(long = "secret")]
    #[arg(env = "PYTH_SECRET")]
    #[arg(default_value = "0000000000000000000000000000000000000000000000000000000000000000")]
    pub secret: String,

    /// The length of the hash chain to generate.
    #[arg(long = "chain-length")]
    #[arg(env = "PYTH_CHAIN_LENGTH")]
    #[arg(default_value = "32")]
    pub chain_length: u64,
}
